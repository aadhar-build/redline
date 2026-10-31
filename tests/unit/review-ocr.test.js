// The unreadable-amount rule through the Review seam (spec-gaps 24, ticket 23): a Risk flag citing an
// OCR sentence with a misread amount is withheld with reason "unreadable-amount", counted, and stays
// withheld when the saved review is reopened. Amounts are made up; only the OCR shapes are real.
import { describe, expect, it } from "vitest";
import { review, ReviewInputError } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";

const typed = [
  "SERVICES AGREEMENT",
  "",
  "1. The Customer pays Rs. 4,50,000 on signing.",
  "",
  "2. Either party may end this agreement on 30 days' notice.",
].join("\n");
const scanned = [
  "3. The Customer shall pay Z. 31,42,00,000/- to the Supplier within 7 days.",
  "",
  "4. Late payment carries interest at 24% a year.",
].join("\n");
const text = `${typed}\n${scanned}`;
const ocrRanges = [[typed.length + 1, text.length]];

const flag = (sourceSentences, title = "A clause") => ({
  severity: "negotiate",
  title,
  says: "The clause sets a payment.",
  judgment: null,
  sourceSentences,
  redLine: null,
});
const reply = JSON.stringify({
  summary: "The Customer pays the Supplier, with interest on late payment.",
  riskFlags: [
    flag(["3. The Customer shall pay Z. 31,42,00,000/- to the Supplier within 7 days."], "Scanned amount"),
    flag(["4. Late payment carries interest at 24% a year."], "Interest"),
    flag(["1. The Customer pays Rs. 4,50,000 on signing."], "Typed amount"),
  ],
});
const run = (extra = {}) =>
  review({ documentText: text, redLines: [], adapter: createFakeAdapter({ responses: [reply] }), ...extra });

describe("Review: unreadable-amount", () => {
  it("withholds a flag citing an OCR sentence with an unreadable amount, and counts it", async () => {
    const result = await run({ ocrRanges });
    expect(result.riskFlags.map((f) => f.title.text)).toEqual(["Typed amount", "Interest"]);
    expect(result.withheld).toEqual([{ reason: "unreadable-amount" }]);
    expect(result.withheldCount).toBe(1);
  });

  it("shows the same flag when that text did not come from OCR", async () => {
    const result = await run();
    expect(result.riskFlags).toHaveLength(3);
    expect(result.withheld).toEqual([]);
  });

  it("refuses OCR ranges that do not fit the text", async () => {
    await expect(run({ ocrRanges: [[0, text.length + 1]] })).rejects.toBeInstanceOf(ReviewInputError);
    await expect(run({ ocrRanges: "all" })).rejects.toMatchObject({ code: "bad-ocr-ranges" });
  });

  it("stores the reason code and keeps the flag withheld on reopen", async () => {
    const result = await run({ ocrRanges });
    const row = toStoredReview(result);
    expect(row.withheld).toEqual([{ reason: "unreadable-amount" }]);
    const reopened = reopenReview({ documentText: text, stored: row, ocrRanges });
    expect(reopened.withheld).toEqual([{ reason: "unreadable-amount" }]);
    expect(reopened.riskFlags.map((f) => f.title.text)).toEqual(["Typed amount", "Interest"]);
  });

  it("applies the rule again on reopen to a stored flag that cites such a sentence", async () => {
    const shownEverything = toStoredReview(await run());
    const reopened = reopenReview({ documentText: text, stored: shownEverything, ocrRanges });
    expect(reopened.riskFlags).toHaveLength(2);
    expect(reopened.withheld).toEqual([{ reason: "unreadable-amount" }]);
  });
});
