// The result Extraction returns (spec.md, "Modules and their interfaces"). Browser-safe: no imports.
//
//   { kind: "text", text, source, ... }      text Redline can send; source is "pdf", "docx" or "paste".
//                                            Only text and source are ever posted. A PDF also carries
//                                            removed: [{ text, count }], the running headers and page
//                                            numbers taken out; a DOCX carries hiddenRuns, the number of
//                                            runs of hidden Word text with a letter or digit in them.
//   { kind: "needs-ocr", pages, pageCount }  a PDF with pages that have no real text layer, or only a
//                                            hidden OCR layer from a scanner. pages are 1-based.
//   { kind: "rejected", reason, ... }        nothing to send; reason is one of REJECTION_REASONS
//
// OCR seam (ADR 0008): "needs-ocr" is where the in-browser OCR step plugs in. It will take the file
// and these page numbers, read those pages, and turn the result into "text". Until it exists the
// review page treats "needs-ocr" as a stop: it names the pages and sends nothing.

export const REJECTION_REASONS = [
  "unsupported-type", // not a PDF, DOCX or pasted text (an old .doc, an image, a spreadsheet)
  "too-large", // the file is over MAX_FILE_BYTES
  "password", // an encrypted PDF that needs a password to open
  "unreadable", // the file is damaged or not what its name says
  "no-text", // the file opened but holds no text at all
  "not-english", // ADR 0009: v1 reads English documents only
];

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const textResult = (text, source, detail = {}) => ({ kind: "text", text, source, ...detail });
export const needsOcrResult = (pages, pageCount) => ({ kind: "needs-ocr", pages, pageCount });
export const rejected = (reason, detail = {}) => ({ kind: "rejected", reason, ...detail });
