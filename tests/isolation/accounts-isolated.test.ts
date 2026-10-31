// Isolation seam (spec Testing Decisions, seam 3; PRD criterion 15).
//
// Two accounts sign in to the LOCAL Supabase stack. Account B queries the
// database directly through the Supabase client with its own session, not
// through any interface, and must get nothing of account A's documents,
// reviews, Red lines or settings. Every "B gets nothing" check is paired with a positive
// control that A does get its own row, so a broken query cannot pass by
// returning nothing.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, psql } from "./local-supabase";

const TABLES = ["documents", "reviews", "red_lines", "account_settings"] as const;
type Table = (typeof TABLES)[number];

type Account = { id: string; client: SupabaseClient };

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function makeAccount(label: string): Promise<Account> {
  const email = `isolation-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  expect(signIn.data.user?.id).toBe(data.user.id);
  return { id: data.user.id, client };
}

let a: Account;
let b: Account;
const aRows: Record<Table, string> = { documents: "", reviews: "", red_lines: "", account_settings: "" };
let bDocumentId = "";
let bRedLineId = "";

const aDocumentText =
  "The Vendor may change the fees on thirty days notice. The Customer is personally liable.";

beforeAll(async () => {
  a = await makeAccount("a");
  b = await makeAccount("b");

  const doc = await a.client
    .from("documents")
    .insert({ title: "A vendor agreement", source_kind: "pasted", extracted_text: aDocumentText })
    .select("id, owner_id")
    .single();
  if (doc.error) throw doc.error;
  expect(doc.data.owner_id).toBe(a.id);
  aRows.documents = doc.data.id;

  const redLine = await a.client
    .from("red_lines")
    .insert({ text: "A's own Red line", default_number: 1 })
    .select("id")
    .single();
  if (redLine.error) throw redLine.error;
  aRows.red_lines = redLine.data.id;

  const review = await a.client
    .from("reviews")
    .insert({
      document_id: aRows.documents,
      red_lines: [{ text: "A's own Red line", default_number: 1 }],
      summary: "A's summary",
      flags: [
        {
          severity: "negotiate",
          source_sentences: [
            "The Vendor may change the fees on thirty days notice.",
            "The Customer is personally liable.",
          ],
        },
      ],
      withheld_count: 2,
      withheld: [{ reason: "source-not-found" }, { reason: "no-source" }],
    })
    .select("id")
    .single();
  if (review.error) throw review.error;
  aRows.reviews = review.data.id;

  const settings = await a.client
    .from("account_settings")
    .insert({ udyam_micro_or_small: true })
    .select("id")
    .single();
  if (settings.error) throw settings.error;
  aRows.account_settings = settings.data.id;

  const bDoc = await b.client
    .from("documents")
    .insert({ title: "B's document", source_kind: "docx", extracted_text: "B's text." })
    .select("id")
    .single();
  if (bDoc.error) throw bDoc.error;
  bDocumentId = bDoc.data.id;

  const bRedLine = await b.client
    .from("red_lines")
    .insert({ text: "B's own Red line" })
    .select("id")
    .single();
  if (bRedLine.error) throw bRedLine.error;
  bRedLineId = bRedLine.data.id;
});

afterAll(async () => {
  // Deleting the auth users cascades to every row they own.
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("reading another account's rows", () => {
  for (const table of TABLES) {
    it(`A can read its own ${table} row (positive control)`, async () => {
      const { data, error } = await a.client.from(table).select("id, owner_id").eq("id", aRows[table]);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: aRows[table], owner_id: a.id }]);
    });

    it(`B gets zero rows of A's ${table}, by id and in a full listing`, async () => {
      const byId = await b.client.from(table).select("*").eq("id", aRows[table]);
      expect(byId.error).toBeNull();
      expect(byId.data).toEqual([]);

      const byOwner = await b.client.from(table).select("*").eq("owner_id", a.id);
      expect(byOwner.error).toBeNull();
      expect(byOwner.data).toEqual([]);

      const all = await b.client.from(table).select("owner_id");
      expect(all.error).toBeNull();
      expect(all.data!.every((row) => row.owner_id === b.id)).toBe(true);
    });

    it(`B's count of A's ${table} is zero`, async () => {
      const { count, error } = await b.client
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("owner_id", a.id);
      expect(error).toBeNull();
      expect(count).toBe(0);
    });
  }

  it("B cannot reach A's document text by joining through a review", async () => {
    const { data, error } = await b.client
      .from("reviews")
      .select("id, documents(extracted_text)")
      .eq("document_id", aRows.documents);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("writing rows owned by another account", () => {
  it("B cannot insert a document owned by A", async () => {
    const { data, error } = await b.client
      .from("documents")
      .insert({ owner_id: a.id, source_kind: "pasted", extracted_text: "Planted." })
      .select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("B cannot insert a Red line owned by A", async () => {
    const { data, error } = await b.client
      .from("red_lines")
      .insert({ owner_id: a.id, text: "Planted Red line" })
      .select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("B cannot insert a review owned by A", async () => {
    const { data, error } = await b.client
      .from("reviews")
      .insert({ owner_id: a.id, document_id: aRows.documents, red_lines: [] })
      .select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("B cannot attach its own review to A's document", async () => {
    const { data, error } = await b.client
      .from("reviews")
      .insert({ document_id: aRows.documents, red_lines: [] })
      .select("id");
    expect(data).toBeNull();
    // Composite foreign key (document_id, owner_id): A's document is not B's.
    expect(error?.code).toBe("23503");
  });

  for (const table of TABLES) {
    it(`B's update and delete of A's ${table} touch zero rows`, async () => {
      const patch =
        table === "documents"
          ? { title: "Changed by B" }
          : table === "red_lines"
            ? { text: "Changed by B" }
            : table === "reviews"
              ? { summary: "Changed by B" }
              : { udyam_micro_or_small: false };
      const upd = await b.client.from(table).update(patch).eq("id", aRows[table]).select("id");
      expect(upd.error).toBeNull();
      expect(upd.data).toEqual([]);

      const del = await b.client.from(table).delete().eq("id", aRows[table]).select("id");
      expect(del.error).toBeNull();
      expect(del.data).toEqual([]);

      const still = await a.client.from(table).select("id").eq("id", aRows[table]);
      expect(still.error).toBeNull();
      expect(still.data).toEqual([{ id: aRows[table] }]);
    });
  }

  it("A's rows are unchanged after B's attempts", async () => {
    const doc = await a.client.from("documents").select("title, extracted_text").eq("id", aRows.documents).single();
    expect(doc.data).toEqual({ title: "A vendor agreement", extracted_text: aDocumentText });
    const rl = await a.client.from("red_lines").select("text").eq("id", aRows.red_lines).single();
    expect(rl.data).toEqual({ text: "A's own Red line" });
    const rv = await a.client.from("reviews").select("summary").eq("id", aRows.reviews).single();
    expect(rv.data).toEqual({ summary: "A's summary" });
    const st = await a.client.from("account_settings").select("udyam_micro_or_small").eq("id", aRows.account_settings).single();
    expect(st.data).toEqual({ udyam_micro_or_small: true });
  });

  it("B cannot hand its own document or Red line over to A", async () => {
    const doc = await b.client.from("documents").update({ owner_id: a.id }).eq("id", bDocumentId).select("id");
    expect(doc.data).toBeNull();
    expect(doc.error?.code).toBe("42501");

    const rl = await b.client.from("red_lines").update({ owner_id: a.id }).eq("id", bRedLineId).select("id");
    expect(rl.data).toBeNull();
    expect(rl.error?.code).toBe("42501");

    const aView = await a.client.from("documents").select("id").eq("id", bDocumentId);
    expect(aView.data).toEqual([]);
  });

  it("B cannot insert a settings row owned by A", async () => {
    const { data, error } = await b.client
      .from("account_settings")
      .insert({ owner_id: a.id, udyam_micro_or_small: false })
      .select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("B cannot hand its own settings row over to A", async () => {
    const own = await b.client.from("account_settings").insert({}).select("id").single();
    expect(own.error).toBeNull();
    const handover = await b.client
      .from("account_settings")
      .update({ owner_id: a.id })
      .eq("id", own.data!.id)
      .select("id");
    expect(handover.data).toBeNull();
    expect(handover.error?.code).toBe("42501");
  });

  it("B cannot hand its own review over to A", async () => {
    const own = await b.client
      .from("reviews")
      .insert({ document_id: bDocumentId, red_lines: [] })
      .select("id")
      .single();
    expect(own.error).toBeNull();
    const handover = await b.client.from("reviews").update({ owner_id: a.id }).eq("id", own.data!.id).select("id");
    expect(handover.data).toBeNull();
    expect(handover.error?.code).toBe("42501");
  });
});

describe("an account changing its own rows", () => {
  it("A can edit its own Red line, and updated_at moves forward", async () => {
    const before = await a.client.from("red_lines").select("updated_at").eq("id", aRows.red_lines).single();
    expect(before.error).toBeNull();
    const upd = await a.client
      .from("red_lines")
      .update({ text: "A's edited Red line" })
      .eq("id", aRows.red_lines)
      .select("text, updated_at");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
    expect(upd.data![0].text).toBe("A's edited Red line");
    expect(new Date(upd.data![0].updated_at).getTime()).toBeGreaterThan(new Date(before.data!.updated_at).getTime());
  });

  it("an account has at most one settings row, and the Udyam answer starts unanswered", async () => {
    const second = await a.client.from("account_settings").insert({}).select("id");
    expect(second.data).toBeNull();
    expect(second.error?.code).toBe("23505");

    const bSettings = await b.client.from("account_settings").select("udyam_micro_or_small");
    expect(bSettings.error).toBeNull();
    expect(bSettings.data).toEqual([{ udyam_micro_or_small: null }]);
  });

  it("A can change its own Udyam answer", async () => {
    const upd = await a.client
      .from("account_settings")
      .update({ udyam_micro_or_small: false })
      .eq("id", aRows.account_settings)
      .select("udyam_micro_or_small");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([{ udyam_micro_or_small: false }]);
  });

  it("A can delete a row of its own", async () => {
    const extra = await a.client.from("red_lines").insert({ text: "Throwaway" }).select("id").single();
    expect(extra.error).toBeNull();
    const del = await a.client.from("red_lines").delete().eq("id", extra.data!.id).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toEqual([{ id: extra.data!.id }]);
  });
});

describe("signed-out (anon) access", () => {
  const anon = anonClient();

  for (const table of TABLES) {
    it(`anon cannot read ${table}`, async () => {
      const { data, error } = await anon.from(table).select("*").eq("id", aRows[table]);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
  }

  it("anon cannot insert a document, even one claiming to be A's", async () => {
    const { data, error } = await anon
      .from("documents")
      .insert({ owner_id: a.id, source_kind: "pasted", extracted_text: "Planted." })
      .select("id");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("what the schema stores", () => {
  it("a review keeps several Source sentences per flag, the withheld count and its Red line list", async () => {
    const { data, error } = await a.client
      .from("reviews")
      .select("flags, withheld_count, withheld, red_lines")
      .eq("id", aRows.reviews)
      .single();
    expect(error).toBeNull();
    expect(data!.flags[0].source_sentences).toHaveLength(2);
    expect(data!.withheld_count).toBe(2);
    expect(data!.withheld).toEqual([{ reason: "source-not-found" }, { reason: "no-source" }]);
    expect(data!.red_lines).toEqual([{ text: "A's own Red line", default_number: 1 }]);
  });

  it("a withheld entry holds a reason code and nothing else, and the count matches the entries", async () => {
    const insert = (row: Record<string, unknown>) =>
      a.client.from("reviews").insert({ document_id: aRows.documents, red_lines: [], ...row }).select("id");
    for (const bad of [
      { withheld: [{ reason: "source-not-found", title: "Model text" }], withheld_count: 1 },
      { withheld: [{ reason: "made-up" }], withheld_count: 1 },
      { withheld: ["source-not-found"], withheld_count: 1 },
      { withheld: [{}], withheld_count: 1 },
      { withheld: { reason: "no-source" }, withheld_count: 1 },
      { withheld: [{ reason: "no-source" }], withheld_count: 2 },
      { withheld: [], withheld_count: 1 },
    ]) {
      const { data, error } = await insert(bad);
      expect(data, JSON.stringify(bad)).toBeNull();
      expect(error?.code, JSON.stringify(bad)).toBe("23514");
    }
    const ok = await insert({ withheld: [{ reason: "unreadable" }], withheld_count: 1 });
    expect(ok.error).toBeNull();
  });

  it("a flag without a Source sentence is refused", async () => {
    const { error } = await a.client
      .from("reviews")
      .insert({ document_id: aRows.documents, red_lines: [], flags: [{ severity: "know_this", source_sentences: [] }] })
      .select("id");
    expect(error?.code).toBe("23514");
  });

  it("no Redline table has a column for original files, credentials or tokens", () => {
    const rows = psql(`
      select c.table_name || '.' || c.column_name || ':' || c.data_type
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by 1`)
      .split("\n")
      .filter(Boolean);

    const tables = new Set(rows.map((r) => r.split(".")[0]));
    expect([...tables].sort()).toEqual(["account_settings", "documents", "red_lines", "reviews"]);

    for (const row of rows) {
      const [, rest] = row.split(".");
      const [column, type] = rest.split(":");
      expect(["bytea", "oid"], row).not.toContain(type);
      expect(column, row).not.toMatch(/file|blob|binary|token|credential|session|secret|password|cookie|api_key/i);
    }
  });

  it("no storage bucket exists for uploaded files", async () => {
    // Needs the storage service running, so the check cannot pass vacuously.
    expect(psql("select to_regclass('storage.buckets') is not null")).toBe("t");
    expect(psql("select count(*) from storage.buckets")).toBe("0");
    const { data, error } = await admin.storage.listBuckets();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("RLS is on and forced for every Redline table, and anon holds no privileges", () => {
    const rls = psql(`
      select relname || ':' || relrowsecurity || ':' || relforcerowsecurity
      from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1`);
    expect(rls.split("\n")).toEqual([
      "account_settings:true:true",
      "documents:true:true",
      "red_lines:true:true",
      "reviews:true:true",
    ]);

    const anonGrants = psql(`
      select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'`);
    expect(anonGrants).toBe("0");

    const truncate = psql(`
      select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')`);
    expect(truncate).toBe("0");
  });
});
