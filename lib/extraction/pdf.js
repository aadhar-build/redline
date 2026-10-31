// PDF extraction in the browser with pdfjs-dist. Browser-only: call it from an event handler.
//
// pdf.js and its assets are self-hosted. scripts/copy-pdfjs-assets.mjs copies the worker, CMaps,
// standard fonts and image-decoder wasm from the installed pdfjs-dist into public/pdfjs/<version>/
// before every build and dev run, so the worker always matches the library version (the pdf.js FAQ
// requires the exact same version) and nothing is fetched from a CDN.
//
// Pages without a real text layer (pdf-pages.js) are read by Redline's own OCR, in this browser
// (ADR 0008, ocr.js); pages with one keep their embedded text. Both kinds are assembled together, in
// page order, by the same rules (pdf-text.js).

import { MAX_TEXT_LENGTH, needsOcrResult, rejected, textResult } from "./result.js";
import { pageNeedsOcr, summariseOperators } from "./pdf-pages.js";
import { assemblePages, pageLines } from "./pdf-text.js";

let pdfjsPromise = null;

function loadPdfjs() {
  // Loaded on demand: pdf.js touches browser globals (DOMMatrix) and must not run during SSR.
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `${assetBase(pdfjs)}pdf.worker.min.mjs`;
    return pdfjs;
  });
  return pdfjsPromise;
}

const assetBase = (pdfjs) => `/pdfjs/${pdfjs.version}/`;

/**
 * @param {ArrayBuffer} data the file's bytes; they stay in this browser tab
 * @param {{ onProgress?: (p: { done: number, total: number }) => void, signal?: AbortSignal }} [run]
 *   onProgress is called before each OCR page and once at the end; signal cancels the OCR run
 */
export async function extractPdf(data, { onProgress, signal } = {}) {
  const pdfjs = await loadPdfjs();
  const base = assetBase(pdfjs);
  const { createOcrEngine } = await import("./ocr.js");
  const ocr = createOcrEngine();
  try {
    return await readPdf(
      pdfjs,
      data,
      {
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl: `${base}wasm/`,
      },
      { ocr, onProgress, signal, maxChars: MAX_TEXT_LENGTH },
    );
  } finally {
    ocr.close();
  }
}

const rawLength = (pages) =>
  pages.reduce((n, lines) => n + (lines ?? []).reduce((m, line) => m + line.text.length + 1, 0), 0);

// Where the OCR pages' text sits in the assembled text. Consecutive OCR pages make one range, which
// includes the "\n" that joins them.
function ocrRangesOf(pageRanges, ocrPages) {
  const out = [];
  let lastPage = -2;
  pageRanges.forEach((range, i) => {
    if (!range || !ocrPages.includes(i + 1)) return;
    const last = out[out.length - 1];
    if (last && lastPage === i - 1 && last[1] + 1 === range[0]) last[1] = range[1];
    else out.push([range[0], range[1]]);
    lastPage = i;
  });
  return out;
}

const cancelled = () => new DOMException("The OCR run was cancelled", "AbortError");

/**
 * The extraction itself, given a loaded pdf.js. Tests pass the legacy Node build of pdf.js here, and
 * a fake OCR engine.
 * @param {object} pdfjs the pdfjs-dist module
 * @param {ArrayBuffer | Uint8Array} data
 * @param {object} [options] extra getDocument options (asset URLs)
 * @param {{ ocr?: { readPage(page: object, o: { signal?: AbortSignal }): Promise<{ text: string, top: number | null }[]> },
 *   onProgress?: (p: { done: number, total: number }) => void, signal?: AbortSignal, maxChars?: number }} [run]
 *   Without ocr, a PDF with pages that need OCR comes back as "needs-ocr". With maxChars, a PDF that
 *   needs OCR is rejected as "document-too-long" as soon as its text is over maxChars, so a long scan
 *   is not read for minutes only to be refused at Review. Text is never cut short and sent.
 *   A cancelled run rejects with an AbortError.
 */
export async function readPdf(pdfjs, data, options = {}, { ocr, onProgress, signal, maxChars } = {}) {
  let doc;
  let task;
  try {
    task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, ...options });
    doc = await task.promise;
  } catch (err) {
    task?.destroy();
    if (err?.name === "PasswordException") return rejected("password");
    return rejected("unreadable");
  }

  try {
    const pages = []; // one entry per page: its lines, or null until OCR has read it
    const ocrPages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0, y0, x1, y1] = page.view;
      const area = Math.abs((x1 - x0) * (y1 - y0));
      let summary;
      try {
        summary = summariseOperators(await page.getOperatorList(), pdfjs.OPS, area);
      } catch {
        // An image that fails to decode: what is drawn is unknown, so the text alone decides below.
        summary = null;
      }
      const lines = pageLines(await page.getTextContent(), page.getViewport({ scale: 1 }));
      const empty = lines.every((line) => !line.text.trim());
      if (summary ? pageNeedsOcr(summary) : empty) {
        // A scan's hidden OCR layer is never used: Redline reads the page itself (ADR 0008).
        ocrPages.push(n);
        pages.push(null);
      } else pages.push(lines);
      page.cleanup();
    }

    if (ocrPages.length > 0 && !ocr) return needsOcrResult(ocrPages, doc.numPages);

    const tooLong = () =>
      Boolean(maxChars) && rawLength(pages) > maxChars && assemblePages(pages.filter(Boolean)).text.length > maxChars;
    if (ocrPages.length > 0) {
      if (tooLong()) return rejected("document-too-long");
      for (let i = 0; i < ocrPages.length; i++) {
        if (signal?.aborted) throw cancelled();
        onProgress?.({ done: i, total: ocrPages.length });
        const n = ocrPages[i];
        const page = await doc.getPage(n);
        pages[n - 1] = await ocr.readPage(page, { signal });
        page.cleanup();
        if (tooLong()) return rejected("document-too-long");
      }
      onProgress?.({ done: ocrPages.length, total: ocrPages.length });
    }

    // Running headers and page numbers come out here, on text and OCR pages alike; pages are joined
    // with one "\n" (pdf-text.js).
    const { text, removed, pageRanges } = assemblePages(pages);
    if (text.trim().length === 0) return rejected("no-text");
    if (ocrPages.length === 0) return textResult(text, "pdf", { removed });
    return textResult(text, "pdf", { removed, ocrPages, ocrRanges: ocrRangesOf(pageRanges, ocrPages) });
  } catch (err) {
    if (err?.name === "AbortError" || signal?.aborted) throw cancelled();
    if (err?.name === "OcrError") return rejected("ocr-failed");
    return rejected("unreadable");
  } finally {
    task.destroy();
  }
}
