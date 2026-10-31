// Referenced documents (ticket 18) against the LOCAL Supabase stack, with the local fake adapter. Each
// account signs in with its own anon-key session. It checks that:
// - adding the referenced text saves it to the same account, reviews it together with the document and
//   resolves the reference, and reopening reads both texts back;
// - another account can't read, change or delete the referenced text, can't add one against a document
//   it doesn't own, and a review row of its own naming the other account's referenced text resolves
//   nothing.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { addReferencedDocument, openSaved, saveAndReview } from "../../lib/library/library.js";
import { forReview, loadRedLines } from "../../lib/library/red-lines.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const doc1 = read("fixtures/contracts/outside-references-01.txt");
const scheduleB = read("fixtures/contracts/outside-references-01.schedule-b.txt");
const SCHEDULE_B_REF = "1.4 The service levels in Schedule B apply to the services.";

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function account(label: string): Promise<SupabaseClient> {
  const email = `referenced-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

const redLinesOf = async (db: SupabaseClient) => forReview((await loadRedLines({ db })).redLines);
const adapter = () => createLocalFakeAdapter({ root });

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("a referenced document", () => {
  it("is saved to the same account, reviewed together with the document and resolves its reference", async () => {
    const a = await account("owner");
    const { documentId } = await saveAndReview({ db: a, text: doc1, redLines: await redLinesOf(a), adapter: adapter() });
    const added = await addReferencedDocument({
      db: a, documentId: documentId!, referenceSentence: SCHEDULE_B_REF, text: scheduleB, redLines: await redLinesOf(a), adapter: adapter(),
    });
    expect(added!.saved).toBe(true);
    const { data: rows } = await a.from("referenced_documents").select("document_id, reference_sentence, extracted_text");
    expect(rows).toEqual([{ document_id: documentId, reference_sentence: SCHEDULE_B_REF, extracted_text: scheduleB }]);

    const opened = await openSaved({ db: a, documentId: documentId! });
    const ref = opened!.review!.outsideReferences.find((r: any) => r.sourceSentences[0].text === SCHEDULE_B_REF);
    expect(ref.resolved).toBe(true);
    expect(opened!.review!.riskFlags[0].referencedDocument.title).toBe("SCHEDULE B");
    expect(opened!.review!.withheldCount).toBe(0);
    expect(opened!.history).toHaveLength(2);
  });

  it("can't be read, changed, deleted or added to by another account", async () => {
    const a = await account("a");
    const b = await account("b");
    // Rows written directly with A's own session, so this test does not depend on saving a review.
    const doc = await a.from("documents").insert({ title: "Services", source_kind: "pasted", extracted_text: doc1 }).select("id").single();
    expect(doc.error).toBeNull();
    const documentId = doc.data!.id as string;
    const ins = await a.from("referenced_documents").insert({ document_id: documentId, reference_sentence: SCHEDULE_B_REF, source_kind: "pasted", extracted_text: scheduleB }).select("id").single();
    expect(ins.error).toBeNull();
    const refId = ins.data!.id;

    // B reads nothing.
    const { data: seen } = await b.from("referenced_documents").select("id, extracted_text");
    expect(seen).toEqual([]);
    // B changes and deletes nothing.
    const upd = await b.from("referenced_documents").update({ extracted_text: "changed" }).eq("id", refId).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await b.from("referenced_documents").delete().eq("id", refId).select("id");
    expect(del.data ?? []).toEqual([]);
    const { data: still } = await a.from("referenced_documents").select("extracted_text").eq("id", refId);
    expect(still).toEqual([{ extracted_text: scheduleB }]);

    // B can't attach a referenced document to A's document, directly or through the library.
    const direct = await b.from("referenced_documents").insert({ document_id: documentId, reference_sentence: SCHEDULE_B_REF, source_kind: "pasted", extracted_text: "x" });
    expect(direct.error).not.toBeNull();
    const viaLibrary = await addReferencedDocument({ db: b, documentId, referenceSentence: SCHEDULE_B_REF, text: scheduleB, redLines: await redLinesOf(b), adapter: adapter() });
    expect(viaLibrary).toBeNull();

    // A review row of B's own that names A's referenced document resolves nothing and shows none of it.
    const bDoc = await b.from("documents").insert({ title: "Services", source_kind: "pasted", extracted_text: doc1 }).select("id").single();
    const named = await b.from("reviews").insert({
      document_id: bDoc.data!.id, red_lines: [], summary: "A services agreement.",
      referenced_document_ids: [refId],
      flags: [{ severity: "negotiate", title: "Suspension", says: "The Supplier can suspend the services.", judgment: null,
        source_sentences: ["3. The Supplier can suspend the services for maintenance at any time without notice."], red_line: null, counter_offer: null, readings: null, referenced_document_id: refId }],
    });
    expect(named.error).toBeNull();
    const opened = await openSaved({ db: b, documentId: bDoc.data!.id });
    expect(opened!.review!.riskFlags).toHaveLength(0);
    expect(opened!.review!.withheld.map((w: any) => w.reason)).toContain("source-not-found");
    expect(opened!.review!.outsideReferences.every((r: any) => r.resolved === false && r.referencedDocument === null)).toBe(true);
    expect(JSON.stringify(opened!.review)).not.toContain("suspend the services");
  });

  it("is removed again when the document it was added to is deleted", async () => {
    const a = await account("cascade");
    const doc = await a.from("documents").insert({ title: "Services", source_kind: "pasted", extracted_text: doc1 }).select("id").single();
    const documentId = doc.data!.id as string;
    const ins = await a.from("referenced_documents").insert({ document_id: documentId, reference_sentence: SCHEDULE_B_REF, source_kind: "pasted", extracted_text: scheduleB });
    expect(ins.error).toBeNull();
    await a.from("documents").delete().eq("id", documentId);
    const { count } = await admin.from("referenced_documents").select("id", { count: "exact", head: true }).eq("document_id", documentId);
    expect(count).toBe(0);
  });
});
