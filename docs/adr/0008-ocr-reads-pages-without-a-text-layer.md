# 0008. OCR reads PDF pages that have no real text layer

Status: Accepted, 2026-10-31. Supersedes the "OCR stays out" consequence of ADR 0001 and the OCR exclusion in CLAUDE.md.

## Decision
Every PDF is accepted. A page with a real text layer uses its embedded text. A page with only images, or a scan carrying a hidden OCR text layer, is read again by Redline's own OCR, which runs in the browser so the original file still never leaves it. OCR text is stored and treated like any other extracted text, and the Source sentence check runs against it as it does against embedded text. A document OCR read is marked once, per document (amended 2026-10-31, below). The OCR engine is chosen after a bake-off on real Indian scans (.scratch/spec-gaps/issues/24, 27).

## Alternatives
- **Keep v1 OCR-free and reject scanned or mixed PDFs.** This was the earlier rule. It was rejected because the product owner expects scanned contracts to be common in the market Redline serves (India, English-language contracts).
- **OCR with safeguards**: mark OCR pages, show the page image beside each quote from them, let low-confidence words block a Clean result. Offered and not chosen.
- **OCR every page, ignoring embedded text.** Rejected: it brings misreads into PDFs that had exact text.

## Why
The product owner's words: "I believe OCR will be necessary in the markets we operate."

## Consequences
- **The Source sentence check proves less on OCR pages.** It proves the quote matches the OCR output, not the paper. A misread figure ("₹495" read as "₹405") passes the check and is shown as the document's text. The product owner accepted this trade-off.
- **A new dependency**: an in-browser OCR engine whose model files are self-hosted, never fetched from a CDN at runtime.
- **The image-only rejection goes away.** PRD criterion 13 and implementation tickets 05 and 19 change: a PDF is rejected only when OCR also finds no text.

## Amendment, 2026-10-31: marking, the engine seam, and the real-scan run

**Marking (QUESTIONS 18, decided by the product owner 2026-10-31): OCR text is marked per document.** documents.ocr_pages and documents.page_count (migration 20261031002400, checked by a constraint, covered by the table's Row Level Security) record the pages OCR read, as numbers only. The browser posts ocrPages and pageCount with the text, and every review of that document, fresh or reopened, shows one note above the summary (COPY.scannedNote, e.g. "Redline read 1 of this document's 2 pages from a scan."). There is no marking per sentence or per page.

**Engine seam.** lib/extraction/ocr-engine.js is the only module that knows the engine (today ppu-paddle-ocr, PP-OCRv5 English mobile, ONNX Runtime WASM, single-threaded). It takes a straightened page image and returns lines of boxes. The worker (ocr-worker.js) only deskews and shapes lines, so a different engine means replacing that file and the assets scripts/copy-ocr-assets.mjs self-hosts.

| Scan | OCR pages | Time | Result | Characters (no spaces) | Dictionary-word share | Requests off the origin |
|---|---|---|---|---|---|---|
| S01 | 3 | 22 s | text loaded | 5,346 | 0.81 | 0 |
| S02 | 304 | 587 s | rejected after OCR: over the 200,000-character limit | (none loaded) | n/a | 0 |
| S03 | 4 | 24 s | text loaded | 5,834 | 0.83 | 0 |
| S04 | 12 | 65 s | text loaded | 19,554 | 0.85 | 0 |
| S05 | 1 | 5 s | text loaded | 735 | 0.75 | 0 |

Run 2026-10-31 on the product owner's machine, from the scans in ~/redline-samples/scans (never committed), with the harness in the job's ocr-runs folder driving the real /review page in Chromium. What it covers: upload, in-browser OCR of every page, and the text reaching the field. It does not run the analysis. S02 read all 304 pages (about 1.9 s a page) and was then refused by the existing 200,000-character limit (MAX_TEXT_LENGTH in lib/extraction/result.js), so its exact length is not known. The limit stays as it is (coordinator, 2026-10-31).
