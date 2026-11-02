# 05: Upload a text-layer PDF or DOCX file

**What to build:** The file is parsed in the browser and only extracted text is sent; an image-only PDF is rejected with a reason.

**Blocked by:** 01 (Pasted text gets a plain-English summary)

**Decisions (2026-10-31):** OCR engine: ppu-paddle-ocr, PP-OCRv5 English, self-hosted (../../spec-gaps/issues/24-which-ocr-engine.md). OQ21: pdfjs-dist and JSZip with our own document.xml reader. ADR 0008 replaces the image-only rejection: pages without a real text layer go to OCR; reject only when OCR also finds no text. Non-English documents are rejected (ADR 0009).

**Needs approval for:** PDF parser, DOCX parser, browser test tooling.

**Status:** merged into `development` (2026-10-31), with OCR since merged through tickets 23 and 19; no real Word-authored DOCX tested yet (final-real-run-2026-11-02 used a converted file)

- [x] Extraction seam test in the browser extracts text from a text-layer PDF and a DOCX file. Evidence: tests/e2e/upload.spec.mjs ("a text-layer PDF/DOCX is read in the browser...", plus DOCX numbering, accepted tracked changes, w:br, text boxes, style-based numbering). Also run locally in the built app (Chromium, production build) on all 8 real public text-layer PDFs in ~/redline-samples/text (not committed): all 8 read, no page flagged as scanned, no request sent on upload. No Word-authored real DOCX was available; DOCX is verified on built fixtures and one macOS textutil-made DOCX only. No real document has been taken through to a summary yet: that needs the real model adapter (ticket 09).
- [x] An image-only PDF is rejected with its reason; no request is sent, no analysis runs, nothing is stored (PRD criterion 13). Under ADR 0008 this is a stop, not a final rejection, until OCR lands: the message names the scanned pages. Evidence: upload.spec.mjs image-only and hidden-OCR-layer tests assert the message and zero non-GET requests; nothing is stored because no storage exists yet (ticket 10). Real scans S01-S05 (incl. three with hidden OCR layers, one 304 pages) were all stopped with their pages named.
- [x] A network check while uploading a PDF and a DOCX shows only extracted text in requests, no file bytes (PRD criterion 14). Evidence: upload.spec.mjs records every request: no other origin, the only request with a body is POST /api/review with JSON {text} equal to the extracted text, and no %PDF-, PK header, raw or base64 file bytes.
- [x] Fixtures include no PDFs with text on only some pages; those are ticket 19. Page detection is per page, so ticket 19 only needs fixtures and the OCR step.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). The strings are in app/(app)/review/copy.js.
