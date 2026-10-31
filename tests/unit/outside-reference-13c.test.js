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
    "1. Nothing here is subject to any other law for the time being in force.",
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
    const text = "1. Nothing here is subject to any other law for the time being in force.";
    const stored = { summary: "A summary.", flags: [], withheld: [], withheld_count: 0, red_lines: DEFAULT_RED_LINES, outside_references: [{ kinds: ["as-amended"], label: "for the time being in force", source_sentences: [text], reviewed: true, reviewed_at: AT, referenced_document_id: null }] };
    const r = reopenReview({ documentText: text, stored });
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity, o.reviewed])).toEqual([[["other"], "negotiate", { at: AT }]]);
  });

  it("keeps a model Red line 3 flag that cites only a general-law sentence", async () => {
    const text = "1. Nothing here is subject to any other law for the time being in force.";
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

describe("security review of 43/44: the exemptions fail closed", () => {
  it.each([
    "1. The Customer will follow the Provider's policies and applicable laws for the time being in force.",
    "1. The Customer will follow the Provider's rules or any law for the time being in force.",
    "1. The Customer will follow the Supplier Handbook and laws for the time being in force.",
    "1. The Customer will follow Provider Group Policy and all applicable laws as amended from time to time.",
  ])("general law joined to another noun keeps Red line 3: %s", (text) => {
    expect(findOutsideReferences(text).found.map((f) => f.kinds)).toEqual([["as-amended"]]);
  });

  it("general law may still use and/or after its first modifier", () => {
    expect(findOutsideReferences("1. Each party will follow any and all laws for the time being in force.").found.map((f) => f.kinds)).toEqual([["other"]]);
  });

  it.each([
    "1. The Customer will follow the Acme Services Act for the time being in force.",
    "1. The Customer will follow the Platform Usage Act as amended from time to time.",
    "1. The Customer will follow the Shops Act for the time being in force.",
  ])("an undated Act not on the list keeps Red line 3: %s", (text) => {
    expect(findOutsideReferences(text).found.map((f) => f.kinds)).toEqual([["as-amended"]]);
  });

  it.each([
    "1. The tenant will follow the Maharashtra Rent Control Act for the time being in force.",
    "1. Each party will follow the Indian Contract Act as amended from time to time.",
    "1. Tax is payable under the Central Goods and Services Tax Act for the time being in force.",
    "1. Each party will follow the Micro, Small and Medium Enterprises Development Act as amended from time to time.",
    "1. Each party will follow the Arbitration and Conciliation Act for the time being in force.",
  ])("a known undated Act, with a state or other prefix, is exempt: %s", (text) => {
    expect(findOutsideReferences(text).found.map((f) => f.kinds)).toEqual([["other"]]);
  });

  it("a known Act name with a party possessive before it keeps Red line 3", () => {
    expect(findOutsideReferences("1. The Customer will follow the Provider's Companies Act for the time being in force.").found.map((f) => f.kinds)).toEqual([["as-amended"]]);
  });

  const CONTRACT = "SUPPLY AGREEMENT\n\n1. The prices are set out in the Order Form.\n";
  const OF_REF = "1. The prices are set out in the Order Form.";

  it("accepts a self-title only from the title block", async () => {
    const late = "PRICE LIST\n\n1. The Customer will pay monthly.\n2. The Customer will keep the goods dry.\n3. The fees are fixed.\n\nORDER FORM\n\n4. The Order Form sets the dates.\n";
    const r = await run(CONTRACT, { referencedDocuments: [added(late, OF_REF)] });
    expect(inR(r, R1_ID).map((o) => o.kinds)).toEqual([["order-form"]]);
    expect(selfTitled(late.split("\n"), "order-form")).toBe(false);
  });

  it("still raises a mention of another numbered Order Form", async () => {
    const text = "ORDER FORM No. 3\n\n1. This form follows Order Form No. 3 and the Order Form above.\n2. The discount in Order Form No. 5 applies.\n";
    const r = await run(CONTRACT, { referencedDocuments: [added(text, OF_REF)] });
    const refs = inR(r, R1_ID);
    expect(refs.map((o) => o.kinds)).toEqual([["order-form"]]);
    expect(refs[0].sourceSentences.map((s) => s.text)).toEqual(["2. The discount in Order Form No. 5 applies."]);
  });

  it("raises a numbered mention under an unnumbered heading", async () => {
    const text = "ORDER FORM\n\n1. The discount in Order Form No. 5 applies.\n";
    const r = await run(CONTRACT, { referencedDocuments: [added(text, OF_REF)] });
    expect(inR(r, R1_ID).map((o) => o.kinds)).toEqual([["order-form"]]);
  });

  it("stays fast on a long adversarial run before an Act", () => {
    for (const filler of ["Maharashtra ".repeat(5000), "Rent Control ".repeat(5000), "and applicable ".repeat(5000)]) {
      const t = performance.now();
      findOutsideReferences(`${filler}Act for the time being in force.`);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});

describe("security review 3: tighter exemptions", () => {
  const kinds = (text) => findOutsideReferences(text).found.map((f) => f.kinds);
  it.each([
    "1. The Customer will follow the Acme Companies Act for the time being in force.",
    "1. The Customer will follow the Platform Rent Control Act as amended from time to time.",
    "1. The Customer will follow the Provider Registration Act for the time being in force.",
  ])("an extra capitalised word before a known Act keeps Red line 3: %s", (text) => {
    expect(kinds(text)).toEqual([["as-amended"]]);
  });

  it.each([
    "1. The Customer will follow the Provider Policy, applicable laws for the time being in force.",
    "1. The Customer will follow the Handbook; any law for the time being in force.",
    "1. The Customer will follow the Handbook / applicable laws for the time being in force.",
    "1. The Customer will follow Provider Directions applicable laws for the time being in force.",
    "1. The Customer will follow the policies applicable laws for the time being in force.",
  ])("general law not starting a clause keeps Red line 3: %s", (text) => {
    expect(kinds(text)).toEqual([["as-amended"]]);
  });

  it.each([
    "Applicable laws for the time being in force govern this agreement.",
    "1. Each party will comply with applicable laws for the time being in force.",
    "1. Each party is subject to any law for the time being in force.",
    "1. Fees are payable as per applicable laws for the time being in force.",
  ])("general law starting a clause is exempt: %s", (text) => {
    expect(kinds(text)).toEqual([["other"]]);
  });

  const CONTRACT = "SUPPLY AGREEMENT\n\n1. The prices are set out in the Order Form.\n";
  const OF_REF = "1. The prices are set out in the Order Form.";
  const inR1 = async (text) => inR(await run(CONTRACT, { referencedDocuments: [added(text, OF_REF)] }), R1_ID);

  it("raises a bare mention under a numbered heading unless it points at itself", async () => {
    expect((await inR1("ORDER FORM No. 3\n\n1. The fees in the Order Form apply.\n")).map((o) => o.kinds)).toEqual([["order-form"]]);
    expect(await inR1("ORDER FORM No. 3\n\n1. The fees in this Order Form apply.\n2. The Order Form above is final.\n3. The Order Form herein binds both.\n")).toEqual([]);
  });

  it.each(["other", "prior", "previous", "each", "any", "every", "separate", "additional", "further", "future"])(
    "raises a mention qualified by %s",
    async (q) => {
      expect((await inR1(`ORDER FORM\n\n1. The fees in ${q === "each" || q === "every" || q === "any" ? "" : "the "}${q} Order Form apply.\n`)).map((o) => o.kinds)).toEqual([["order-form"]]);
    },
  );

  it("raises a mention qualified by dated or signed", async () => {
    expect((await inR1("ORDER FORM\n\n1. The fees in the Order Form dated 1 May 2026 apply.\n")).map((o) => o.kinds)).toEqual([["order-form"]]);
    expect((await inR1("ORDER FORM\n\n1. The fees in the signed Order Form apply.\n")).map((o) => o.kinds)).toEqual([["order-form"]]);
  });
});


describe("security review 4: one strict clause-start gate for both exemptions", () => {
  const kinds = (text) => findOutsideReferences(text).found.map((f) => f.kinds);
  const keepsRedLine3 = [
    // A wrapped line is not a clause start.
    "1. Each party will follow the Provider policies\nany law for the time being in force.",
    // A full stop after an abbreviation does not end a sentence.
    "1. Each party will follow the rules of Acme Pvt. Ltd. laws for the time being in force.",
    "1. Each party will follow M/s Acme Co. any law for the time being in force.",
    // A join before an undated known Act.
    "1. Each party will follow the Provider policies and the Companies Act as amended from time to time.",
    "1. Each party will follow the Provider policies or Companies Act as amended from time to time.",
    "1. Each party will follow the Provider policies & the Registration Act for the time being in force.",
    "1. Each party will follow the Provider policies, the Companies Act as amended from time to time.",
  ];
  for (const text of keepsRedLine3) {
    it(`keeps the Red line 3 match: ${JSON.stringify(text.slice(30, 90))}`, () => {
      expect(kinds(text)).toEqual([["as-amended"]]);
    });
  }

  const stillExempt = [
    "1. Each party will comply with the Companies Act as amended from time to time.",
    "Payment is due monthly. Any law for the time being in force applies to late payment.",
    "1. The fee is fixed.\n(b) any law for the time being in force applies.",
  ];
  for (const text of stillExempt) {
    it(`still exempt: ${JSON.stringify(text.slice(0, 70))}`, () => {
      expect(kinds(text)).toEqual([["other"]]);
    });
  }
});
