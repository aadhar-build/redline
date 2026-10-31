// OCR text in the saved library (ticket 23), against the LOCAL Supabase stack. Checks that:
// - a PDF's OCR ranges are stored with its document, and the review uses the stored ones;
// - a flag citing an OCR sentence with an unreadable amount is withheld, stored as "unreadable-amount",
//   and stays withheld on reopen;
// - the database refuses malformed OCR ranges and still refuses unknown withheld reasons;
// - another account cannot read a document's OCR ranges.
// The amount is made up; only its OCR shape is real (spec-gaps 24).

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { openSaved, saveAndReview } from "../../lib/library/library.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function account(label: string): Promise<SupabaseClient> {
  const email = `ocr-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return client;
}

const typed = "SERVICES AGREEMENT\n\n1. The Customer pays Rs. 4,50,000 on signing.";
const scanned = "2. The Customer shall pay Z. 31,42,00,000/- to the Supplier within 7 days.\n\n3. Late payment carries interest at 24% a year.";
const text = `${typed}\n${scanned}`;
const ocrRanges = [[typed.length + 1, text.length]];

const flag = (sentence: string, title: string) => ({
  severity: "negotiate",
  title,
  says: "The clause sets a payment.",
  judgment: null,
  sourceSentences: [sentence],
  redLine: null,
});
const reply = JSON.stringify({
  summary: "The Customer pays the Supplier, with interest on late payment.",
  riskFlags: [
    flag("2. The Customer shall pay Z. 31,42,00,000/- to the Supplier within 7 days.", "Scanned amount"),
    flag("3. Late payment carries interest at 24% a year.", "Interest"),
  ],
});

let a: SupabaseClient;
let b: SupabaseClient;
let savedId = "";
let firstReview: any;

beforeAll(async () => {
  a = await account("a");
  b = await account("b");
  const result = await saveAndReview({
    db: a,
    text,
    sourceKind: "pdf",
    redLines: [],
    adapter: createFakeAdapter({ responses: [reply] }),
    ocrRanges,
    ocrPages: [2],
    pageCount: 2,
  });
  if (!result.documentId) throw new Error("the OCR document was not saved");
  savedId = result.documentId;
  firstReview = result.review;
});

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("OCR ranges and the unreadable-amount reason", () => {
  it("stores the OCR ranges with the document", async () => {
    const { data, error } = await a.from("documents").select("source_kind, ocr_ranges").eq("id", savedId).single();
    expect(error).toBeNull();
    expect(data).toEqual({ source_kind: "pdf", ocr_ranges: ocrRanges });
  });

  it("withholds the flag citing the unreadable amount and stores its reason code", async () => {
    expect(firstReview.riskFlags.map((f: any) => f.title.text)).toEqual(["Interest"]);
    expect(firstReview.withheld).toEqual([{ reason: "unreadable-amount" }]);
    const { data } = await a.from("reviews").select("withheld, withheld_count").eq("document_id", savedId).single();
    expect(data).toEqual({ withheld: [{ reason: "unreadable-amount" }], withheld_count: 1 });
  });

  it("keeps it withheld on reopen", async () => {
    const opened = await openSaved({ db: a, documentId: savedId });
    expect(opened!.review!.withheld).toEqual([{ reason: "unreadable-amount" }]);
    expect(opened!.review!.riskFlags.map((f: any) => f.title.text)).toEqual(["Interest"]);
  });

  it("does not let another account read the document or its OCR ranges", async () => {
    const { data } = await b.from("documents").select("id, ocr_ranges").eq("id", savedId);
    expect(data).toEqual([]);
    expect(await openSaved({ db: b, documentId: savedId })).toBeNull();
  });

  it.each([
    ["not a list", { start: 0 }],
    ["a pair of three", [[0, 1, 2]]],
    ["a fraction", [[0, 1.5]]],
    ["a string offset", [["0", "4"]]],
    ["an empty range", [[3, 3]]],
    ["a negative start", [[-1, 3]]],
    ["out of order", [[6, 8], [0, 4]]],
    ["touching ranges", [[0, 4], [4, 8]]],
  ])("refuses OCR ranges that are %s", async (_, value) => {
    const { error } = await a
      .from("documents")
      .insert({ title: "x", source_kind: "pdf", extracted_text: "Some text here.", ocr_ranges: value });
    expect(error).not.toBeNull();
  });

  it("defaults OCR ranges to none for other documents", async () => {
    const { data, error } = await a
      .from("documents")
      .insert({ title: "x", source_kind: "pasted", extracted_text: "Some text here." })
      .select("ocr_ranges")
      .single();
    expect(error).toBeNull();
    expect(data!.ocr_ranges).toEqual([]);
  });

  it("stores the pages OCR read, shows the scanned note, and keeps it on reopen (QUESTIONS 18)", async () => {
    const { data } = await a.from("documents").select("ocr_pages, page_count").eq("id", savedId).single();
    expect(data).toEqual({ ocr_pages: [2], page_count: 2 });
    expect(firstReview.scanned).toEqual({ pages: 1, pageCount: 2 });
    const opened = await openSaved({ db: a, documentId: savedId });
    expect(opened!.review!.scanned).toEqual({ pages: 1, pageCount: 2 });
    const { data: theirs } = await b.from("documents").select("ocr_pages").eq("id", savedId);
    expect(theirs).toEqual([]);
  });

  it("accepts both reason codes added after the first list", async () => {
    for (const reason of ["unsupported-number", "unreadable-amount"]) {
      const { error } = await a.from("reviews").insert({
        document_id: savedId, red_lines: [], summary: "s", flags: [], withheld: [{ reason }], withheld_count: 1,
      });
      expect(error).toBeNull();
    }
  });

  it.each([
    ["repeated", [1, 1], 2],
    ["past the page count", [3], 2],
    ["zero", [0], 2],
    ["a string", ["1"], 2],
  ])("refuses OCR pages that are %s", async (_, pages, count) => {
    const { error } = await a
      .from("documents")
      .insert({ title: "x", source_kind: "pdf", extracted_text: "Some text here.", ocr_pages: pages, page_count: count });
    expect(error).not.toBeNull();
  });

  it("still refuses a withheld reason that is not one of Review's codes", async () => {
    const { error } = await a.from("reviews").insert({
      document_id: savedId,
      red_lines: [],
      summary: "s",
      flags: [],
      withheld: [{ reason: "unreadable-amount-or-so" }],
      withheld_count: 1,
    });
    expect(error).not.toBeNull();
  });
});
