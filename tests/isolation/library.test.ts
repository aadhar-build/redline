// The saved library against the LOCAL Supabase stack (ticket 10). Two accounts sign in; the library
// module runs with each account's own anon-key session, as the server routes do. It checks that:
// - the review runs on the text read back from the database, and the withheld count is stored with it;
// - questions about a saved document are answered from the stored text, found by id;
// - reopening re-checks Source sentences against the stored text and never calls the model;
// - another account's document is not found through any library function.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { askAboutSaved, listDocuments, openSaved, saveAndReview } from "../../lib/library/library.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";

const root = path.resolve(__dirname, "../..");
const vendorText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const QUESTION = "How much notice does Customer need to give to stop the agreement renewing?";

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function account(label: string): Promise<SupabaseClient> {
  const email = `library-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return client;
}

// The local fake adapter, recording every prompt it is sent.
function spyAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts: string[] = [];
  return {
    prompts,
    async complete(prompt: string) {
      prompts.push(prompt);
      return inner.complete(prompt);
    },
  };
}

let a: SupabaseClient;
let b: SupabaseClient;
let savedId = "";
let firstReview: any;

beforeAll(async () => {
  a = await account("a");
  b = await account("b");
  const adapter = spyAdapter();
  const result = await saveAndReview({ db: a, text: vendorText, adapter });
  if (!result.documentId) throw new Error("the vendor agreement was not saved");
  savedId = result.documentId;
  firstReview = result.review;
});

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("saving a review", () => {
  it("stores the extracted text as sent, with a title from its first line, and nothing else of the paste", async () => {
    const { data, error } = await a.from("documents").select("title, source_kind, extracted_text").eq("id", savedId).single();
    expect(error).toBeNull();
    expect(data).toEqual({
      title: vendorText.split("\n").find((l) => l.trim())!.trim(),
      source_kind: "pasted",
      extracted_text: vendorText,
    });
  });

  it("stores the review with its withheld count, its shown flags and the Red line list it was checked against", async () => {
    const { data, error } = await a.from("reviews").select("summary, flags, withheld_count, red_lines").eq("document_id", savedId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].withheld_count).toBe(5);
    expect(data![0].withheld_count).toBe(firstReview.withheldCount);
    expect(data![0].summary).toBe(firstReview.summary.text);
    expect(data![0].flags).toHaveLength(firstReview.riskFlags.length);
    expect(data![0].red_lines).toEqual([]);
  });

  it("does not keep a document whose review could not be read in full", async () => {
    const before = await a.from("documents").select("id", { count: "exact", head: true });
    const result = await saveAndReview({
      db: a,
      text: vendorText,
      adapter: createFakeAdapter({ responses: [JSON.stringify({ summary: "A summary." })] }),
    });
    expect(result.documentId).toBeNull();
    expect(result.review.riskFlagsStatus).toBe("unreadable-output");
    const after = await a.from("documents").select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });

  it("does not keep a document when the review fails", async () => {
    const before = await a.from("documents").select("id", { count: "exact", head: true });
    await expect(
      saveAndReview({ db: a, text: "A contract the fake adapter has no script for.", adapter: createLocalFakeAdapter({ root }) }),
    ).rejects.toMatchObject({ code: "no-script" });
    const after = await a.from("documents").select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });
});

describe("the stored text is what gets checked", () => {
  it("the review prompt carries the text read back from the database", async () => {
    const adapter = spyAdapter();
    const result = await saveAndReview({ db: a, text: vendorText, adapter });
    const { data } = await a.from("documents").select("extracted_text").eq("id", result.documentId).single();
    expect(adapter.prompts).toHaveLength(1);
    expect(adapter.prompts[0]).toContain(`<document>\n${data!.extracted_text}\n</document>`);
  });

  it("a question about a saved document is answered from the row in the database, found by id", async () => {
    // A copy of the saved document whose stored text is then changed in the database. The question
    // must go to the model with the changed text, which only the database holds.
    const copy = await saveAndReview({ db: a, text: vendorText, adapter: createLocalFakeAdapter({ root }) });
    const changed = `${vendorText}\n\nSchedule. Added in the database only.`;
    const upd = await a.from("documents").update({ extracted_text: changed }).eq("id", copy.documentId).select("id");
    expect(upd.data).toHaveLength(1);

    const adapter = spyAdapter();
    const answer = await askAboutSaved({ db: a, documentId: copy.documentId, question: QUESTION, adapter });
    expect(answer).not.toBeNull();
    expect(adapter.prompts).toHaveLength(1);
    expect(adapter.prompts[0]).toContain("Schedule. Added in the database only.");
  });

  it("reopening checks every stored Source sentence against the stored text again", async () => {
    const copy = await saveAndReview({ db: a, text: vendorText, adapter: createLocalFakeAdapter({ root }) });
    const firstSentence = copy.review.riskFlags[0].sourceSentences[0].text;
    const changed = vendorText.replace(firstSentence, "This sentence was replaced in the database.");
    expect(changed).not.toBe(vendorText);
    await a.from("documents").update({ extracted_text: changed }).eq("id", copy.documentId);

    const reopened = await openSaved({ db: a, documentId: copy.documentId });
    const shown = reopened!.review!.riskFlags.flatMap((f: any) => f.sourceSentences.map((s: any) => s.text));
    expect(shown).not.toContain(firstSentence);
    expect(reopened!.review!.withheldCount).toBeGreaterThan(copy.review.withheldCount);
    for (const f of reopened!.review!.riskFlags) {
      for (const s of f.sourceSentences) expect(changed.slice(s.start, s.end)).toBe(s.text);
    }
  });
});

describe("reopening a saved document", () => {
  it("shows the review as saved, without calling the model or adding a review", async () => {
    // openSaved takes no adapter, so it has no way to re-analyse.
    const reopened = await openSaved({ db: a, documentId: savedId });
    expect(reopened!.review!.summary).toEqual(firstReview.summary);
    expect(reopened!.review!.riskFlags).toEqual(firstReview.riskFlags);
    expect(reopened!.review!.withheldCount).toBe(firstReview.withheldCount);
    const { count } = await a.from("reviews").select("id", { count: "exact", head: true }).eq("document_id", savedId);
    expect(count).toBe(1);
  });

  it("lists the account's documents, newest first, with the number of flags shown", async () => {
    const list = await listDocuments({ db: a });
    expect(list.map((d) => d.id)).toContain(savedId);
    const times = list.map((d) => d.savedAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(list.find((d) => d.id === savedId)!.flagCount).toBe(firstReview.riskFlags.length);
  });
});

describe("a second account", () => {
  it("lists none of the first account's documents", async () => {
    const list = await listDocuments({ db: b });
    expect(list).toEqual([]);
    // Positive control: the first account does see its own.
    expect((await listDocuments({ db: a })).length).toBeGreaterThan(0);
  });

  it("cannot open or ask about the first account's document by id", async () => {
    expect(await openSaved({ db: b, documentId: savedId })).toBeNull();
    const adapter = spyAdapter();
    expect(await askAboutSaved({ db: b, documentId: savedId, question: QUESTION, adapter })).toBeNull();
    expect(adapter.prompts).toEqual([]);
  });

  it("a signed-out client cannot open it either", async () => {
    await expect(openSaved({ db: anonClient(), documentId: savedId })).rejects.toMatchObject({ code: "load-failed" });
  });
});
