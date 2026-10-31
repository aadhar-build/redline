// Extraction: the browser-side module and test seam (spec.md, "Modules and their interfaces").
// A PDF, a DOCX file or pasted text goes in; an extraction result (result.js) comes out.
// The file is read here, in the browser, and never sent anywhere. Only result.text is ever posted.
// Browser-only for files (pdf.js, DOMParser). Never import lib/review here: it is server-only.

import { looksEnglish } from "./language.js";
import { MAX_FILE_BYTES, rejected, textResult } from "./result.js";

export { REJECTION_REASONS, MAX_FILE_BYTES } from "./result.js";
export { looksEnglish } from "./language.js";

const startsWith = (bytes, sig) => sig.every((b, i) => bytes[i] === b);
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0]; // old .doc, or a password-protected .docx

function kindOf(name, bytes) {
  const lower = String(name ?? "").toLowerCase();
  // A PDF may carry a few junk bytes before its header, which readers accept.
  const head = Array.from(bytes.subarray(0, 1024));
  const pdfAt = head.findIndex((_, i) => startsWith(head.slice(i), PDF_SIGNATURE));
  if (lower.endsWith(".pdf") || pdfAt >= 0) return pdfAt >= 0 ? "pdf" : "bad-pdf";
  if (lower.endsWith(".docx")) {
    if (startsWith(head, ZIP_SIGNATURE)) return "docx";
    return startsWith(head, OLE_SIGNATURE) ? "encrypted-docx" : "bad-docx";
  }
  return "other";
}

function checkLanguage(result) {
  if (result.kind === "text" && !looksEnglish(result.text)) return rejected("not-english");
  return result;
}

/** @param {string} text pasted text, returned unchanged when it is accepted */
export function extractPasted(text) {
  return checkLanguage(textResult(String(text ?? ""), "paste"));
}

/** @param {File} file a file the Reviewer picked; its bytes stay in this tab */
export async function extractFile(file) {
  if (file.size > MAX_FILE_BYTES) return rejected("too-large");
  const data = await file.arrayBuffer();
  const kind = kindOf(file.name, new Uint8Array(data));

  if (kind === "pdf") {
    const { extractPdf } = await import("./pdf.js");
    return checkLanguage(await extractPdf(data));
  }
  if (kind === "docx") {
    const { extractDocx } = await import("./docx.js");
    return checkLanguage(await extractDocx(data));
  }
  if (kind === "encrypted-docx") return rejected("password");
  if (kind === "bad-pdf" || kind === "bad-docx") return rejected("unreadable");
  return rejected("unsupported-type");
}
