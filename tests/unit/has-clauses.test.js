// A Clean result needs an actual clause in the stored text (ADR 0006 addendum, 2026-11-02).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasClauses } from "../../lib/review/has-clauses.js";
import { review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { COPY } from "../../app/(app)/review/copy.js";
import { reviewAsText } from "../../app/(app)/review/review-text.js";

const root = path.resolve(__dirname, "../..");
// Made up, in the shape of an e-stamp page.
const stamp = `INDIA NON JUDICIAL
Government of Nowhere
e-Stamp
Certificate No. : IN-XX000000000000
Description of Document : Article 5 Agreement or Memorandum of an agreement
Consideration Price (Rs.)
First Party MADE UP INSTITUTE
Second Party MADE UP COLLEGE
Please write or type below this line
MEMORANDUM OF UNDERSTANDING
BETWEEN
MADE UP INSTITUTE
AND
MADE UP COLLEGE
Statutory Alert:
1. The authenticity of this Stamp certificate should be verified at the website named on it.
2. The onus of checking the legitimacy is on the users of the certificate.
3. In case of any discrepancy please inform the Competent Authority.
`;
const headings = "SERVICE AGREEMENT\n\n1. Parties\n2. Term\n3. Fees\n4. Termination\n5. Governing Law\n";
const reply = JSON.stringify({ summary: "A summary.", riskFlags: [] });
const run = (documentText) => review({ documentText, redLines: DEFAULT_RED_LINES, adapter: createFakeAdapter({ responses: [reply] }) });

describe("hasClauses", () => {
  it("refuses a stamp page, headings and anything not text", () => {
    expect(hasClauses(stamp)).toBe(false);
    expect(hasClauses(headings)).toBe(false);
    expect(hasClauses("")).toBe(false);
    expect(hasClauses(null)).toBe(false);
  });
  it("accepts a numbered clause, a wrapped one and an unnumbered binding sentence", () => {
    expect(hasClauses("1. Client will pay the fee each month.")).toBe(true);
    expect(hasClauses("1. Client will pay\nthe fee each month.")).toBe(true);
    expect(hasClauses("The tenant shall keep the premises in repair.")).toBe(true);
  });
  it("does not count a loose unnumbered will", () => {
    expect(hasClauses("Thank you. We will be in touch with you soon.")).toBe(false);
  });
  it("stays fast on hostile input", () => {
    const t0 = Date.now();
    hasClauses("1 ".repeat(500_000));
    hasClauses(" ".repeat(1_000_000));
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it("passes every contract fixture that reaches a Clean result", () => {
    expect(hasClauses(fs.readFileSync(path.join(root, "fixtures/contracts/clean-agreement-01.txt"), "utf8"))).toBe(true);
  });
});

describe("no Clean result without clauses", () => {
  for (const [name, text] of [["stamp page", stamp], ["heading-only page", headings]]) {
    it(`${name}: not Clean fresh, on reopen and in Copy all, and shows the line`, async () => {
      const fresh = await run(text);
      expect(fresh.cleanResult).toBe(false);
      expect(reviewAsText(fresh)).toContain(COPY.clean.noClauses);
      const reopened = reopenReview({ documentText: text, stored: JSON.parse(JSON.stringify(toStoredReview(fresh))) });
      expect(reopened.cleanResult).toBe(false);
      expect(reviewAsText(reopened)).toContain(COPY.clean.noClauses);
    });
  }
  it("a reopened review on a real clause stays Clean and does not show the line", async () => {
    const text = fs.readFileSync(path.join(root, "fixtures/contracts/clean-agreement-01.txt"), "utf8");
    const fresh = await run(text);
    expect(fresh.cleanResult).toBe(true);
    expect(reviewAsText(fresh)).not.toContain(COPY.clean.noClauses);
    expect(reopenReview({ documentText: text, stored: JSON.parse(JSON.stringify(toStoredReview(fresh))) }).cleanResult).toBe(true);
  });
});
