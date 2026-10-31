// PDF extraction in the browser with pdfjs-dist. Browser-only: call it from an event handler.
//
// pdf.js and its assets are self-hosted. scripts/copy-pdfjs-assets.mjs copies the worker, CMaps,
// standard fonts and image-decoder wasm from the installed pdfjs-dist into public/pdfjs/<version>/
// before every build and dev run, so the worker always matches the library version (the pdf.js FAQ
// requires the exact same version) and nothing is fetched from a CDN.

import { needsOcrResult, rejected, textResult } from "./result.js";
import { pageNeedsOcr, summariseOperators } from "./pdf-pages.js";

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

// Joins pdf.js text items into page text. A line break pdf.js detected becomes "\n"; spaces are the
// ones pdf.js synthesised. Line-end hyphens are kept as they are (ADR 0010: never rejoined).
function pageText(textContent) {
  let text = "";
  for (const item of textContent.items) {
    if (typeof item.str !== "string") continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  return text.trim();
}

/** @param {ArrayBuffer} data the file's bytes; they stay in this browser tab */
export async function extractPdf(data) {
  const pdfjs = await loadPdfjs();
  const base = assetBase(pdfjs);

  let doc;
  let task;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
      cMapUrl: `${base}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`,
      wasmUrl: `${base}wasm/`,
    });
    doc = await task.promise;
  } catch (err) {
    task?.destroy();
    if (err?.name === "PasswordException") return rejected("password");
    return rejected("unreadable");
  }

  try {
    const texts = [];
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
      const text = pageText(await page.getTextContent());
      if (summary ? pageNeedsOcr(summary) : text.length === 0) ocrPages.push(n);
      else texts.push(text);
      page.cleanup();
    }

    // The OCR seam (ADR 0008): these pages are handed to OCR once it is built.
    if (ocrPages.length > 0) return needsOcrResult(ocrPages, doc.numPages);
    const text = texts.filter(Boolean).join("\n\n");
    if (text.trim().length === 0) return rejected("no-text");
    return textResult(text, "pdf");
  } catch {
    return rejected("unreadable");
  } finally {
    task.destroy();
  }
}
