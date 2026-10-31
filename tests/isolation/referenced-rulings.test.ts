// The Fable advisor's rulings on QUESTIONS.md 36 to 42 and the stored parties (2026-10-31), against the
// LOCAL Supabase stack. Each account signs in with its own anon-key session; the model is a scripted
// stand-in, so these test what the library stores and reads back, not what a model says.

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import {
  addReferencedDocument,
  askAboutSaved,
  markOutsideReference,
  openSaved,
  removeReferencedDocument,
  rerunSaved,
  saveAndReview,
} from "../../lib/library/library.js";
import { forReview, loadRedLines } from "../../lib/library/red-lines.js";

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function account(label: string): Promise<SupabaseClient> {
  const email = `rulings-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

const redLinesOf = async (db: SupabaseClient) => forReview((await loadRedLines({ db })).redLines);

// A scripted model: the same reply to every review prompt, and `answer` to every question.
function model({ riskFlags = (_: string) => [] as object[], parties = ["the Supplier", "the Customer"], answer = null as object | null, fail = false } = {}) {
  return {
    name: "redline-model-adapter:fake",
    async complete(prompt: string) {
      if (fail) return "not json";
      if (prompt.includes("<question>")) return JSON.stringify(answer ?? { status: "not-in-document" });
      return JSON.stringify({ ownerParty: "the Customer", parties, summary: "A supply agreement.", riskFlags: riskFlags(prompt) });
    },
  };
}

const TWO = "SUPPLY AGREEMENT\n\nThis agreement is between the Supplier and the Customer.\n1. The Supplier will deliver the goods each week.\n2. The service levels in Schedule B apply to the goods.\n3. The prices are set out in the Order Form.\n";
const B_REF = "2. The service levels in Schedule B apply to the goods.";
const OF_REF = "3. The prices are set out in the Order Form.";
const SCHEDULE_B = "SCHEDULE B\nService Levels\n\n1. The Supplier will deliver within two days of each order.\n";
const WRONG = "PRICE LIST\n\n1. Each crate costs the amount on the latest invoice.\n";
const B_WITH_OF = "SCHEDULE B\nService Levels\n\n1. The service credits are set out in the Order Form.\n";
const CREDITS = "1. The service credits are set out in the Order Form.";
const ORDER_DETAILS = "ORDER DETAILS\n\n1. The Customer will keep the goods dry.\n";

const flagFrom = (document: string, sentence: string, severity = "negotiate") => ({
  document, severity, title: "A term", says: sentence.replace(/^\d+\.\s*/, ""), judgment: null, sourceSentences: [sentence], redLine: null, readings: null, counterOffer: null,
});

async function saved(db: SupabaseClient, text = TWO, m = model()) {
  const { documentId } = await saveAndReview({ db, text, redLines: await redLinesOf(db), adapter: m });
  expect(documentId).not.toBeNull();
  return documentId as string;
}

const refOf = (review: any, sentence: string, inId: string | null = null) =>
  review.outsideReferences.find((r: any) => (r.referencedDocument?.id ?? null) === inId && r.sourceSentences.some((s: any) => s.text === sentence));

describe("38: marks carry over", () => {
  it("keeps B's mark with its time when a document is added to A, and through Change", async () => {
    const a = await account("marks");
    const documentId = await saved(a);
    const marked = await markOutsideReference({ db: a, documentId, sourceSentence: OF_REF, reviewed: true, now: new Date("2026-10-31T09:00:00.000Z") });
    expect(refOf(marked!.review, OF_REF).reviewed).toEqual({ at: "2026-10-31T09:00:00.000Z" });

    const added = await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: SCHEDULE_B, redLines: await redLinesOf(a), adapter: model() });
    expect(added!.saved).toBe(true);
    let opened = await openSaved({ db: a, documentId });
    expect(refOf(opened!.review, B_REF).resolved).toBe(true);
    expect(refOf(opened!.review, OF_REF)).toMatchObject({ resolved: true, reviewed: { at: "2026-10-31T09:00:00.000Z" } });
    expect(opened!.review!.cleanResult).toBe(true);

    const changed = await rerunSaved({ db: a, documentId, redLines: await redLinesOf(a), adapter: model(), ownerParty: "the Supplier" });
    expect(changed!.saved).toBe(true);
    opened = await openSaved({ db: a, documentId });
    expect(refOf(opened!.review, OF_REF).reviewed).toEqual({ at: "2026-10-31T09:00:00.000Z" });
    // The earliest review keeps its own state: no mark (it was marked after saving, on that same row).
    const earliest = opened!.history[opened!.history.length - 1];
    const first = await openSaved({ db: a, documentId, reviewId: earliest.id });
    expect(refOf(first!.review, B_REF).resolved).toBe(false);
  });
});

describe("40: one cap for the contract and its added documents", () => {
  const filler = (n: number) => "The Supplier will deliver the goods. ".repeat(Math.ceil(n / 37)).slice(0, n);
  it("refuses 150k + 60k with nothing stored, and accepts 150k + 40k", async () => {
    const a = await account("cap");
    const contract = `SUPPLY AGREEMENT\n\nThis agreement is between the Supplier and the Customer.\n${B_REF}\n${filler(150_000)}`;
    const documentId = await saved(a, contract);
    await expect(
      addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: `SCHEDULE B\n${filler(60_000)}`, redLines: await redLinesOf(a), adapter: model() }),
    ).rejects.toMatchObject({ code: "combined-too-long" });
    const { data: none } = await a.from("referenced_documents").select("id").eq("document_id", documentId);
    expect(none).toEqual([]);
    const ok = await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: `SCHEDULE B\n${filler(40_000)}`, redLines: await redLinesOf(a), adapter: model() });
    expect(ok!.saved).toBe(true);
    const opened = await openSaved({ db: a, documentId });
    expect(opened!.review!.charactersUsed).toBe(contract.length + `SCHEDULE B\n${filler(40_000)}`.length);
  });
});

describe("parties are stored", () => {
  it("round-trips the list, and another account sees none of it", async () => {
    const a = await account("parties");
    const b = await account("parties-other");
    const documentId = await saved(a);
    const opened = await openSaved({ db: a, documentId });
    expect(opened!.review!.parties).toEqual(["the Supplier", "the Customer"]);
    const { data: rows } = await a.from("reviews").select("parties").eq("document_id", documentId);
    expect(rows![0].parties).toEqual(["the Supplier", "the Customer"]);
    expect(await openSaved({ db: b, documentId })).toBeNull();
    const { data: seen } = await b.from("reviews").select("parties").eq("document_id", documentId);
    expect(seen).toEqual([]);
  });
});

describe("41: questions about the added documents", () => {
  it("answers from R1 on the latest review, and from the contract alone on the earlier one", async () => {
    const a = await account("ask");
    const b = await account("ask-other");
    const documentId = await saved(a);
    await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: SCHEDULE_B, redLines: await redLinesOf(a), adapter: model() });
    const answer = { status: "answered", answer: "Within two days.", sources: [{ document: "R1", text: "1. The Supplier will deliver within two days of each order." }] };
    const r = await askAboutSaved({ db: a, documentId, question: "How fast?", adapter: model({ answer }) });
    expect(r).toMatchObject({ status: "answered", sources: [{ referencedDocument: { title: "SCHEDULE B", index: 1 } }] });

    const { history } = (await openSaved({ db: a, documentId }))!;
    const earlier = history[history.length - 1].id;
    // The earlier review had no added documents, so the same reply names a text that isn't there.
    expect(await askAboutSaved({ db: a, documentId, reviewId: earlier, question: "How fast?", adapter: model({ answer }) })).toEqual({ status: "withheld", reason: "source-not-found" });
    expect(await askAboutSaved({ db: b, documentId, question: "How fast?", adapter: model({ answer }) })).toBeNull();
    expect(await askAboutSaved({ db: a, documentId, reviewId: randomUUID(), question: "How fast?", adapter: model({ answer }) })).toBeNull();
  });
});

describe("37: removing an added document", () => {
  it("removes the row and reopens the reference unresolved with nothing withheld; history shows the new reason", async () => {
    const a = await account("remove");
    const documentId = await saved(a);
    const flags = (p: string) => (p.includes('<referenced-document id="R1">') ? [flagFrom("R1", "1. Each crate costs the amount on the latest invoice.")] : []);
    await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: WRONG, redLines: await redLinesOf(a), adapter: model({ riskFlags: flags }) });
    const withWrong = await openSaved({ db: a, documentId });
    const wrongId = refOf(withWrong!.review, B_REF).addedDocument.id;
    expect(withWrong!.review!.riskFlags).toHaveLength(1);

    // A second Add on the same reference is still refused.
    await expect(addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: SCHEDULE_B, redLines: await redLinesOf(a), adapter: model() })).rejects.toMatchObject({ code: "already-added" });

    // A model failure keeps the row and saves nothing.
    const failed = await removeReferencedDocument({ db: a, documentId, referencedDocumentId: wrongId, redLines: await redLinesOf(a), adapter: model({ fail: true }) });
    expect(failed!.saved).toBe(false);
    const { data: kept } = await a.from("referenced_documents").select("id").eq("id", wrongId);
    expect(kept).toHaveLength(1);
    expect((await openSaved({ db: a, documentId }))!.history).toHaveLength(2);

    const removed = await removeReferencedDocument({ db: a, documentId, referencedDocumentId: wrongId, redLines: await redLinesOf(a), adapter: model() });
    expect(removed!.saved).toBe(true);
    const { data: gone } = await a.from("referenced_documents").select("id").eq("id", wrongId);
    expect(gone).toEqual([]);
    const after = await openSaved({ db: a, documentId });
    expect(refOf(after!.review, B_REF)).toMatchObject({ resolved: false, addedDocument: null });
    expect(after!.review!.withheldCount).toBe(0);
    expect(after!.review!.riskFlags).toHaveLength(0);

    // The review that had it reopens with its flag withheld for the new reason.
    const old = await openSaved({ db: a, documentId, reviewId: after!.history[1].id });
    expect(old!.review!.withheld.map((w: any) => w.reason)).toEqual(["referenced-document-removed"]);

    // Replace is Remove, then Add.
    const right = await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: SCHEDULE_B, redLines: await redLinesOf(a), adapter: model() });
    expect(right!.saved).toBe(true);
    expect(refOf((await openSaved({ db: a, documentId }))!.review, B_REF).resolved).toBe(true);
  });

  it("can't be done by another account", async () => {
    const a = await account("remove-a");
    const b = await account("remove-b");
    const documentId = await saved(a);
    await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: SCHEDULE_B, redLines: await redLinesOf(a), adapter: model() });
    const id = refOf((await openSaved({ db: a, documentId }))!.review, B_REF).addedDocument.id;
    expect(await removeReferencedDocument({ db: b, documentId, referencedDocumentId: id, redLines: [], adapter: model() })).toBeNull();
    const { data } = await a.from("referenced_documents").select("id").eq("id", id);
    expect(data).toHaveLength(1);
  });
});

describe("36: references inside an added document", () => {
  it("adds a document against a reference inside R1 as R2, and removing R1 removes R2 too", async () => {
    const a = await account("nested");
    const documentId = await saved(a);
    await addReferencedDocument({ db: a, documentId, referenceSentence: B_REF, text: B_WITH_OF, redLines: await redLinesOf(a), adapter: model() });
    let opened = await openSaved({ db: a, documentId });
    const r1 = refOf(opened!.review, B_REF).addedDocument.id;
    expect(refOf(opened!.review, CREDITS, r1)).toMatchObject({ resolved: false, referencedDocument: { id: r1 } });
    // Named in the contract, the sentence is not a reference there.
    expect(await addReferencedDocument({ db: a, documentId, referenceSentence: CREDITS, text: ORDER_DETAILS, redLines: await redLinesOf(a), adapter: model() })).toBeNull();

    const flags = (p: string) => (p.includes('<referenced-document id="R2">') ? [flagFrom("R2", "1. The Customer will keep the goods dry.", "know-this")] : []);
    const nested = await addReferencedDocument({ db: a, documentId, referenceSentence: CREDITS, inDocumentId: r1, text: ORDER_DETAILS, redLines: await redLinesOf(a), adapter: model({ riskFlags: flags }) });
    expect(nested!.saved).toBe(true);
    opened = await openSaved({ db: a, documentId });
    const inner = refOf(opened!.review, CREDITS, r1);
    expect(inner).toMatchObject({ resolved: true, addedDocument: { index: 2 } });
    expect(opened!.review!.riskFlags[0].referencedDocument).toMatchObject({ id: inner.addedDocument.id });
    expect(opened!.review!.withheldCount).toBe(0);
    const { data: rows } = await a.from("referenced_documents").select("id, in_referenced_document_id").eq("document_id", documentId);
    expect(rows!.find((r: any) => r.id === inner.addedDocument.id)!.in_referenced_document_id).toBe(r1);

    // Marking the Order Form in the contract leaves the inner one as it is, and the reverse.
    await markOutsideReference({ db: a, documentId, sourceSentence: OF_REF, reviewed: true });
    opened = await openSaved({ db: a, documentId });
    expect(opened!.review!.cleanResult).toBe(true);

    const removed = await removeReferencedDocument({ db: a, documentId, referencedDocumentId: r1, redLines: await redLinesOf(a), adapter: model() });
    expect(removed!.saved).toBe(true);
    const { data: left } = await a.from("referenced_documents").select("id").eq("document_id", documentId);
    expect(left).toEqual([]);
    opened = await openSaved({ db: a, documentId });
    // The contract's own mark carries; the removed texts' references are gone.
    expect(refOf(opened!.review, OF_REF).reviewed).not.toBeNull();
    expect(opened!.review!.outsideReferences.every((r: any) => r.referencedDocument === null)).toBe(true);
  });

  it("refuses a link to another account's added document", async () => {
    const a = await account("fk-a");
    const b = await account("fk-b");
    const aDoc = await saved(a);
    await addReferencedDocument({ db: a, documentId: aDoc, referenceSentence: B_REF, text: B_WITH_OF, redLines: await redLinesOf(a), adapter: model() });
    const aRef = refOf((await openSaved({ db: a, documentId: aDoc }))!.review, B_REF).addedDocument.id;
    const bDoc = await saved(b);
    const forged = await b.from("referenced_documents").insert({ document_id: bDoc, in_referenced_document_id: aRef, reference_sentence: CREDITS, source_kind: "pasted", extracted_text: ORDER_DETAILS });
    expect(forged.error?.code).toBe("23503");
    // And through the library, naming A's text on B's document finds no such reference.
    expect(await addReferencedDocument({ db: b, documentId: bDoc, referenceSentence: CREDITS, inDocumentId: aRef, text: ORDER_DETAILS, redLines: [], adapter: model() })).toBeNull();
  });
});
