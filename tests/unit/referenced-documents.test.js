// Referenced documents (ticket 18, ADR 0007, spec-gaps 14): the Reviewer adds the text of a document an
// Outside reference brings in. It is reviewed together with the referencing document as one review; each
// flag is checked against the text it cites alone; the reference resolves once the text is in, except a
// Red line match; and a reference inside an added text is an Outside reference like any other
// (QUESTIONS.md 36). On an Outside reference, addedDocument is the document added against it and
// referencedDocument is the added text it sits in (null for the contract), as on a flag.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { canAttachTo } from "../../lib/review/referenced.js";
import { reviewAsText } from "../../app/(app)/review/review-text.js";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const doc1 = read("fixtures/contracts/outside-references-01.txt");
const scheduleB = read("fixtures/contracts/outside-references-01.schedule-b.txt");
const SCHEDULE_B_REF = "1.4 The service levels in Schedule B apply to the services.";
const SUSPEND = "3. The Supplier can suspend the services for maintenance at any time without notice.";

// A contract whose only Outside reference is Schedule B.
const ONLY_B = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The service levels in Schedule B apply to the goods.\n3. Either party can end this Agreement by giving thirty days' written notice.\n";
const ONLY_B_REF = "2. The service levels in Schedule B apply to the goods.";
const AMENDED = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The Customer will follow the rules in the Order Form, as amended from time to time.\n";
const AMENDED_REF = "2. The Customer will follow the rules in the Order Form, as amended from time to time.";

const B = (text = scheduleB, referenceSentence = SCHEDULE_B_REF, id = "11111111-1111-4111-8111-111111111111") => ({ id, title: "SCHEDULE B", text, referenceSentence, ocrRanges: [] });

const flag = (extra) => ({ severity: "negotiate", title: "Suspension", says: "The Supplier can suspend the services.", judgment: null, sourceSentences: [SUSPEND], redLine: null, readings: null, counterOffer: null, ...extra });

function scripted(riskFlags, seen = []) {
  return createFakeAdapter({
    responses: [(prompt) => { seen.push(prompt); return JSON.stringify({ summary: "A supply agreement.", riskFlags }); }],
  });
}

const run = (documentText, riskFlags, referencedDocuments, seen) =>
  review({ documentText, redLines: DEFAULT_RED_LINES, adapter: scripted(riskFlags, seen), referencedDocuments });

describe("a review run together with a referenced document", () => {
  it("hands the model the referenced text only when there is one", async () => {
    const seen = [];
    await run(doc1, [], [], seen);
    await run(doc1, [], [B()], seen);
    expect(seen[0]).not.toContain("<referenced-document");
    expect(seen[1]).toContain('<referenced-document id="R1">');
    expect(seen[1]).toContain(SUSPEND);
    // The reply form names the key, so the model knows to give it.
    expect(seen[0]).not.toContain('"document": "main"');
    expect(seen[1]).toContain('"riskFlags": [{"document": "main", "severity"');
  });

  it("checks a flag from the referenced text against that text, and shows which document it came from", async () => {
    const r = await run(doc1, [flag({ document: "R1" })], [B()]);
    expect(r.withheldCount).toBe(0);
    expect(r.riskFlags[0].referencedDocument).toMatchObject({ id: B().id, title: "SCHEDULE B" });
    const s = r.riskFlags[0].sourceSentences[0];
    expect(scheduleB.slice(s.start, s.end)).toBe(SUSPEND);
  });

  it("withholds a flag citing the referenced sentence as if it were in the document itself", async () => {
    const r = await run(doc1, [flag({ document: "main" }), flag({})], [B()]);
    expect(r.riskFlags).toHaveLength(0);
    expect(r.withheld.map((w) => w.reason)).toEqual(["source-not-found", "source-not-found"]);
  });

  it("withholds a flag naming a text that is not in the review", async () => {
    const r = await run(doc1, [flag({ document: "R2" })], [B()]);
    expect(r.withheld.map((w) => w.reason)).toEqual(["source-not-found"]);
  });

  it("does not withhold a flag for a number that only the referenced text has", async () => {
    const says = "The only remedy for a missed level is a credit of two percent of that month's fee, below 95 percent.";
    const r = await run(doc1, [flag({ document: "R1", says, sourceSentences: ["2. If the Supplier misses that level in a month, the Customer's only remedy is a credit of two percent of that month's fee.", "1. The Supplier will keep the services available for 95 percent of each calendar month."] })], [B()]);
    expect(r.withheldCount).toBe(0);
  });

  it("lists the document's own flags first, then the referenced document's", async () => {
    const own = { ...flag({}), sourceSentences: ["3.2 Either party can end this Agreement by giving the other thirty days' written notice."], says: "Either party can end it." };
    const r = await run(doc1, [flag({ document: "R1" }), own], [B()]);
    expect(r.riskFlags.map((f) => f.referencedDocument?.id ?? null)).toEqual([null, B().id]);
  });

  it("refuses referenced text that is empty, not English or too long with the document", async () => {
    await expect(run(doc1, [], [B("  ")])).rejects.toMatchObject({ code: "empty-document" });
    await expect(run(doc1, [], [B("यह अनुसूची सेवा स्तर तय करती है और आपूर्तिकर्ता हर महीने सेवाएँ उपलब्ध रखेगा।")])).rejects.toMatchObject({ code: "not-english" });
    await expect(run(doc1, [], [B("The service level applies. ".repeat(8000))])).rejects.toMatchObject({ code: "document-too-long" });
  });
});

describe("resolving an Outside reference by adding its document", () => {
  it("resolves the reference it was added against and gives a Clean result once nothing else stands in the way", async () => {
    const before = await run(ONLY_B, [], []);
    expect(before.outsideReferences).toHaveLength(1);
    expect(cleanResultOf(before)).toBe(false);
    const after = await run(ONLY_B, [], [B(scheduleB, ONLY_B_REF)]);
    expect(after.outsideReferences[0]).toMatchObject({ resolved: true, addedDocument: { title: "SCHEDULE B" }, referencedDocument: null, reviewed: null });
    expect(cleanResultOf(after)).toBe(true);
    expect(after.cleanResult).toBe(true);
  });

  it("still gives no Clean result when the referenced text has a flag that is not Know this", async () => {
    const r = await run(ONLY_B, [flag({ document: "R1" })], [B(scheduleB, ONLY_B_REF)]);
    expect(r.outsideReferences[0].resolved).toBe(true);
    expect(cleanResultOf(r)).toBe(false);
  });

  it("leaves other references open", async () => {
    const r = await run(doc1, [], [B()]);
    expect(r.outsideReferences.filter((x) => x.resolved).map((x) => x.sourceSentences[0].text)).toEqual([SCHEDULE_B_REF]);
    expect(cleanResultOf(r)).toBe(false);
  });

  it("never resolves an \"as amended\" reference, even with the document added", async () => {
    const r = await run(AMENDED, [], [B("ORDER FORM\n\n1. The Customer will keep the goods dry.\n", AMENDED_REF)]);
    const ref = r.outsideReferences[0];
    expect(ref.addedDocument).not.toBeNull();
    expect(ref.redLineMatch).not.toBeNull();
    expect(ref.resolved).toBe(false);
    expect(cleanResultOf(r)).toBe(false);
  });

  it("blocks a Clean result when the added text brings in yet another document, as an Outside reference in that text", async () => {
    const withRef = "SCHEDULE B\nService Levels\n\n1. The service credits are set out in the Order Form.\n";
    const r = await run(ONLY_B, [], [B(withRef, ONLY_B_REF)]);
    expect(r.outsideReferences[0].resolved).toBe(true);
    expect(r.outsideReferences[1]).toMatchObject({ number: 2, referencedDocument: { id: B().id, title: "SCHEDULE B", index: 1 }, addedDocument: null, resolved: false });
    expect(r.outsideReferences[1].sourceSentences.map((s) => s.text)).toEqual(["1. The service credits are set out in the Order Form."]);
    expect(r.referencedOutsideReferences).toBeUndefined();
    expect(cleanResultOf(r)).toBe(false);
  });

  it("only lets a document be added against a reference that names one", async () => {
    const b = await run(ONLY_B, [], []);
    expect(canAttachTo(b.outsideReferences, ONLY_B_REF)).not.toBeNull();
    expect(canAttachTo(b.outsideReferences, "1. The Supplier will deliver the goods each week.")).toBeNull();
    const amendedOnly = await run("SUPPLY AGREEMENT\n\n1. The Customer will follow the delivery rules as amended from time to time.\n", [], []);
    expect(canAttachTo(amendedOnly.outsideReferences, "1. The Customer will follow the delivery rules as amended from time to time.")).toBeNull();
  });
});

describe("Copy all with a referenced document", () => {
  it("says which flag came from the added document, and that the reference was resolved by adding it", async () => {
    const r = await run(ONLY_B, [flag({ document: "R1" })], [B(scheduleB, ONLY_B_REF)]);
    const text = reviewAsText(r);
    expect(text).toContain(COPY.outside.fromReferenced("SCHEDULE B"));
    expect(text).toContain(`(${COPY.outside.addedTag})`);
    expect(text).toContain(COPY.outside.added("SCHEDULE B"));
    expect(text).not.toContain(COPY.outside.notReviewed);
  });

  it("uses the added-document note on a Clean result, never the Reviewer's-mark note alone", async () => {
    const r = await run(ONLY_B, [], [B(scheduleB, ONLY_B_REF)]);
    expect(r.cleanResult).toBe(true);
    const text = reviewAsText(r);
    expect(text).toContain(COPY.clean.outsideAdded);
    expect(text).not.toContain(COPY.clean.outsideReviewed);
  });

  it("lists references inside the added document with the others, saying which document they sit in", async () => {
    const r = await run(ONLY_B, [], [B("SCHEDULE B\nService Levels\n\n1. The service credits are set out in the Order Form.\n", ONLY_B_REF)]);
    const text = reviewAsText(r);
    expect(text).toContain(`${COPY.outside.title} (2)`);
    expect(text).toContain(COPY.outside.inAdded("SCHEDULE B"));
    expect(text).toContain("1. The service credits are set out in the Order Form.");
  });
});

describe("a saved review run with a referenced document", () => {
  it("stores which text each flag cites, and reopens the same way when the referenced text is read back", async () => {
    const r = await run(ONLY_B, [flag({ document: "R1" })], [B(scheduleB, ONLY_B_REF)]);
    const stored = toStoredReview(r);
    expect(stored.referenced_document_ids).toEqual([B().id]);
    expect(stored.flags[0].referenced_document_id).toBe(B().id);
    const reopened = reopenReview({ documentText: ONLY_B, stored, referencedDocuments: [B(scheduleB, ONLY_B_REF)] });
    expect(reopened.withheldCount).toBe(0);
    expect(reopened.riskFlags[0].sourceSentences).toEqual(r.riskFlags[0].sourceSentences);
    expect(reopened.outsideReferences[0].resolved).toBe(true);
  });

  it("withholds its flags and leaves the reference open when the referenced text can't be read back", async () => {
    const r = await run(ONLY_B, [flag({ document: "R1" })], [B(scheduleB, ONLY_B_REF)]);
    const reopened = reopenReview({ documentText: ONLY_B, stored: toStoredReview(r), referencedDocuments: [] });
    expect(reopened.riskFlags).toHaveLength(0);
    // QUESTIONS.md 37: the review lists the document, so it was removed.
    expect(reopened.withheld.map((w) => w.reason)).toEqual(["referenced-document-removed"]);
    expect(reopened.outsideReferences[0].resolved).toBe(false);
    expect(cleanResultOf(reopened)).toBe(false);
  });

  it("ignores a referenced text the stored review was not run with", async () => {
    const r = await run(ONLY_B, [], []);
    const reopened = reopenReview({ documentText: ONLY_B, stored: toStoredReview(r), referencedDocuments: [B(scheduleB, ONLY_B_REF)] });
    expect(reopened.outsideReferences[0].resolved).toBe(false);
  });
});

describe("the local fake adapter", () => {
  it("has a combined script for outside-references-01 with its Schedule B, citing Schedule B's own sentence", async () => {
    const r = await review({ documentText: doc1, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }), referencedDocuments: [B()] });
    expect(r.withheldCount).toBe(0);
    expect(r.riskFlags.map((f) => f.sourceSentences[0].text)).toEqual([SUSPEND]);
    expect(r.outsideReferences.find((x) => x.sourceSentences[0].text === SCHEDULE_B_REF).resolved).toBe(true);
  });
});
