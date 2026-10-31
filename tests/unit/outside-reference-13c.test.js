// Ticket 13c: the Fable advisor's rulings on QUESTIONS.md 43 (an added document's own title line) and 44
// (general law "for the time being in force"), 2026-10-31. Made-up strings only.
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { findOutsideReferences, marksOf, ONE_SIDED_CHANGES_ID, selfTitled, storedWithMark } from "../../lib/review/outside-references.js";

const R1_ID = "11111111-1111-4111-8111-111111111111";
const R2_ID = "22222222-2222-4222-8222-222222222222";
const AT = "2026-10-31T10:00:00.000Z";

const scripted = (reply = {}) =>
  createFakeAdapter({ responses: [JSON.stringify({ summary: "A supply agreement.", riskFlags: [], ...reply })] });
const run = (documentText, { referencedDocuments = [], previousMarks = null, reply = {}, parties } = {}) =>
  review({ documentText, redLines: DEFAULT_RED_LINES, adapter: scripted(parties ? { ...reply, parties } : reply), referencedDocuments, previousMarks });
const added = (text, referenceSentence, id = R1_ID, extra = {}) => ({ id, title: text.split("\n")[0], text, referenceSentence, ocrRanges: [], ...extra });
const byText = (r, text) => r.outsideReferences.find((o) => o.sourceSentences.some((s) => s.text === text));
const inR = (r, id) => r.outsideReferences.filter((o) => o.referencedDocument?.id === id);

describe("44: general law and undated Acts", () => {
  const exempt = [
    "1. Notwithstanding anything contained in any law for the time being in force, the Buyer will pay on time.",
    "1. Nothing here limits any other law for the time being in force.",
    "1. Each party will follow all applicable laws, rules and regulations for the time being in force.",
    "1. Each party will follow the applicable laws of India for the\ntime being in force.",
    "1. The Lender may recover dues under the Revenue Recovery Act for the time being in force.",
    "1. Each party will follow the Companies Act as amended from time to time.",
    "1. The Shop will follow the Shops and Establishments Act and the rules made thereunder for the time being in force.",
    "1. The deed will be registered under the Registration Act, 1908 and the rules made thereunder, as amended from time to time.",
  ];
  it.each(exempt)("is Negotiate with no Red line 3 match, and Clean only once marked: %s", async (text) => {
    expect(findOutsideReferences(text).found.map((f) => f.kinds)).toEqual([["other"]]);
    const r = await run(text);
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity, o.redLineMatch])).toEqual([[["other"], "negotiate", null]]);
    expect(cleanResultOf(r)).toBe(false);
    const sentence = r.outsideReferences[0].sourceSentences[0].text;
    const reopened = reopenReview({ documentText: text, stored: { ...toStoredReview(r), outside_references: storedWithMark(r.outsideReferences, sentence, true, AT) } });
    expect(reopened.outsideReferences[0].resolved).toBe(true);
    expect(reopened.cleanResult).toBe(true);
  });

  it.each([
    ["1. The Customer will follow the rules for the time being in force of the Provider.", null],
    ["1. The Customer will follow the Provider's laws for the time being in force.", null],
    ["1. The Customer will follow the laws of the Provider for the time being in force.", null],
    ["1. The Customer will follow the Acme Act for the time being in force.", ["Acme"]],
    ["1. The Customer will follow the Service Code for the time being in force.", null],
    ["1. The Customer will follow the Provider Rules as amended from time to time.", null],
    ["1. The Customer will follow the Company's Code of Conduct as amended from time to time.", null],
    ["1. The Customer will follow the Act for the time being in force.", null],
    ["1. The Customer will follow the Regulations for the time being in force.", null],
    ["1. The Customer will follow the policies for the time being in force.", null],
  ])("stays a Red line 3 match: %s", async (text, parties) => {
    expect(findOutsideReferences(text, { parties }).found.map((f) => f.kinds)).toEqual([["as-amended"]]);
    const r = await run(text, { parties: parties ?? undefined });
    expect(r.outsideReferences.map((o) => o.severity)).toEqual(["dont-sign-as-written"]);
    expect(r.outsideReferences[0].redLineMatch).toMatchObject({ id: ONE_SIDED_CHANGES_ID });
  });

  it("groups into the web address in the same sentence", async () => {
    const r = await run("1. The Customer will comply with applicable laws for the time being in force and the policy at www.example.com.");
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity])).toEqual([[["web-address"], "negotiate"]]);
  });

  it("reopens a stored as-amended row as one reference of kind other, keeping the mark", () => {
    const text = "1. Nothing here limits any other law for the time being in force.";
    const stored = { summary: "A summary.", flags: [], withheld: [], withheld_count: 0, red_lines: DEFAULT_RED_LINES, outside_references: [{ kinds: ["as-amended"], label: "for the time being in force", source_sentences: [text], reviewed: true, reviewed_at: AT, referenced_document_id: null }] };
    const r = reopenReview({ documentText: text, stored });
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity, o.reviewed])).toEqual([[["other"], "negotiate", { at: AT }]]);
  });

  it("keeps a model Red line 3 flag that cites only a general-law sentence", async () => {
    const text = "1. Nothing here limits any other law for the time being in force.";
    const flag = { severity: "dont-sign-as-written", title: "Law", says: "Other law applies.", judgment: null, sourceSentences: [text], redLine: ONE_SIDED_CHANGES_ID, readings: null, counterOffer: null };
    const r = await run(text, { reply: { riskFlags: [flag] } });
    expect(r.mergedCount).toBe(0);
    expect(r.riskFlags).toHaveLength(1);
    expect(r.withheldCount).toBe(0);
  });

  it("stays fast on a long adversarial run before the phrase", () => {
    for (const filler of ["any and or the ".repeat(5000), "laws, rules ".repeat(5000), "Aa ".repeat(8000), "Act (".repeat(5000), `${"law ".repeat(4000)}x`]) {
      const t = performance.now();
      findOutsideReferences(`${filler} for the time being in force.`);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});

describe("43: an added document's own title line", () => {
  const CONTRACT = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The prices are set out in the Order Form.\n3. The work is described in the Statement of Work.\n";
  const OF_REF = "2. The prices are set out in the Order Form.";
  const SOW_REF = "3. The work is described in the Statement of Work.";
  const BODY = "1. The Customer will keep the goods dry.";
  const ORDER_FORM = `ORDER FORM\n\n${BODY}\n`;

  it("raises nothing in a self-titled Order Form, and the review is Clean", async () => {
    const only = "SUPPLY AGREEMENT\n\n1. The Supplier will deliver the goods each week.\n2. The prices are set out in the Order Form.\n";
    const r = await run(only, { referencedDocuments: [added(ORDER_FORM, OF_REF)] });
    expect(inR(r, R1_ID)).toEqual([]);
    expect(r.cleanResult).toBe(true);
  });

  it.each(["Order Form - Acme Supply", "ORDER FORM: No. 3", "STATEMENT OF WORK No. 2", "SOW 1", "Statement of Work – Phase 1"])("counts the heading %s", (h) => {
    const kind = /order/i.test(h) ? "order-form" : "statement-of-work";
    expect(selfTitled([h], kind)).toBe(true);
  });

  it.each(["The Order Form governs.", "ORDER FORM, dated 1 May 2026", "Master Order Form", "Order Form terms apply to the goods.", "Order Form and the Customer will pay the"])("does not count %s", (h) => {
    expect(selfTitled([h], "order-form")).toBe(false);
  });

  it("still raises a wrapped body line that starts with the name in an untitled text", async () => {
    const r = await run(CONTRACT, { referencedDocuments: [added("PRICE LIST\n\n1. The fee is set in the\nOrder Form and the Customer will pay the\nfee on time.\n", OF_REF)] });
    expect(inR(r, R1_ID).map((o) => o.kinds)).toEqual([["order-form"]]);
  });

  it("does not raise a body sentence in a self-titled R1, but still raises it in the contract", async () => {
    const line = "4. The Order Form sets the delivery dates.";
    const r = await run(`${CONTRACT}${line}\n`, { referencedDocuments: [added(`ORDER FORM\n\n${line}\n`, OF_REF)] });
    expect(inR(r, R1_ID)).toEqual([]);
    expect(r.outsideReferences.filter((o) => o.referencedDocument === null && o.sourceSentences.some((s) => s.text === line))).toHaveLength(1);
  });

  it("applies only to the kind the text was added against", async () => {
    const a = await run(CONTRACT, { referencedDocuments: [added(ORDER_FORM, SOW_REF)] });
    expect(inR(a, R1_ID).map((o) => o.kinds)).toEqual([["order-form"]]);
    const b = await run(CONTRACT, { referencedDocuments: [added(`STATEMENT OF WORK\n\n${BODY}\n`, OF_REF)] });
    expect(inR(b, R1_ID).map((o) => o.kinds)).toEqual([["statement-of-work"]]);
  });

  it("raises only the other kind in a self-titled text", async () => {
    const r = await run(CONTRACT, { referencedDocuments: [added("ORDER FORM\n\n1. The tasks are in the Order Form and the Statement of Work.\n", OF_REF)] });
    expect(inR(r, R1_ID).map((o) => o.kinds)).toEqual([["statement-of-work"]]);
  });

  it("still raises a web address, an unheaded schedule and as amended, at the same severities", async () => {
    const text = "ORDER FORM\n\n1. The terms at www.example.com apply.\n2. The rates in Schedule C apply.\n3. The Customer will follow the rules as amended from time to time.\n";
    const r = await run(CONTRACT, { referencedDocuments: [added(text, OF_REF)] });
    expect(inR(r, R1_ID).map((o) => [o.kinds, o.severity])).toEqual([
      [["web-address"], "negotiate"],
      [["schedule"], "negotiate"],
      [["as-amended"], "dont-sign-as-written"],
    ]);
  });

  it("nests: R2 is exempt in itself, and R1's heading exempts nothing in R2", async () => {
    const CREDITS = "1. The service credits are set out in the Order Form.";
    // R1 is the Statement of Work; its Order Form sentence gets R2, titled ORDER FORM.
    const r1 = added(`STATEMENT OF WORK\n\n${CREDITS}\n`, SOW_REF);
    const r2 = added(`ORDER FORM\n\n${BODY}\n2. The Order Form is signed by both parties.\n`, CREDITS, R2_ID, { inReferencedDocumentId: R1_ID });
    const r = await run(CONTRACT, { referencedDocuments: [r1, r2] });
    expect(inR(r, R1_ID).map((o) => [o.kinds, o.addedDocument?.id])).toEqual([[["order-form"], R2_ID]]);
    expect(inR(r, R2_ID)).toEqual([]);
    // R2 added against a SOW sentence in R1: R1's Order Form heading does not exempt R2's Order Form.
    const r1b = added(`ORDER FORM\n\n1. The tasks are in the Statement of Work.\n`, OF_REF);
    const r2b = added(`ORDER FORM\n\n${BODY}\n2. The fee is in the Order Form.\n`, "1. The tasks are in the Statement of Work.", R2_ID, { inReferencedDocumentId: R1_ID });
    const rb = await run(CONTRACT, { referencedDocuments: [r1b, r2b] });
    expect(inR(rb, R2_ID).map((o) => o.kinds)).toEqual([["order-form"]]);
  });

  it("reopens an old heading row with its mark; a re-run drops it", async () => {
    const docs = [added(ORDER_FORM, OF_REF)];
    const r = await run(CONTRACT, { referencedDocuments: docs });
    const stored = toStoredReview(r);
    stored.outside_references = [...stored.outside_references, { kinds: ["order-form"], label: "Order Form", source_sentences: ["ORDER FORM"], reviewed: true, reviewed_at: AT, referenced_document_id: R1_ID }];
    const reopened = reopenReview({ documentText: CONTRACT, stored, referencedDocuments: docs });
    expect(inR(reopened, R1_ID).map((o) => [o.kinds, o.reviewed])).toEqual([[["order-form"], { at: AT }]]);
    const changed = await run(CONTRACT, { referencedDocuments: docs, previousMarks: marksOf(reopened.outsideReferences) });
    expect(inR(changed, R1_ID)).toEqual([]);
    expect(byText(changed, OF_REF)).toBeTruthy();
  });

  it("stays fast on long adversarial lines", () => {
    const lines = ["ORDER FORM " + " ".repeat(100000) + "x", "order form".repeat(20000), "SOW " + "A".repeat(150)];
    const t = performance.now();
    selfTitled(lines, "order-form");
    selfTitled(lines, "statement-of-work");
    expect(performance.now() - t).toBeLessThan(100);
  });
});
