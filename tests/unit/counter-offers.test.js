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
    expect(prompt).toContain('"counterOffer": "..."}]}');
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
        // The scripted Counter-offers for these fixtures are clean: nothing is marked.
        expect(f.counterOffer.marked).toEqual([]);
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
    expect(co.marked).toEqual([]);
  });

  it("marks a number the document does not contain, as a number", async () => {
    const { get } = await byTitle();
    const co = get("Seven days to pay").counterOffer;
    expect(co.marked).toEqual([{ phrase: "14", kind: "number", start: co.text.indexOf("14"), end: co.text.indexOf("14") + 2 }]);
  });

  it("cannot catch a new term: the insurance Counter-offer shows unmarked (a person reads for it)", async () => {
    const { get } = await byTitle();
    const co = get("No liability for damaged stock").counterOffer;
    expect(co.text).toContain("insurance");
    expect(co.marked).toEqual([]);
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
      ["99", "number"],
    ]);
  });
});
