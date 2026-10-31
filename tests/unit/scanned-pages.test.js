// OCR text is marked per document (QUESTIONS 18, decided by the product owner on 2026-10-31): the pages
// OCR read are checked, carried on the review, kept on reopen, and named in the note.
import { describe, expect, it } from "vitest";
import { review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { readScannedPages, scannedNote } from "../../lib/review/scanned-pages.js";
import { COPY } from "../../app/(app)/review/copy.js";

const text = "SERVICES AGREEMENT\n1. The Customer pays the Supplier within 30 days.";
const reply = JSON.stringify({ summary: "The Customer pays the Supplier within 30 days.", riskFlags: [] });
const run = (extra = {}) =>
  review({ documentText: text, redLines: [], adapter: createFakeAdapter({ responses: [reply] }), ...extra });

describe("readScannedPages", () => {
  it("accepts ascending distinct pages within the page count", () => {
    expect(readScannedPages([2, 5], 12)).toEqual({ pages: [2, 5], pageCount: 12 });
    expect(readScannedPages(undefined, null)).toEqual({ pages: [], pageCount: null });
    expect(readScannedPages([1], null)).toEqual({ pages: [1], pageCount: null });
  });
  it("refuses anything else", () => {
    for (const [pages, count] of [[[2, 2], 3], [[3, 1], 3], [[0], 3], [[4], 3], [[1.5], 3], ["1", 3], [[1], 0], [[1], "2"]]) {
      expect(readScannedPages(pages, count)).toBeNull();
    }
  });
  it("marks text with OCR ranges but no page list as scanned, page count unknown", () => {
    expect(scannedNote({ pages: [], pageCount: null }, [[0, 4]])).toEqual({ pages: null, pageCount: null });
    expect(scannedNote({ pages: [], pageCount: null }, [])).toBeNull();
  });
});

describe("Review: the scanned note", () => {
  it("is null for text OCR did not read", async () => {
    expect((await run()).scanned).toBeNull();
  });
  it("carries how many pages OCR read and of how many", async () => {
    const result = await run({ ocrRanges: [[19, text.length]], ocrPages: [2], pageCount: 2 });
    expect(result.scanned).toEqual({ pages: 1, pageCount: 2 });
  });
  it("refuses OCR pages that do not read", async () => {
    await expect(run({ ocrPages: [3], pageCount: 2 })).rejects.toMatchObject({ code: "bad-ocr-pages" });
  });
  it("shows again when the saved review is reopened, from the document's stored pages", async () => {
    const row = toStoredReview(await run({ ocrPages: [1, 2], pageCount: 2 }));
    expect(reopenReview({ documentText: text, stored: row, ocrPages: [1, 2], pageCount: 2 }).scanned).toEqual({ pages: 2, pageCount: 2 });
    expect(reopenReview({ documentText: text, stored: row }).scanned).toBeNull();
    expect(reopenReview({ documentText: text, stored: row, ocrPages: "bad" }).scanned).toEqual({ pages: null, pageCount: null });
  });
});

describe("scanned note copy", () => {
  const tail = "Redline can misread a scan, so check any word or number you rely on against the original.";
  it("names the pages", () => {
    expect(COPY.scannedNote({ pages: 3, pageCount: 3 })).toBe(`Redline read all 3 pages of this document from a scan. ${tail}`);
    expect(COPY.scannedNote({ pages: 1, pageCount: 1 })).toBe(`Redline read this one-page document from a scan. ${tail}`);
    expect(COPY.scannedNote({ pages: 2, pageCount: 12 })).toBe(`Redline read 2 of this document's 12 pages from a scan. ${tail}`);
    expect(COPY.scannedNote({ pages: 1, pageCount: null })).toBe(`Redline read 1 page of this document from a scan. ${tail}`);
    expect(COPY.scannedNote({ pages: null, pageCount: null })).toBe(`Redline read part of this document from a scan. ${tail}`);
  });
});
