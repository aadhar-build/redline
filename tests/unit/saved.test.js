// A saved review through the Review seam (ticket 10): what a review row holds, and what reopening it
// shows. Reopening takes no model adapter and re-runs the Source sentence check on the stored text.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { isSavable, reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { sourceKindFrom } from "../../lib/library/library.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const markedText = read("fixtures/contracts/marked-wording-01.txt");

const reviewOf = (documentText) => review({ documentText, redLines: [], adapter: createLocalFakeAdapter({ root }) });

// What a reviews row comes back as: the columns, through JSON, as Postgres jsonb returns them.
const asRow = (review) => JSON.parse(JSON.stringify(toStoredReview(review)));

describe("where the text came from", () => {
  it("maps Extraction's source to the stored source kind, and anything else to pasted text", () => {
    expect(sourceKindFrom("pdf")).toBe("pdf");
    expect(sourceKindFrom("docx")).toBe("docx");
    expect(sourceKindFrom("paste")).toBe("pasted");
    for (const other of [undefined, null, "", "PDF", "exe", 1, {}]) expect(sourceKindFrom(other)).toBe("pasted");
  });
});

describe("storing a review", () => {
  it("keeps the summary, each flag with the exact text of its Source sentences, and the withheld count", async () => {
    const result = await reviewOf(vendorText);
    const row = asRow(result);
    expect(row.summary).toBe(result.summary.text);
    expect(row.withheld_count).toBe(5);
    expect(row.withheld).toEqual(result.withheld);
    // Reason codes only: no model text goes into the stored entries.
    for (const w of row.withheld) expect(Object.keys(w)).toEqual(["reason"]);
    expect(row.red_lines).toEqual([]);
    expect(row.flags).toHaveLength(result.riskFlags.length);
    for (const f of row.flags) {
      expect(f.source_sentences.length).toBeGreaterThan(0);
      for (const s of f.source_sentences) expect(vendorText).toContain(s);
    }
  });

  it("refuses a review whose summary or Risk flags could not be read", async () => {
    const noFlags = await review({
      documentText: vendorText,
      adapter: createFakeAdapter({ responses: [JSON.stringify({ summary: "A summary." })] }),
    });
    expect(noFlags.riskFlagsStatus).toBe("unreadable-output");
    expect(isSavable(noFlags)).toBe(false);
    expect(() => toStoredReview(noFlags)).toThrow();

    const noSummary = await review({ documentText: vendorText, adapter: createFakeAdapter({ responses: ["not json"] }) });
    expect(isSavable(noSummary)).toBe(false);
  });
});

describe("reopening a saved review", () => {
  it("shows the same summary, flags, groups, Source sentence spans and withheld count as when it was made", async () => {
    for (const text of [vendorText, markedText]) {
      const result = await reviewOf(text);
      const reopened = reopenReview({ documentText: text, stored: asRow(result) });
      expect(reopened.summary).toEqual(result.summary);
      expect(reopened.riskFlags).toEqual(result.riskFlags);
      expect(reopened.withheldCount).toBe(result.withheldCount);
      expect(reopened.withheld).toEqual(result.withheld);
      expect(reopened.riskFlagsStatus).toBe("checked");
      expect(reopened.cleanResult).toBeNull();
    }
  });

  it("checks the stored sentences against the stored text again, and withholds one that is not there", async () => {
    const result = await reviewOf(vendorText);
    const row = asRow(result);
    const target = row.flags[0];
    // "will" becomes "will not": the kind of edit a stored row must never get past.
    target.source_sentences = [target.source_sentences[0].replace(" will ", " will not ")];
    // The edit must actually change the sentence for this test to mean anything.
    expect(vendorText).not.toContain(target.source_sentences[0]);

    const reopened = reopenReview({ documentText: vendorText, stored: row });
    expect(reopened.riskFlags).toHaveLength(result.riskFlags.length - 1);
    expect(reopened.withheldCount).toBe(result.withheldCount + 1);
    expect(reopened.withheld).toEqual([...result.withheld, { reason: "source-not-found" }]);
    for (const f of reopened.riskFlags) {
      for (const s of f.sourceSentences) expect(vendorText.slice(s.start, s.end)).toBe(s.text);
    }
  });

  it("checks against the document text it is given, not the text the review was first made from", async () => {
    const result = await reviewOf(vendorText);
    const reopened = reopenReview({ documentText: "A different document. Nothing here matches.", stored: asRow(result) });
    expect(reopened.riskFlags).toEqual([]);
    expect(reopened.withheldCount).toBe(result.withheldCount + result.riskFlags.length);
  });

  it("needs no model adapter", () => {
    expect(reopenReview.length).toBe(1);
    const reopened = reopenReview({
      documentText: "The fee is due monthly.",
      stored: { summary: "The fee is due monthly.", flags: [], withheld_count: 0, withheld: [], red_lines: [] },
    });
    expect(reopened.summary.status).toBe("shown");
  });
});
