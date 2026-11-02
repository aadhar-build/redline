// QUESTIONS.md 45, settled by the product owner 2026-11-02. Made-up strings only.
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { findOutsideReferences } from "../../lib/review/outside-references.js";

const run = (documentText, parties) =>
  review({
    documentText,
    redLines: DEFAULT_RED_LINES,
    adapter: createFakeAdapter({ responses: [JSON.stringify({ summary: "A supply agreement.", riskFlags: [], ...(parties ? { parties } : {}) })] }),
  });
const FORCE = "for the time being in force, the Buyer will pay on time.";

describe("45: a place qualifier after general law", () => {
  it.each([
    "other applicable laws in Tamil Nadu",
    "applicable laws of the State of Maharashtra",
    "any laws within the Union Territory of Delhi",
    "all laws in the State of Uttar Pradesh",
    "applicable laws, rules and regulations in Goa",
    "applicable laws of India",
    "other laws in One Two Three Four",
  ])("stays Negotiate with no Red line 3 match and blocks Clean: %s", async (phrase) => {
    const r = await run(`1. Subject to ${phrase} ${FORCE}`);
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity, o.redLineMatch])).toEqual([[["other"], "negotiate", null]]);
    expect(cleanResultOf(r)).toBe(false);
  });

  it.each([
    ["the laws of the Provider"],
    ["the laws of Provider"],
    ["laws of Acme", ["Acme"]],
    ["applicable laws in Acme Foods", ["Acme Foods"]],
    ["laws in Provider's Territory"],
    ["laws in Acme’s Territory"],
    ["laws of Acme Private Limited"],
    ["laws of the Acme Group"],
    ["laws in the Territory of Vendor"],
    ["laws of the Company in Goa"],
    ["other laws in One Two Three Four Five"],
    ["other laws in any place"],
    ["other laws in goa"],
  ])("keeps the Red line 3 match: %s", async (phrase, parties) => {
    const r = await run(`1. Subject to ${phrase} ${FORCE}`, parties);
    expect(r.outsideReferences).toHaveLength(1);
    expect(r.outsideReferences[0].redLineMatch).not.toBeNull();
  });

  it("keeps the clause-start gate: a place qualifier does not excuse a bad lead", async () => {
    const r = await run(`1. The Vendor's other laws in Goa ${FORCE}`);
    expect(r.outsideReferences[0].redLineMatch).not.toBeNull();
  });

  it("stays fast on a long hostile run of capitalised words", () => {
    const text = `1. Subject to laws in ${"Aa ".repeat(60000)}${FORCE}`;
    const start = performance.now();
    findOutsideReferences(text);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
