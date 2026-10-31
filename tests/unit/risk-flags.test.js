import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { review, SEVERITIES } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { normalise } from "../../lib/review/normalise.js";
import { findBannedWording } from "../../lib/review/wording.js";
import {
  PASTED_LEASE_01,
  PASTED_LEASE_01_ALTERED,
  PASTED_LEASE_01_FOUND,
} from "../../fixtures/contracts/pasted-lease-01.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const vendorFlags = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags;
const markedText = read("fixtures/contracts/marked-wording-01.txt");

const flag = (sourceSentences, extra = {}) => ({
  severity: "know-this",
  title: "A clause",
  says: "The clause says this.",
  judgment: null,
  sourceSentences,
  ...extra,
});

async function run(documentText, riskFlags) {
  const reply = JSON.stringify({ summary: "A summary.", riskFlags });
  return review({ documentText, redLines: [], adapter: createFakeAdapter({ responses: [reply] }) });
}

// Every displayed Source sentence is a span of the stored text, not just something that matches it.
function expectEverySourceInDocument(result, documentText) {
  for (const f of result.riskFlags) {
    for (const s of f.sourceSentences) {
      expect(documentText.slice(s.start, s.end)).toBe(s.text);
    }
  }
}

describe("Review seam: Risk flags from the scripted vendor agreement", () => {
  it("shows only the flags whose every Source sentence is in the document, and counts the rest", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });

    expect(result.riskFlagsStatus).toBe("checked");
    expect(result.riskFlags).toHaveLength(6);
    expect(result.withheldCount).toBe(5);
    expect(result.withheld).toHaveLength(result.withheldCount);
    expect(result.withheld.map((w) => w.reason)).toEqual(Array(5).fill("source-not-found"));
    expectEverySourceInDocument(result, vendorText);
  });

  it("never returns a withheld flag's text anywhere in the review", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    const out = JSON.stringify(result);
    for (const f of vendorFlags.slice(6)) {
      expect(out).not.toContain(f.title);
      for (const s of f.sourceSentences.filter((q) => !normalise(vendorText).includes(normalise(q)))) {
        expect(out).not.toContain(s);
      }
    }
    expect(out).not.toContain("sixty");
    expect(out).not.toContain("personally");
    expect(out).not.toContain("suspend");
  });

  it("groups flags by Severity in the fixed order, and in document order inside a group", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });

    expect(result.riskFlags.map((f) => f.severity)).toEqual([
      "dont-sign-as-written",
      "dont-sign-as-written",
      "negotiate",
      "negotiate",
      "know-this",
      "know-this",
    ]);
    // The script lists them out of document order; Review puts each group in document order.
    expect(result.riskFlags.map((f) => f.title.text)).toEqual([
      "Paying out the rest of the term to leave early",
      "Liability capped at one month's fee",
      "Two-year renewal unless notice is given ninety days ahead",
      "Indemnity for the condition of the premises",
      "Fee rises at each renewal",
      "Late payment interest",
    ]);
    expect(result.riskFlags.map((f) => f.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("checks and shows each of a flag's several Source sentences", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    const renewal = result.riskFlags.find((f) => f.title.text.startsWith("Two-year renewal"));
    expect(renewal.sourceSentences.map((s) => s.text)).toEqual([
      "This Agreement starts on 1 December 2026 and runs for two years.",
      "It renews automatically for further two-year terms unless Customer gives written notice at least ninety days before the end of a term.",
    ]);
  });

  it("labels every Market standard or unusualness claim Redline's judgment", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    const exit = result.riskFlags.find((f) => f.title.text.startsWith("Paying out"));
    expect(exit.judgment).toMatchObject({ isJudgment: true });
    expect(exit.judgment.text).toContain("usually");
    expect(exit.says.isJudgment).toBe(false);
    for (const f of result.riskFlags) {
      if (f.judgment) expect(f.judgment.isJudgment).toBe(true);
    }
  });

  it("leaves the hedge word inside a Source sentence alone", async () => {
    const result = await review({ documentText: vendorText, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    const fee = result.riskFlags.find((f) => f.title.text === "Fee rises at each renewal");
    expect(fee.sourceSentences[0].text).toBe("Vendor may increase the monthly fee by up to 10% at each renewal.");
    expect(fee.says.marked).toEqual([]);
  });
});

describe("Review seam: the Source sentence check on pasted text", () => {
  it("finds quotes with straight quotes and plain spaces in text with curly quotes, NBSP and U+200B", async () => {
    const result = await run(PASTED_LEASE_01, PASTED_LEASE_01_FOUND.map((q) => flag([q])));
    expect(result.withheldCount).toBe(0);
    expect(result.riskFlags).toHaveLength(PASTED_LEASE_01_FOUND.length);
    expectEverySourceInDocument(result, PASTED_LEASE_01);
  });

  it("shows the stored span, not the model's string", async () => {
    const result = await run(PASTED_LEASE_01, [
      flag(["Tenant shall pay the Rent of Rs. 40,000 on or before the 5th day of each month."]),
      flag(["Landlord is not responsible for repairs to the Premises - Tenant pays for all of them."]),
    ]);
    const shown = result.riskFlags.map((f) => f.sourceSentences[0].text);
    expect(shown).toContain("Tenant shall pay the Rent of Rs.\u00A040,000 on or before the 5th day of each month.");
    expect(shown).toContain("Landlord is not responsible for repairs to the Premises\u200B \u2014 Tenant pays for all of them.");
  });

  for (const [name, quote] of Object.entries(PASTED_LEASE_01_ALTERED)) {
    it(`withholds a quote with ${name}`, async () => {
      const result = await run(PASTED_LEASE_01, [flag([quote])]);
      expect(result.riskFlags).toEqual([]);
      expect(result.withheldCount).toBe(1);
      expect(result.withheld).toEqual([{ reason: "source-not-found" }]);
    });
  }

  it("withholds every altered quote at once and counts each one", async () => {
    const altered = Object.values(PASTED_LEASE_01_ALTERED);
    const result = await run(PASTED_LEASE_01, [
      ...altered.map((q) => flag([q])),
      flag([PASTED_LEASE_01_FOUND[1]]),
    ]);
    expect(result.withheldCount).toBe(altered.length);
    expect(result.riskFlags).toHaveLength(1);
  });

  it("withholds a flag when one of its several Source sentences fails", async () => {
    const result = await run(PASTED_LEASE_01, [
      flag([PASTED_LEASE_01_FOUND[1], PASTED_LEASE_01_ALTERED["invented sentence"]]),
    ]);
    expect(result.riskFlags).toEqual([]);
    expect(result.withheldCount).toBe(1);
  });

  it("accepts a quote that sits in an abbreviation-heavy sentence only as the whole sentence", async () => {
    const result = await run(vendorText, [flag(["Customer will pay Vendor Rs. 18,000 per month, plus GST."])]);
    expect(result.withheldCount).toBe(0);
  });

  it("accepts a quote that ends at a single line break between pasted clauses", async () => {
    const result = await run(PASTED_LEASE_01, [flag(["Every name in this document is made up for testing Redline."])]);
    expect(result.withheldCount).toBe(0);
  });
});

describe("Review seam: flags the model got wrong", () => {
  it("withholds a flag with no Source sentence", async () => {
    const result = await run(vendorText, [flag([]), flag(undefined)]);
    expect(result.riskFlags).toEqual([]);
    expect(result.withheld).toEqual([{ reason: "no-source" }, { reason: "no-source" }]);
  });

  it("withholds a flag with a Severity outside the three levels, or with missing text", async () => {
    const good = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";
    const result = await run(vendorText, [
      flag([good], { severity: "high" }),
      flag([good], { severity: "Know this" }),
      flag([good], { title: "" }),
      flag([good], { says: 4 }),
      flag([good], { judgment: ["a list"] }),
      "a string, not a flag",
      null,
    ]);
    expect(result.riskFlags).toEqual([]);
    expect(result.withheldCount).toBe(7);
    expect(new Set(result.withheld.map((w) => w.reason))).toEqual(new Set(["unreadable"]));
  });

  it("says the flags could not be read when the list is missing, instead of showing none", async () => {
    for (const reply of ['{"summary": "A summary."}', '{"summary": "A summary.", "riskFlags": {}}', "not json"]) {
      const result = await review({
        documentText: vendorText,
        redLines: [],
        adapter: createFakeAdapter({ responses: [reply] }),
      });
      expect(result.riskFlagsStatus).toBe("unreadable-output");
      expect(result.riskFlags).toEqual([]);
      expect(result.cleanResult).toBeNull();
    }
  });

  it("keeps the summary when the flags are unreadable", async () => {
    const result = await review({
      documentText: vendorText,
      redLines: [],
      adapter: createFakeAdapter({ responses: ['{"summary": "A summary.", "riskFlags": 7}'] }),
    });
    expect(result.summary).toEqual({ status: "shown", text: "A summary.", marked: [] });
  });

  it("uses exactly the three Severity levels", () => {
    expect([...SEVERITIES]).toEqual(["dont-sign-as-written", "negotiate", "know-this"]);
  });
});

describe("Review seam: hedge words and judgment in flag text", () => {
  it("marks hedge and verdict words in a flag's title, says and judgment", async () => {
    const good = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";
    const result = await run(vendorText, [
      flag([good], { title: "Fee is fine", says: "Kesari may bill Rs. 18,000.", judgment: "The fee is safe." }),
    ]);
    const [f] = result.riskFlags;
    expect(f.title.marked.map((m) => m.phrase)).toEqual(["fine"]);
    expect(f.says.marked.map((m) => m.phrase)).toEqual(["may"]);
    expect(f.judgment.marked.map((m) => m.phrase)).toEqual(["safe"]);
  });

  it("marks the scripted hedge word in the marked-wording fixture's flag", async () => {
    const result = await review({ documentText: markedText, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    const [f] = result.riskFlags;
    expect(f.says.marked.map((m) => f.says.text.slice(m.start, m.end))).toEqual(["may"]);
    expect(findBannedWording(f.sourceSentences[0].text, { documentText: markedText })).toEqual([]);
  });

  it("labels a Market standard claim Redline's judgment even when the model puts it in what the clause says", async () => {
    const good = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";
    const result = await run(vendorText, [
      flag([good], { says: "The fee is higher than is typical for this kind of contract." }),
      flag([good], { title: "Unusual fee" }),
      flag([good], { says: "Tulsi Tiffin House pays Rs. 18,000 a month plus GST." }),
    ]);
    expect(result.riskFlags.map((f) => [f.title.isJudgment, f.says.isJudgment])).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ]);
  });

  it("does not count Market standard words quoted word for word from the document as judgment", async () => {
    const doc = "1. Rates. Customer will pay the standard rate for each visit.";
    const result = await run(doc, [
      flag(["Customer will pay the standard rate for each visit."], {
        says: 'Clause 1 reads: "Customer will pay the standard rate for each visit."',
      }),
    ]);
    expect(result.riskFlags[0].says.isJudgment).toBe(false);
  });
});
