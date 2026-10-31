// OCR inside extraction (ticket 23) and PDFs with text on some pages only (ticket 19), through the
// readPdf seam on pdf.js's Node build. The OCR engine is a fake that returns lines for the page it is
// given, so these tests check which pages go to OCR and how the text is put together; the real engine
// runs in the browser e2e test (tests/e2e/ocr.spec.mjs).
import { describe, expect, it } from "vitest";
import { readPdf } from "../../lib/extraction/pdf.js";
import { ocrPageLines } from "../../lib/extraction/ocr-lines.js";
import { rowVariance } from "../../lib/extraction/deskew.js";
import { hiddenOcrPage, makePdf, scanPage, textPage } from "../support/make-pdf.mjs";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

// lines per page number; top as a share of the page height.
function fakeOcr(byPage) {
  const read = [];
  return {
    read,
    async readPage(page) {
      read.push(page.pageNumber);
      return byPage[page.pageNumber] ?? [];
    },
  };
}
const mid = (text) => ({ text, top: 0.5 });

describe("readPdf with OCR", () => {
  it("sends only the pages without a real text layer to OCR, and keeps embedded text elsewhere", async () => {
    const ocr = fakeOcr({ 2: [mid("The Supplier delivers the goods."), mid("Payment is due in 30 days.")] });
    const result = await readPdf(pdfjs, makePdf([textPage(["This Agreement is made on 1 May."]), scanPage(), textPage(["Signed by both parties."])]), {}, { ocr });
    expect(ocr.read).toEqual([2]);
    expect(result).toMatchObject({ kind: "text", source: "pdf", ocrPages: [2] });
    expect(result.text).toBe(
      "This Agreement is made on 1 May.\nThe Supplier delivers the goods.\nPayment is due in 30 days.\nSigned by both parties.",
    );
  });

  it("records exactly where the OCR text sits (ticket 19: a mixed PDF is accepted)", async () => {
    const ocr = fakeOcr({ 2: [mid("Page two text.")], 3: [mid("Page three text.")], 5: [mid("Page five text.")] });
    const pages = [textPage(["Typed page one."]), scanPage(), scanPage(), textPage(["Typed page four."]), scanPage()];
    const result = await readPdf(pdfjs, makePdf(pages), {}, { ocr });
    expect(result.text).toBe("Typed page one.\nPage two text.\nPage three text.\nTyped page four.\nPage five text.");
    // Pages 2 and 3 are consecutive OCR pages: one range, including the newline between them.
    expect(result.ocrRanges.map(([s, e]) => result.text.slice(s, e))).toEqual([
      "Page two text.\nPage three text.",
      "Page five text.",
    ]);
  });

  it("reads a scan's hidden OCR layer again instead of using it", async () => {
    const ocr = fakeOcr({ 1: [mid("What Redline read.")] });
    const result = await readPdf(pdfjs, makePdf([hiddenOcrPage(["What the scanner read."])]), {}, { ocr });
    expect(ocr.read).toEqual([1]);
    expect(result.text).toBe("What Redline read.");
    expect(result.ocrRanges).toEqual([[0, result.text.length]]);
  });

  it("strips running headers and page numbers from OCR pages with the same rules", async () => {
    const byPage = {};
    for (let n = 1; n <= 4; n++) {
      byPage[n] = [{ text: "ACME SERVICES LTD", top: 0.04 }, mid(`Clause ${n} applies.`), { text: `Page ${n} of 4`, top: 0.97 }];
    }
    const result = await readPdf(pdfjs, makePdf([scanPage(), scanPage(), scanPage(), scanPage()]), {}, { ocr: fakeOcr(byPage) });
    expect(result.text).toBe("Clause 1 applies.\nClause 2 applies.\nClause 3 applies.\nClause 4 applies.");
    expect(result.removed).toEqual([
      { text: "ACME SERVICES LTD", count: 4 },
      ...[1, 2, 3, 4].map((n) => ({ text: `Page ${n} of 4`, count: 1 })),
    ]);
  });

  it("rejects the PDF only when OCR also finds no text", async () => {
    const result = await readPdf(pdfjs, makePdf([scanPage(), scanPage()]), {}, { ocr: fakeOcr({}) });
    expect(result).toEqual({ kind: "rejected", reason: "no-text" });
  });

  it("reports progress per OCR page", async () => {
    const seen = [];
    await readPdf(pdfjs, makePdf([scanPage(), textPage(["Typed."]), scanPage()]), {}, {
      ocr: fakeOcr({ 1: [mid("One.")], 3: [mid("Three.")] }),
      onProgress: (p) => seen.push(p),
    });
    expect(seen).toEqual([{ done: 0, total: 2 }, { done: 1, total: 2 }, { done: 2, total: 2 }]);
  });

  it("stops OCR and rejects as too long once the text is over the limit, never sending part of it", async () => {
    const long = Array.from({ length: 10 }, (_, i) => mid(`Line ${i} of a long scanned page with plenty of words in it.`));
    const ocr = fakeOcr({ 1: long, 2: long, 3: long, 4: long });
    const result = await readPdf(pdfjs, makePdf([scanPage(), scanPage(), scanPage(), scanPage()]), {}, { ocr, maxChars: 1000 });
    expect(result).toEqual({ kind: "rejected", reason: "document-too-long" });
    expect(ocr.read).toEqual([1, 2]);
  });

  it("is cancelled by its signal with an AbortError", async () => {
    const controller = new AbortController();
    const ocr = {
      async readPage() {
        controller.abort();
        return [mid("One.")];
      },
    };
    await expect(
      readPdf(pdfjs, makePdf([scanPage(), scanPage()]), {}, { ocr, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports an OCR failure as ocr-failed", async () => {
    const ocr = {
      async readPage() {
        throw Object.assign(new Error("model failed to load"), { name: "OcrError" });
      },
    };
    expect(await readPdf(pdfjs, makePdf([scanPage()]), {}, { ocr })).toEqual({ kind: "rejected", reason: "ocr-failed" });
  });

  it("still stops at needs-ocr when no OCR engine is given", async () => {
    expect(await readPdf(pdfjs, makePdf([textPage(["Typed."]), scanPage()]))).toEqual({ kind: "needs-ocr", pages: [2], pageCount: 2 });
  });

  it("gives a text-only PDF no OCR fields", async () => {
    const result = await readPdf(pdfjs, makePdf([textPage(["Typed."])]), {}, { ocr: fakeOcr({}) });
    expect(result).toEqual({ kind: "text", source: "pdf", text: "Typed.", removed: [] });
  });
});

describe("ocrPageLines", () => {
  it("joins each line's boxes with a space and takes the line's top from its lowest box", () => {
    const result = {
      lines: [
        [{ text: "9.1.1", box: { x: 10, y: 100, width: 40, height: 20 } }, { text: " The Party  pays ", box: { x: 60, y: 98, width: 300, height: 24 } }],
        [{ text: "   ", box: { x: 0, y: 0, width: 1, height: 1 } }],
        [{ text: "Page 3", box: { x: 10, y: 960, width: 60, height: 20 } }],
      ],
    };
    expect(ocrPageLines(result, 1000)).toEqual([
      { text: "9.1.1 The Party pays", top: 0.122 },
      { text: "Page 3", top: 0.98 },
    ]);
  });

  it("returns no lines for an empty or odd result", () => {
    expect(ocrPageLines({ lines: [] }, 100)).toEqual([]);
    expect(ocrPageLines(null, 100)).toEqual([]);
    expect(ocrPageLines({ lines: [[{ text: "x" }]] }, 100)).toEqual([{ text: "x", top: null }]);
  });
});

describe("deskew scoring", () => {
  // A white 20x20 image with dark pixels in the given rows (straight) or spread over all rows (tilted).
  function image(darkAt) {
    const data = new Uint8ClampedArray(20 * 20 * 4).fill(255);
    for (const [x, y] of darkAt) data.fill(0, (y * 20 + x) * 4, (y * 20 + x) * 4 + 3);
    return data;
  }
  it("scores horizontal text lines higher than the same ink tilted across rows", () => {
    const straight = [];
    const tilted = [];
    for (let x = 0; x < 20; x++) {
      straight.push([x, 5], [x, 12]);
      tilted.push([x, Math.floor(x / 2)], [x, 10 + Math.floor(x / 2)]);
    }
    expect(rowVariance(image(straight), 20, 20)).toBeGreaterThan(rowVariance(image(tilted), 20, 20));
  });
});
