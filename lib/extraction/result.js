// The result Extraction returns (spec.md, "Modules and their interfaces"). Browser-safe: no imports.
//
//   { kind: "text", text, source, ... }      text Redline can send; source is "pdf", "docx" or "paste".
//                                            Only text and source are ever posted. A PDF also carries
//                                            removed: [{ text, count }], the running headers and page
//                                            numbers taken out; a DOCX carries hiddenRuns, the number of
//                                            runs of hidden Word text with a letter or digit in them.
//                                            A PDF with pages read by OCR also carries ocrPages (1-based)
//                                            and ocrRanges: [start, end] offsets into text of what OCR
//                                            read, in order. ocrRanges is posted with the text, so the
//                                            unreadable-amount rule knows which sentences came from OCR.
//   { kind: "needs-ocr", pages, pageCount }  a PDF with pages that have no real text layer, or only a
//                                            hidden OCR layer from a scanner, read without an OCR engine
//                                            (Node tests). pages are 1-based.
//   { kind: "rejected", reason, ... }        nothing to send; reason is one of REJECTION_REASONS
//
// OCR (ADR 0008, ticket 23): in the browser, extractFile reads the "needs-ocr" pages with the
// in-browser OCR engine (ocr.js) and returns "text". A PDF is rejected for "no-text" only when OCR
// also finds no text.

export const REJECTION_REASONS = [
  "unsupported-type", // not a PDF, DOCX or pasted text (an old .doc, an image, a spreadsheet)
  "too-large", // the file is over MAX_FILE_BYTES
  "password", // an encrypted PDF that needs a password to open
  "unreadable", // the file is damaged or not what its name says
  "no-text", // the file opened but holds no text at all
  "not-english", // ADR 0009: v1 reads English documents only
  "document-too-long", // over MAX_TEXT_LENGTH; OCR stops as soon as the text is over it
  "ocr-failed", // the OCR engine could not load or read a page
];

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
// Review's limit (lib/review/review.js MAX_DOCUMENT_LENGTH), checked in the browser too.
export const MAX_TEXT_LENGTH = 200_000;

export const textResult = (text, source, detail = {}) => ({ kind: "text", text, source, ...detail });
export const needsOcrResult = (pages, pageCount) => ({ kind: "needs-ocr", pages, pageCount });
export const rejected = (reason, detail = {}) => ({ kind: "rejected", reason, ...detail });
