// The Fable advisor's rulings on QUESTIONS.md 36 to 42 and the stored parties (ticket 24 part 2), all
// settled 2026-10-31, at the level of Review, reopening and the question box. What needs the database
// (the cap with nothing stored, Remove, the foreign key) is in tests/isolation/referenced-rulings.test.ts.

import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { ask } from "../../lib/review/ask.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { findOutsideReferences, marksOf, storedWithMark } from "../../lib/review/outside-references.js";
import { canAttachTo } from "../../lib/review/referenced.js";
import { reviewAsText } from "../../app/(app)/review/review-text.js";
import { COPY } from "../../app/(app)/review/copy.js";
import { charactersLeft } from "../../app/(app)/review/limits.js";

const R1_ID = "11111111-1111-4111-8111-111111111111";
const R2_ID = "22222222-2222-4222-8222-222222222222";

// A contract with two Outside references: Schedule B and an Order Form.
const TWO = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The service levels in Schedule B apply to the goods.\n3. The prices are set out in the Order Form.\n";
const B_REF = "2. The service levels in Schedule B apply to the goods.";
const OF_REF = "3. The prices are set out in the Order Form.";
const SCHEDULE_B = "SCHEDULE B\nService Levels\n\n1. The Supplier will deliver within two days of each order.\n";

const AMENDED = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The Customer will follow the rules in the Order Form, as amended from time to time.\n";
const AMENDED_REF = "2. The Customer will follow the rules in the Order Form, as amended from time to time.";
const ORDER_FORM = "ORDER FORM\n\n1. The Customer will keep the goods dry.\n";

const added = (text, referenceSentence, id = R1_ID, extra = {}) => ({ id, title: text.split("\n")[0], text, referenceSentence, ocrRanges: [], ...extra });

function scripted(reply = {}, seen = []) {
  return createFakeAdapter({
    responses: [(prompt) => { seen.push(prompt); return JSON.stringify({ summary: "A supply agreement.", riskFlags: [], ...reply }); }],
  });
}

const run = (documentText, { referencedDocuments = [], previousMarks = null, redLines = DEFAULT_RED_LINES, reply = {}, ownerParty = null } = {}) =>
  review({ documentText, redLines, adapter: scripted(reply), referencedDocuments, previousMarks, ownerParty });

const byText = (r, text) => r.outsideReferences.find((o) => o.sourceSentences.some((s) => s.text === text));

// Marks a reference on a reviewed contract, as the library does, and reopens the stored row.
function markOn(r, documentText, sentence, referencedDocuments = [], at = "2026-10-31T10:00:00.000Z", inDocumentId = null) {
  const stored = toStoredReview(r);
  const outside = storedWithMark(r.outsideReferences, sentence, true, at, null, inDocumentId);
  expect(outside).not.toBeNull();
  return reopenReview({ documentText, stored: { ...stored, outside_references: outside }, referencedDocuments });
}

describe("38: marks carry over to the next review of a saved document", () => {
  it("keeps the mark on B, with its original time, when a document is added to A", async () => {
    const first = markOn(await run(TWO), TWO, OF_REF);
    const at = byText(first, OF_REF).reviewed.at;
    const next = await run(TWO, { referencedDocuments: [added(SCHEDULE_B, B_REF)], previousMarks: marksOf(first.outsideReferences) });
    expect(byText(next, B_REF)).toMatchObject({ resolved: true, addedDocument: { id: R1_ID } });
    expect(byText(next, OF_REF)).toMatchObject({ resolved: true, reviewed: { at } });
    expect(next.cleanResult).toBe(true);
  });

  it("keeps the mark through Change (a re-run for another Owner)", async () => {
    const first = markOn(await run(TWO), TWO, OF_REF);
    const changed = await run(TWO, { ownerParty: "the Supplier", previousMarks: marksOf(first.outsideReferences) });
    expect(byText(changed, OF_REF).reviewed).toEqual({ at: "2026-10-31T10:00:00.000Z" });
    expect(byText(changed, B_REF).reviewed).toBeNull();
  });

  it("drops a mark whose reference is no longer found", async () => {
    const first = markOn(await run(TWO), TWO, OF_REF);
    const without = TWO.replace(OF_REF, "3. The prices are fixed for the term.");
    const next = await run(without, { previousMarks: marksOf(first.outsideReferences) });
    expect(next.outsideReferences.every((o) => o.reviewed === null)).toBe(true);
    expect(next.outsideReferences.map((o) => o.key)).toEqual(["schedule:schedule b"]);
  });

  it("carries a mark on an \"as amended\" reference but never resolves it", async () => {
    const first = markOn(await run(AMENDED), AMENDED, AMENDED_REF);
    expect(first.outsideReferences[0].resolved).toBe(false);
    const next = await run(AMENDED, { previousMarks: marksOf(first.outsideReferences) });
    expect(next.outsideReferences[0].reviewed).not.toBeNull();
    expect(next.outsideReferences[0].redLineMatch).not.toBeNull();
    expect(next.outsideReferences[0].resolved).toBe(false);
    expect(cleanResultOf(next)).toBe(false);
  });
});

describe("39: an \"as amended\" reference with its document added", () => {
  it("stays unresolved under Red line 3, and says both things", async () => {
    const r = await run(AMENDED, { referencedDocuments: [added(ORDER_FORM, AMENDED_REF)] });
    const ref = r.outsideReferences[0];
    expect(ref.addedDocument).not.toBeNull();
    expect(ref.resolved).toBe(false);
    expect(r.cleanResult).toBe(false);
    const text = reviewAsText(r);
    expect(text).toContain(COPY.outside.added("ORDER FORM"));
    expect(text).toContain(COPY.outside.addedStillBlocks(ref.redLineMatch.number));
    expect(text).not.toContain(COPY.outside.stillBlocks);
  });

  it("resolves once Red line 3 is off the list", async () => {
    const redLines = DEFAULT_RED_LINES.filter((l) => l.id !== "default-one-sided-changes");
    const r = await run(AMENDED, { redLines, referencedDocuments: [added(ORDER_FORM, AMENDED_REF)] });
    expect(r.outsideReferences[0]).toMatchObject({ resolved: true, redLineMatch: null });
    expect(r.cleanResult).toBe(true);
  });
});

describe("40: one cap of 200,000 characters for the contract and its added documents", () => {
  const filler = (n) => ("The Supplier will deliver the goods. ".repeat(Math.ceil(n / 37))).slice(0, n);
  it("refuses a review whose texts go over it together, and accepts one under it", async () => {
    const contract = `SUPPLY AGREEMENT\n\n${B_REF}\n${filler(150_000)}`;
    await expect(run(contract, { referencedDocuments: [added(filler(60_000), B_REF)] })).rejects.toMatchObject({ code: "document-too-long" });
    const ok = await run(contract, { referencedDocuments: [added(filler(40_000), B_REF)] });
    expect(ok.charactersUsed).toBe(contract.length + 40_000);
  });

  it("counts what is used, and says how much is left, rounded down", async () => {
    const r = await run(TWO, { referencedDocuments: [added(SCHEDULE_B, B_REF)] });
    expect(r.charactersUsed).toBe(TWO.length + SCHEDULE_B.length);
    expect(reopenReview({ documentText: TWO, stored: toStoredReview(r), referencedDocuments: [added(SCHEDULE_B, B_REF)] }).charactersUsed).toBe(r.charactersUsed);
    expect(charactersLeft(150_000)).toBe("50,000");
    expect(charactersLeft(151_999)).toBe("48,000");
    expect(charactersLeft(199_500)).toBe("500");
    expect(charactersLeft(250_000)).toBe("0");
    expect(COPY.outside.tooLongTogether(charactersLeft(151_999))).toBe(
      "This contract and its added documents can total 200,000 characters. About 48,000 are left.",
    );
  });
});

describe("42: a schedule named in an added document", () => {
  const CONTRACT = "SUPPLY AGREEMENT\n\n1. The fees in Schedule A apply.\n2. The service levels in Schedule B apply.\n\nSCHEDULE A\nFees\nThe monthly fee is Rs. 18,000.\n";
  const ADDED_B = "SCHEDULE B\nService Levels\n\n1. Credits are paid against the fees in Schedule A.\n2. Schedule C sets the support hours.\n";
  it("is not a reference when the contract has its heading", () => {
    const found = findOutsideReferences(ADDED_B, { parentText: CONTRACT }).found.map((f) => f.key);
    expect(found).toEqual(["schedule:schedule c"]);
    expect(findOutsideReferences(ADDED_B).found.map((f) => f.key)).toEqual(["schedule:schedule a", "schedule:schedule c"]);
  });

  it("never lets an added document's headings hide a reference in the contract", async () => {
    const r = await run(CONTRACT, { referencedDocuments: [added("SCHEDULE C\nSupport\n\n1. Support runs from nine to six.\n", "2. The service levels in Schedule B apply.")] });
    // The contract's Schedule B stays a reference (with its document added); C's heading is in the added text only.
    expect(r.outsideReferences.filter((o) => o.referencedDocument === null).map((o) => o.key)).toEqual(["schedule:schedule b"]);
  });

  it("does not let sibling added documents hide each other's references", async () => {
    const contract = "SUPPLY AGREEMENT\n\n1. The service levels in Schedule B apply.\n2. The support hours in Schedule C apply.\n";
    const b = added("SCHEDULE B\nService Levels\n\n1. The support desk in Schedule C answers within a day.\n", "1. The service levels in Schedule B apply.", R1_ID);
    const c = added("SCHEDULE C\nSupport\n\n1. Service credits follow Schedule B.\n", "2. The support hours in Schedule C apply.", R2_ID);
    const r = await run(contract, { referencedDocuments: [b, c] });
    const inAdded = r.outsideReferences.filter((o) => o.referencedDocument);
    expect(inAdded.map((o) => [o.referencedDocument.id, o.key])).toEqual([[R1_ID, "schedule:schedule c"], [R2_ID, "schedule:schedule b"]]);
  });
});

describe("parties are stored with the review (ticket 24 part 2)", () => {
  const LICENCE = "LICENCE AGREEMENT\n\nThis licence is between the Licensor and the Licensee.\n1. The Licensee will pay the fee each month.\n";
  const reply = { ownerParty: "the Licensee", parties: ["the Licensor", "the Licensee"] };
  it("round-trips the parties", async () => {
    const r = await run(LICENCE, { reply });
    const stored = toStoredReview(r);
    expect(stored.parties).toEqual(["the Licensor", "the Licensee"]);
    expect(reopenReview({ documentText: LICENCE, stored }).parties).toEqual(["the Licensor", "the Licensee"]);
  });

  it("drops a stored term the text no longer uses, keeps each once, and puts the Owner first when missing", () => {
    const stored = { summary: "A licence.", flags: [], withheld: [], withheld_count: 0, red_lines: [], owner_party: "the Licensee", parties: ["the Licensor", "THE LICENSOR", "the Guarantor"] };
    expect(reopenReview({ documentText: LICENCE, stored }).parties).toEqual(["the Licensee", "the Licensor"]);
  });

  it("reopens a row saved before parties were stored with the Owner alone", () => {
    const stored = { summary: "A licence.", flags: [], withheld: [], withheld_count: 0, red_lines: [], owner_party: "the Licensee", parties: [] };
    expect(reopenReview({ documentText: LICENCE, stored }).parties).toEqual(["the Licensee"]);
    expect(reopenReview({ documentText: LICENCE, stored: { ...stored, owner_party: null, parties: undefined } }).parties).toEqual([]);
  });
});

describe("41: the question box answers from the contract and the documents added to the review shown", () => {
  const LEVEL = "1. The Supplier will deliver within two days of each order.";
  const docs = [{ id: R1_ID, title: "SCHEDULE B", text: SCHEDULE_B }];
  const reply = (sources) => createFakeAdapter({ responses: [JSON.stringify({ status: "answered", answer: "Within two days of each order.", sources })] });

  it("answers a term found only in R1, with the source labelled R1", async () => {
    const seen = [];
    const adapter = createFakeAdapter({ responses: [(p) => { seen.push(p); return JSON.stringify({ status: "answered", answer: "Within two days.", sources: [{ document: "R1", text: LEVEL }] }); }] });
    const r = await ask({ documentText: TWO, question: "How fast is delivery?", adapter, referencedDocuments: docs });
    expect(seen[0]).toContain('<referenced-document id="R1">');
    expect(r.status).toBe("answered");
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]).toMatchObject({ text: LEVEL, referencedDocument: { id: R1_ID, title: "SCHEDULE B", index: 1 } });
    expect(SCHEDULE_B.slice(r.sources[0].start, r.sources[0].end)).toBe(LEVEL);
  });

  it("withholds an R1 sentence claimed as main, a bare string, or an unknown document", async () => {
    for (const sources of [[{ document: "main", text: LEVEL }], [LEVEL], [{ document: "R2", text: LEVEL }], [{ text: LEVEL }], []]) {
      expect(await ask({ documentText: TWO, question: "How fast?", adapter: reply(sources), referencedDocuments: docs })).toEqual({ status: "withheld", reason: "source-not-found" });
    }
  });

  it("checks a source from each text against its own text", async () => {
    const r = await ask({ documentText: TWO, question: "What applies?", adapter: reply([{ document: "main", text: B_REF }, { document: "R1", text: LEVEL }]), referencedDocuments: docs });
    expect(r.status).toBe("answered");
    expect(r.sources.map((s) => s.referencedDocument?.id ?? null)).toEqual([null, R1_ID]);
    expect(TWO.slice(r.sources[0].start, r.sources[0].end)).toBe(B_REF);
  });

  it("is unchanged with no added documents", async () => {
    const seen = [];
    const adapter = createFakeAdapter({ responses: [(p) => { seen.push(p); return JSON.stringify({ status: "answered", answer: "Weekly.", sources: ["1. The Supplier will deliver the goods each week."] }); }] });
    const r = await ask({ documentText: TWO, question: "How often?", adapter });
    expect(seen[0]).not.toContain("referenced-document");
    expect(seen[0]).toContain('"sources": ["...", "..."]');
    expect(r.sources[0]).not.toHaveProperty("referencedDocument");
  });
});

describe("36: references inside an added document use the same add and mark flow", () => {
  const B_WITH_OF = "SCHEDULE B\nService Levels\n\n1. The service credits are set out in the Order Form.\n";
  const CREDITS = "1. The service credits are set out in the Order Form.";
  const ONLY_B = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The service levels in Schedule B apply to the goods.\n";
  const R1 = added(B_WITH_OF, B_REF);

  it("is not Clean with an Order Form named in an added text, and is Clean once that is marked", async () => {
    const r = await run(ONLY_B, { referencedDocuments: [R1] });
    const inner = byText(r, CREDITS);
    expect(inner).toMatchObject({ number: 2, referencedDocument: { id: R1_ID, index: 1 }, severity: "negotiate", resolved: false });
    expect(r.cleanResult).toBe(false);
    const reopened = markOn(r, ONLY_B, CREDITS, [R1], undefined, R1_ID);
    expect(byText(reopened, CREDITS).resolved).toBe(true);
    expect(reopened.cleanResult).toBe(true);
    // The mark is stored with the text it sits in.
    expect(toStoredReview(reopened).outside_references.find((o) => o.source_sentences[0] === CREDITS)).toMatchObject({ referenced_document_id: R1_ID, reviewed: true });
  });

  it("drops the mark on reopen when its sentence no longer passes against that text", async () => {
    const r = await run(ONLY_B, { referencedDocuments: [R1] });
    const reopened = markOn(r, ONLY_B, CREDITS, [R1], undefined, R1_ID);
    const stored = toStoredReview(reopened);
    const changed = { ...R1, text: "SCHEDULE B\nService Levels\n\n1. The service credits are two percent.\n" };
    const again = reopenReview({ documentText: ONLY_B, stored, referencedDocuments: [changed] });
    expect(again.outsideReferences.some((o) => o.reviewed)).toBe(false);
  });

  it("adding the Order Form gives R2, resolves the reference, and checks R2's flags against R2", async () => {
    const r1 = await run(ONLY_B, { referencedDocuments: [R1] });
    expect(canAttachTo(r1.outsideReferences, CREDITS, R1_ID)).not.toBeNull();
    expect(canAttachTo(r1.outsideReferences, CREDITS, null)).toBeNull();
    const R2 = added(ORDER_FORM, CREDITS, R2_ID, { inReferencedDocumentId: R1_ID });
    const flag = { document: "R2", severity: "know-this", title: "Storage", says: "The Customer will keep the goods dry.", judgment: null, sourceSentences: ["1. The Customer will keep the goods dry."], redLine: null, readings: null, counterOffer: null };
    const seen = [];
    const r = await review({ documentText: ONLY_B, redLines: DEFAULT_RED_LINES, adapter: scripted({ riskFlags: [flag] }, seen), referencedDocuments: [R1, R2] });
    expect(seen[0]).toContain('<referenced-document id="R2">');
    expect(byText(r, CREDITS)).toMatchObject({ resolved: true, addedDocument: { id: R2_ID, index: 2 } });
    expect(r.riskFlags[0].referencedDocument).toMatchObject({ id: R2_ID });
    expect(ORDER_FORM.slice(r.riskFlags[0].sourceSentences[0].start, r.riskFlags[0].sourceSentences[0].end)).toBe("1. The Customer will keep the goods dry.");
    expect(r.withheldCount).toBe(0);
    expect(r.cleanResult).toBe(true);
    // The same flag claimed from R1 is withheld.
    const wrong = await review({ documentText: ONLY_B, redLines: DEFAULT_RED_LINES, adapter: scripted({ riskFlags: [{ ...flag, document: "R1" }] }), referencedDocuments: [R1, R2] });
    expect(wrong.withheld.map((w) => w.reason)).toEqual(["source-not-found"]);
  });

  it("keeps \"as amended\" inside an added text unresolved", async () => {
    const inner = "SCHEDULE B\nService Levels\n\n1. The Customer will follow the support rules as amended from time to time.\n";
    const r = await run(ONLY_B, { referencedDocuments: [added(inner, B_REF)] });
    const ref = byText(r, "1. The Customer will follow the support rules as amended from time to time.");
    expect(ref).toMatchObject({ severity: "dont-sign-as-written", referencedDocument: { id: R1_ID } });
    const reopened = markOn(r, ONLY_B, ref.sourceSentences[0].text, [added(inner, B_REF)], undefined, R1_ID);
    expect(reopened.outsideReferences.find((o) => o.referencedDocument)?.resolved).toBe(false);
    expect(reopened.cleanResult).toBe(false);
  });

  it("treats the same sentence in the contract and in R1 as two independent references", async () => {
    const contract = `${ONLY_B}3. The prices are set out in the Order Form.\n`;
    const same = added("SCHEDULE B\nService Levels\n\n3. The prices are set out in the Order Form.\n", B_REF);
    const r = await run(contract, { referencedDocuments: [same] });
    const both = r.outsideReferences.filter((o) => o.sourceSentences[0].text === OF_REF);
    expect(both.map((o) => o.referencedDocument?.id ?? null)).toEqual([null, R1_ID]);
    const reopened = markOn(r, contract, OF_REF, [same], undefined, R1_ID);
    const after = reopened.outsideReferences.filter((o) => o.sourceSentences[0].text === OF_REF);
    expect(after.map((o) => o.reviewed !== null)).toEqual([false, true]);
    // Marks travel by the text too.
    expect([...marksOf(reopened.outsideReferences).keys()]).toEqual([`${R1_ID}|order-form`]);
  });
});
