# 19: PDFs with text on some pages only

**What to build:** A PDF with a text layer on some pages and only images on others is handled as decided, so no Clean result is given on terms Redline never read.

**Blocked by:** 05 (Upload a text-layer PDF or DOCX file)

**Decisions (2026-10-31):** OCR engine: ppu-paddle-ocr, PP-OCRv5 English, self-hosted (../../spec-gaps/issues/24-which-ocr-engine.md). OQ18 / ADR 0008: accept mixed PDFs; OCR the pages without real text, including scans with a hidden OCR layer. Marking: per document (QUESTIONS 18, decided 2026-10-31; see below).

**Needs approval for:** None

**Status:** done on feature/23-ocr, not merged

- [x] A mixed-page PDF fixture gives the outcome OQ18 decides, with its reason if rejected (PRD criterion 13). Done with ticket 23 (branch feature/23-ocr). OQ18 says accept, so: tests/e2e/ocr.spec.mjs builds a PDF with a typed page and a scanned page (JPEG drawn in the browser, tilted -0.8°). The typed page's text layer is kept exactly, and the scanned page is read by the real OCR engine and follows after one newline. The OCR range covers only the scanned page. tests/unit/ocr-extraction.test.js covers the same flow on pdf.js's Node build with a fake engine (5-page mix, consecutive OCR pages, running headers on OCR pages, a hidden OCR layer read again). A PDF is rejected only when OCR also finds no text (reason "no-text"; tests/e2e/upload.spec.mjs, grey-checker scans).
- [x] The network check still shows only extracted text leaving the browser (PRD criterion 14). The posted body is exactly {text, source, ocrRanges, ocrPages, pageCount}: all are integers only, sent only with a PDF that OCR read. The body holds no PDF or JPEG signature. Every request is same-origin, and the models and ORT wasm come from /ocr/ (tests/e2e/ocr.spec.mjs). Text-only files still post exactly {text, source} (tests/e2e/upload.spec.mjs). On the 5 real scans, 0 foreign requests (see ticket 23).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). OCR progress, Stop, stopped notice, ocr-failed error, the unreadable-amount withheld reason and the new file hint, all in app/(app)/review/copy.js.

## Real scans (2026-10-31)

| Scan | OCR pages | Time | Result | Characters (no spaces) | Dictionary-word share | Requests off the origin |
|---|---|---|---|---|---|---|
| S01 | 3 | 22 s | text loaded | 5,346 | 0.81 | 0 |
| S02 | 304 | 587 s | rejected after OCR: over the 200,000-character limit | (none loaded) | n/a | 0 |
| S03 | 4 | 24 s | text loaded | 5,834 | 0.83 | 0 |
| S04 | 12 | 65 s | text loaded | 19,554 | 0.85 | 0 |
| S05 | 1 | 5 s | text loaded | 735 | 0.75 | 0 |

Run 2026-10-31 on the product owner's machine, from the scans in ~/redline-samples/scans (never committed), with the harness in the job's ocr-runs folder driving the real /review page in Chromium. What it covers: upload, in-browser OCR of every page, and the text reaching the field. It does not run the analysis. S02 read all 304 pages (about 1.9 s a page) and was then refused by the existing 200,000-character limit (MAX_TEXT_LENGTH in lib/extraction/result.js), so its exact length is not known. The limit stays as it is (coordinator, 2026-10-31).

**Engine seam.** lib/extraction/ocr-engine.js is the only module that knows the engine (today ppu-paddle-ocr, PP-OCRv5 English mobile, ONNX Runtime WASM, single-threaded). It takes a straightened page image and returns lines of boxes. The worker (ocr-worker.js) only deskews and shapes lines, so a different engine means replacing that file and the assets scripts/copy-ocr-assets.mjs self-hosts.

**Marking (QUESTIONS 18, decided by the product owner 2026-10-31): OCR text is marked per document.** documents.ocr_pages and documents.page_count (migration 20261031002400, checked by a constraint, covered by the table's Row Level Security) record the pages OCR read, as numbers only. The browser posts ocrPages and pageCount with the text, and every review of that document, fresh or reopened, shows one note above the summary (COPY.scannedNote, e.g. "Redline read 1 of this document's 2 pages from a scan."). There is no marking per sentence or per page.
