// The unreadable-amount rule (spec-gaps 24). The fixtures copy only the SHAPE of what the OCR engine
// returned for the five ₹ figures on validation scan S04; every digit is made up, and no sample text
// is committed.
import { describe, expect, it } from "vitest";
import {
  citesUnreadableAmount,
  findUnreadableAmounts,
  readOcrRanges,
} from "../../lib/review/unreadable-amount.js";
import { checkSources } from "../../lib/review/source-check.js";

// The five S04 ₹ figures, as shapes: "₹. 14,57,00,000/-" twice and "₹.17,19,26,000/-" became a "Z",
// "₹. 17,19,26,000/-" became "2." (a digit silently in front of the amount), and one also had its
// zeros read as the letter o.
const S04_SHAPES = [
  "Z. 31,42,00,000/-",
  "Z. 31,42,00,000/-",
  "Z.86,24,75,000/-",
  "2. 86,24,75,000/-",
  "2. 86,24,75,0oo/-",
];

describe("findUnreadableAmounts", () => {
  it.each(S04_SHAPES)("finds the S04 shape %s inside a sentence", (shape) => {
    const sentence = `The Party shall pay a sum of ${shape} (Rupees in words) to the Institute.`;
    expect(findUnreadableAmounts(sentence).length).toBeGreaterThan(0);
  });

  it.each([
    ["~ before an amount (a prior OCR layer's ₹)", "a total of ~ 4,50,000 only"],
    ["f. before an amount", "a total of f. 4,50,000 only"],
    ["a glyph with nothing between it and the amount", "a total of Z4,50,000 only"],
    ["a glyph in brackets", "the cost (Z. 4,50,000) is fixed"],
    ["a digit glyph with only a space", "a sum of 7 4,50,000 is due"],
    ["zeros read as o", "the sum of 4,50,0oo is due"],
    ["one zero read as o", "the sum of 4,50,00o is due"],
    ["a capital O in a group", "the sum of 4,5O,000 is due"],
    ["Western grouping", "a sum of Z. 4,500,000 is due"],
    ["at the start of the text", "Z. 4,50,000 is due"],
  ])("finds %s", (_, text) => {
    expect(findUnreadableAmounts(text)).toHaveLength(1);
  });

  it.each([
    ["a correctly read rupee sign", "a sum of ₹ 4,50,000 is due"],
    ["a rupee sign with a full stop", "a sum of ₹. 4,50,00,000/- is due"],
    ["Rs.", "a sum of Rs. 4,50,000/- is due"],
    ["Rs with no full stop", "a sum of Rs 4,50,000 is due"],
    ["INR", "a sum of INR 4,50,000 is due"],
    ["another currency sign", "a sum of $ 4,500,000 is due"],
    ["No.", "Receipt No. 4,50,000 refers"],
    ["an amount with no glyph", "a sum of 4,50,000 is due"],
    ["a clause number and no grouping", "under clause 2. 450 units"],
    ["a longer number", "a sum of 24,50,000 is due"],
    ["the article a", "pay a 4,50,000 deposit"],
    ["the word I", "I 4,50,000 hereby"],
    ["a closing bracket", "(as above). 4,50,000 is due"],
    ["a date", "dated 12.03.2024 and signed"],
    ["a word ending in o", "go to 4,50,000"],
    ["letters with no digit", "OO,OOO"],
  ])("does not flag %s", (_, text) => {
    expect(findUnreadableAmounts(text)).toEqual([]);
  });

  it("reports where each one starts", () => {
    const text = "first Z. 1,00,000 then 2,00,0oo end";
    expect(findUnreadableAmounts(text)).toEqual([
      { index: 6, match: "Z. 1,00,000" },
      { index: 23, match: "2,00,0oo" },
    ]);
  });
});

describe("readOcrRanges", () => {
  it("accepts ordered, separate integer pairs inside the text", () => {
    expect(readOcrRanges([[0, 4], [6, 10]], 10)).toEqual([[0, 4], [6, 10]]);
    expect(readOcrRanges(undefined, 10)).toEqual([]);
    expect(readOcrRanges([], 10)).toEqual([]);
  });

  it.each([
    ["not a list", "0-4"],
    ["a pair that is not two numbers", [[0]]],
    ["a fraction", [[0, 1.5]]],
    ["an empty range", [[3, 3]]],
    ["a range past the end", [[0, 11]]],
    ["a negative start", [[-1, 3]]],
    ["out of order", [[6, 8], [0, 4]]],
    ["touching ranges", [[0, 4], [4, 8]]],
    ["overlapping ranges", [[0, 5], [4, 8]]],
  ])("rejects %s", (_, value) => {
    expect(readOcrRanges(value, 10)).toBeNull();
  });
});

describe("citesUnreadableAmount", () => {
  const typed = "1. Payment\n\nThe Customer pays Rs. 4,50,000 on signing.";
  const scanned = "The Party shall pay Z. 31,42,00,000/- to the Institute. The term is two years.";
  const text = `${typed}\n${scanned}`;
  const ocr = [[typed.length + 1, text.length]];
  const cite = (q) => checkSources(text, [q]).sources;

  it("is true for a cited OCR sentence with an unreadable amount", () => {
    expect(citesUnreadableAmount(text, cite("The Party shall pay Z. 31,42,00,000/- to the Institute."), ocr)).toBe(true);
  });

  it("is false for an OCR sentence without one", () => {
    expect(citesUnreadableAmount(text, cite("The term is two years."), ocr)).toBe(false);
  });

  it("is false when the same shape sits in embedded text, not OCR text", () => {
    const both = `The Party shall pay Z. 31,42,00,000/- to the Institute.\n${scanned}`;
    const range = [[both.indexOf("\n") + 1, both.length]];
    const first = checkSources(both, ["The Party shall pay Z. 31,42,00,000/- to the Institute."]).sources;
    expect(first[0].start).toBe(0);
    expect(citesUnreadableAmount(both, first, range)).toBe(false);
    expect(citesUnreadableAmount(both, first, [])).toBe(false);
  });

  it("maps OCR ranges onto the NFC offsets the Source sentence check reports", () => {
    // "é" written as e + combining accent before the OCR page: NFC shortens the text by one.
    const lead = "Café Terms Apply.";
    const doc = `${lead}\n${scanned}`;
    const range = [[lead.length + 1, doc.length]];
    const src = checkSources(doc, ["The Party shall pay Z. 31,42,00,000/- to the Institute."]).sources;
    expect(src).toBeTruthy();
    expect(citesUnreadableAmount(doc, src, range)).toBe(true);
  });
});
