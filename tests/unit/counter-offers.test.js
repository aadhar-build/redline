// Tickets 08 and 17: a Counter-offer on every flag, Know this included, checked for hedge words and
// numbers the document lacks, through the Review seam and the saved-review seam.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { review } from "../../lib/review/review.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const breachText = read("fixtures/contracts/counter-offers-01.txt");

const markedWords = (part) => part.marked.map((m) => part.text.slice(m.start, m.end));
// Hedge-word and number marks only, leaving out ticket 08b's new-term marks.
const ruleMarks = (part) => part.marked.filter((m) => m.kind !== "new-term");
const newTerms = (part) => part.marked.filter((m) => m.kind === "new-term").map((m) => m.phrase);

function adapterFor(reply, prompts = []) {
  return createFakeAdapter({
    responses: [
      (prompt) => {
        prompts.push(prompt);
        return JSON.stringify(reply);
      },
    ],
  });
}

const FEE = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";
const flag = (over = {}) => ({
  severity: "negotiate",
  title: "Monthly fee",
  says: "Tulsi Tiffin House pays Rs. 18,000 a month plus GST.",
  judgment: null,
  sourceSentences: [FEE],
  redLine: null,
  counterOffer: "Customer will pay Vendor Rs. 18,000 per month, plus GST, for every term.",
  ...over,
});

async function run(riskFlags, { documentText = vendorText, ownerParty = null, replyOwner = "Customer" } = {}) {
  const prompts = [];
  const result = await review({
    documentText,
    redLines: [],
    ownerParty,
    adapter: adapterFor({ ownerParty: replyOwner, parties: ["Vendor", "Customer"], summary: "A summary.", riskFlags }, prompts),
  });
  return { result, prompt: prompts[0] };
}

const reviewOf = (documentText) => review({ documentText, redLines: [], adapter: createLocalFakeAdapter({ root }) });

describe("the prompt", () => {
  it("asks for a Counter-offer on every flag, Know this included, that only restates or tightens the document", async () => {
    const { prompt } = await run([flag()]);
    expect(prompt).toContain('"counterOffer": replacement wording for the clause');
    expect(prompt).toContain('Every flag gets one, "know-this" included.');
    expect(prompt).toContain("A Counter-offer only restates or tightens terms already in the document.");
    expect(prompt).toContain("Add no term, party, right, duty, amount or period that the document does not contain.");
    expect(prompt).toContain('Write "Customer is entitled to terminate", not "Customer may terminate"');
    expect(prompt).toContain("Never use these words in your own text, Counter-offers included: may,");
    expect(prompt).toContain('"counterOffer": "...", "needsNewTerm": false, "newTermNote": null}]}');
    // Ticket 08b: what a Counter-offer is allowed to do, what it never adds, and the needsNewTerm way out.
    expect(prompt).toContain("A Counter-offer is allowed to: delete words from the clause, narrow a right");
    expect(prompt).toContain('a cure period, a consent standard such as "not unreasonably withheld", a refund, return or repayment obligation');
    expect(prompt).toContain('a cross-reference such as "the amount stated in this Agreement"');
    expect(prompt).toContain('set "needsNewTerm" to true and give "newTermNote"');
  });

  it("names the Owner the Counter-offer protects: the fixed party, or the party the model gives", async () => {
    const fixed = await run([flag()], { ownerParty: "Customer" });
    expect(fixed.prompt).toContain("It protects Customer (the Owner).");
    const open = await run([flag()]);
    expect(open.prompt).toContain('It protects the Owner, the party you give as "ownerParty".');
  });
});

describe("every flag has a Counter-offer", () => {
  const fixtures = [
    "vendor-agreement-01",
    "marked-wording-01",
    "vendor-agreement-02",
    "vendor-agreement-03",
    "commercial-lease-01",
    "client-agreement-01",
    "licence-form-01",
    "clean-agreement-01",
  ];
  for (const name of fixtures) {
    it(`in ${name}, at every Severity`, async () => {
      const result = await reviewOf(read(`fixtures/contracts/${name}.txt`));
      expect(result.riskFlags.length).toBeGreaterThan(0);
      for (const f of result.riskFlags) {
        expect(f.counterOffer?.text?.length).toBeGreaterThan(0);
        // The scripted Counter-offers for these fixtures have no hedge words or new numbers.
        expect(ruleMarks(f.counterOffer)).toEqual([]);
      }
    });
  }

  it("including Know this flags (OQ4)", async () => {
    const result = await reviewOf(vendorText);
    const know = result.riskFlags.filter((f) => f.severity === "know-this");
    expect(know.length).toBeGreaterThan(0);
    for (const f of know) expect(f.counterOffer.text.length).toBeGreaterThan(0);
  });
});

describe("the scripted breaches", () => {
  const byTitle = async () => {
    const result = await reviewOf(breachText);
    return { result, get: (t) => result.riskFlags.find((f) => f.title.text === t) };
  };

  it("shows every flag: a Counter-offer breach never withholds the flag", async () => {
    const { result } = await byTitle();
    expect(result.riskFlags).toHaveLength(5);
    expect(result.withheldCount).toBe(0);
  });

  it('marks "may" in the proposed wording', async () => {
    const { get } = await byTitle();
    const co = get("Contractor can end the agreement on three days' notice").counterOffer;
    expect(markedWords(co)).toEqual(["may"]);
    expect(co.marked[0].kind).toBeUndefined();
  });

  it('keeps the two exemptions: "fine" next to an amount and "May" the month', async () => {
    const { get } = await byTitle();
    const co = get("Daily late fee").counterOffer;
    expect(co.text).toContain("fine of Rs. 200");
    expect(co.text).toContain("1 May 2027");
    expect(ruleMarks(co)).toEqual([]);
  });

  it("marks a number the document does not contain, as a number", async () => {
    const { get } = await byTitle();
    const co = get("Seven days to pay").counterOffer;
    expect(co.marked).toEqual([{ phrase: "14", kind: "number", start: co.text.indexOf("14"), end: co.text.indexOf("14") + 2 }]);
  });

  it("marks the words of a new term: the insurance Counter-offer (ticket 08b)", async () => {
    const { get } = await byTitle();
    const co = get("No liability for damaged stock").counterOffer;
    expect(co.text).toContain("insurance");
    expect(ruleMarks(co)).toEqual([]);
    expect(newTerms(co)).toEqual(["carry insurance", "covers"]);
  });

  it("shows a flag whose Counter-offer is missing, with counterOffer null", async () => {
    const { get } = await byTitle();
    const f = get("Monthly visits from May 2027");
    expect(f.counterOffer).toBeNull();
    expect(f.sourceSentences).toHaveLength(1);
  });
});

describe("the check on Counter-offer wording", () => {
  it('marks a "may" even when the Counter-offer repeats a document sentence word for word', async () => {
    const { result } = await run([flag({ counterOffer: "Vendor may increase the monthly fee by up to 10% at each renewal." })]);
    const co = result.riskFlags[0].counterOffer;
    expect(vendorText).toContain(co.text);
    expect(markedWords(co)).toEqual(["may"]);
  });

  it("marks verdict words too", async () => {
    const { result } = await run([flag({ counterOffer: "Customer will pay Vendor Rs. 18,000 per month, which is safe." })]);
    expect(markedWords(result.riskFlags[0].counterOffer)).toEqual(["safe"]);
  });

  it("treats a missing, empty or non-text Counter-offer as none, and still shows the flag", async () => {
    const { result } = await run([
      flag({ counterOffer: undefined }),
      flag({ counterOffer: "   " }),
      flag({ counterOffer: { text: "Customer pays nothing." } }),
      flag({ counterOffer: 42 }),
    ]);
    expect(result.withheldCount).toBe(0);
    expect(result.riskFlags.map((f) => f.counterOffer)).toEqual([null, null, null, null]);
  });

  it("does not put a withheld flag's Counter-offer anywhere in the review", async () => {
    const result = await reviewOf(vendorText);
    const scripted = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags.slice(6);
    const json = JSON.stringify(result);
    for (const f of scripted) expect(json).not.toContain(f.counterOffer);
  });
});

describe("saved reviews keep the Counter-offer", () => {
  const asRow = (r) => JSON.parse(JSON.stringify(toStoredReview(r)));

  it("stores the wording only, and reopening marks it the same way", async () => {
    const result = await reviewOf(breachText);
    const row = asRow(result);
    expect(row.flags.map((f) => f.counter_offer)).toEqual(result.riskFlags.map((f) => f.counterOffer?.text ?? null));
    const reopened = reopenReview({ documentText: breachText, stored: row });
    expect(reopened.riskFlags.map((f) => f.counterOffer)).toEqual(result.riskFlags.map((f) => f.counterOffer));
  });

  it("reopens a row saved before Counter-offers existed with counterOffer null", async () => {
    const row = asRow(await reviewOf(vendorText));
    for (const f of row.flags) delete f.counter_offer;
    const reopened = reopenReview({ documentText: vendorText, stored: row });
    expect(reopened.riskFlags.length).toBe(row.flags.length);
    for (const f of reopened.riskFlags) expect(f.counterOffer).toBeNull();
  });

  it("marks a stored Counter-offer on reopen, so a stored row is not trusted", async () => {
    const row = asRow(await reviewOf(vendorText));
    row.flags[0].counter_offer = "Vendor may bill 99 rupees.";
    const reopened = reopenReview({ documentText: vendorText, stored: row });
    const co = reopened.riskFlags.find((f) => f.counterOffer?.text === "Vendor may bill 99 rupees.").counterOffer;
    expect(co.marked.map((m) => [m.phrase, m.kind ?? "word"])).toEqual([
      ["may", "word"],
      ["bill", "new-term"],
      ["99", "number"],
      ["rupees", "new-term"],
    ]);
  });

  it("keeps the needsNewTerm note through save and reopen (ticket 08b)", async () => {
    const { result } = await run([flag({ needsNewTerm: true, newTermNote: "cure period before termination" })]);
    const row = asRow(result);
    expect(row.flags[0].counter_offer_note).toBe("cure period before termination");
    const reopened = reopenReview({ documentText: vendorText, stored: row });
    expect(reopened.riskFlags[0].counterOffer).toEqual(result.riskFlags[0].counterOffer);
  });
});

describe("new terms (ticket 08b): marked, never withheld", () => {
  it("leaves wording made of the document's own words unmarked, across case and word endings", async () => {
    const { result } = await run([flag({ counterOffer: "CUSTOMER pays the Vendor's invoices within seven days; the invoiced fees are not increased." })]);
    expect(result.riskFlags[0].counterOffer.marked).toEqual([]);
  });

  it("marks content words the document never uses, joining neighbours into one phrase", async () => {
    const { result } = await run([flag({ counterOffer: "Vendor will refund the security deposit within seven days." })]);
    expect(result.withheldCount).toBe(0);
    expect(newTerms(result.riskFlags[0].counterOffer)).toEqual(["refund", "security deposit"]);
  });

  it('marks "not unreasonably withheld" and an "amount stated in this Agreement" the document lacks', async () => {
    const { result } = await run([
      flag({ counterOffer: "Customer's consent, not to be unreasonably withheld, is needed." }),
      flag({ counterOffer: "Customer will pay the amount stated in this Agreement." }),
    ]);
    expect(newTerms(result.riskFlags[0].counterOffer)).toContain("not to be unreasonably withheld");
    expect(newTerms(result.riskFlags[1].counterOffer)).toEqual(["the amount stated in this Agreement"]);
  });

  it("does not mark those phrases when the document has them", async () => {
    const doc = vendorText + "\n8. Consent. Customer's consent is not to be unreasonably withheld.\n";
    const { result } = await run([flag({ counterOffer: "Customer's consent is not to be unreasonably withheld." })], { documentText: doc });
    expect(result.riskFlags[0].counterOffer.marked).toEqual([]);
  });

  it("shows the needsNewTerm note only when needsNewTerm is true, with hedge words marked", async () => {
    const { result } = await run([
      flag({ needsNewTerm: true, newTermNote: "The document has no cure period that may apply." }),
      flag({ needsNewTerm: false, newTermNote: "cure period" }),
      flag({ needsNewTerm: true, newTermNote: "  " }),
    ]);
    const [a, b, c] = result.riskFlags.map((f) => f.counterOffer.newTermNote);
    expect(a.text).toBe("cure period that may apply");
    expect(a.marked.map((m) => m.phrase)).toEqual(["may"]);
    expect(b).toBeNull();
    expect(c).toBeNull();
  });
});
