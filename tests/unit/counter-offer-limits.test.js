import { describe, expect, it } from "vitest";
import { checkCounterOffer } from "../../lib/review/counter-offer.js";
describe("settled limits (QUESTIONS 24-26)", () => {
  it("does not check numbers written in words", () => {
    const result = checkCounterOffer("The notice period is thirty days.", new Set());
    expect(result.marked.filter((m) => m.kind === "number")).toHaveLength(0);
  });
  it("marks a 'may' copied from the contract, but not 'fine' with an amount or 'May' the month", () => {
    const marked = checkCounterOffer("Vendor may increase the monthly fee. A fine of Rs. 5,000 applies from 1 May 2026.", new Set()).marked.map((m) => m.phrase.toLowerCase());
    expect(marked).toContain("may");
    expect(marked).not.toContain("fine");
    expect(marked.filter((p) => p === "may")).toHaveLength(1);
  });
});
