# 19: PDFs with text on some pages only

**What to build:** A PDF with a text layer on some pages and only images on others is handled as decided, so no Clean result is given on terms Redline never read.

**Blocked by:** 05 (Upload a text-layer PDF or DOCX file)

**Decisions (2026-10-31):** OCR engine: ppu-paddle-ocr, PP-OCRv5 English, self-hosted (../../spec-gaps/issues/24-which-ocr-engine.md). OQ18 / ADR 0008: accept mixed PDFs; OCR the pages without real text, including scans with a hidden OCR layer; no special marking.

**Needs approval for:** None

**Status:** done on feature/23-ocr, not merged

- [x] A mixed-page PDF fixture gives the outcome OQ18 decides, with its reason if rejected (PRD criterion 13). Done with ticket 23 (branch feature/23-ocr). OQ18 says accept, so: tests/e2e/ocr.spec.mjs builds a PDF with a typed page and a scanned page (JPEG drawn in the browser, tilted -0.8°). The typed page's text layer is kept exactly, and the scanned page is read by the real OCR engine and follows after one newline. The OCR range covers only the scanned page. tests/unit/ocr-extraction.test.js covers the same flow on pdf.js's Node build with a fake engine (5-page mix, consecutive OCR pages, running headers on OCR pages, a hidden OCR layer read again). A PDF is rejected only when OCR also finds no text (reason "no-text"; tests/e2e/upload.spec.mjs, grey-checker scans).
- [x] The network check still shows only extracted text leaving the browser (PRD criterion 14). The posted body is exactly {text, source, ocrRanges}: ocrRanges is integer offset pairs only, sent only with a PDF that OCR read. The body holds no PDF or JPEG signature. Every request is same-origin, and the models and ORT wasm come from /ocr/ (tests/e2e/ocr.spec.mjs). Text-only files still post exactly {text, source} (tests/e2e/upload.spec.mjs). On the 5 real scans, 0 foreign requests (see ticket 23).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). OCR progress, Stop, stopped notice, ocr-failed error, the unreadable-amount withheld reason and the new file hint, all in app/(app)/review/copy.js.
