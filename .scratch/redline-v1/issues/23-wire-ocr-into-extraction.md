# 23: Wire OCR into extraction

**What to build:** pages that extraction marks `needs-ocr` (image-only pages and scans with a hidden OCR text layer) are rendered with pdfjs-dist, deskewed, and read by ppu-paddle-ocr (PP-OCRv5 English mobile) in a web worker, all in the browser, with every model and runtime file self-hosted. Decisions: ADR 0008, .scratch/spec-gaps/issues/24 (engine, deskew, ₹ rule, single thread), harness and measurements on `prototype/ocr-bake-off` (prototypes/ocr-validation/).

**Blocked by:** 21 (Extraction follow-ups from ticket 05)

**Status:** ready-for-agent

- [ ] OCR runs only on `needs-ocr` pages; text-layer pages keep their embedded text.
- [ ] Projection-profile deskew from the prototype (no new dependency); `onnxruntime-web/wasm` with self-hosted paths set before ppu is imported; no request leaves the origin at runtime (Playwright network check).
- [ ] Unreadable-amount rule (spec-gaps 24) as a tested matcher with the five S04 shapes as fixtures (shapes only, no sample text committed); flags citing such a sentence are withheld with reason "unreadable-amount" (stored reason code via migration).
- [ ] Progress shown per page; the Reviewer can cancel; copy through the humanizer.
- [ ] The 5 real scans in ~/redline-samples run end to end locally; results summarised in the ticket.


## Real scans (2026-10-31)

| Scan | OCR pages | Time | Result | Characters (no spaces) | Dictionary-word share | Requests off the origin |
|---|---|---|---|---|---|---|
| S01 | 3 | 22 s | text loaded | 5,346 | 0.81 | 0 |
| S02 | 304 | 587 s | rejected after OCR: over the 200,000-character limit | (none loaded) | n/a | 0 |
| S03 | 4 | 24 s | text loaded | 5,834 | 0.83 | 0 |
| S04 | 12 | 65 s | text loaded | 19,554 | 0.85 | 0 |
| S05 | 1 | 5 s | text loaded | 735 | 0.75 | 0 |

Run 2026-10-31 on the product owner's machine, from the scans in ~/redline-samples/scans (never committed), with the harness in the job's ocr-runs folder driving the real /review page in Chromium. What it covers: upload, in-browser OCR of every page, and the text reaching the field. It does not run the analysis. S02 read all 304 pages (about 1.9 s a page) and was then refused by the existing 200,000-character limit (MAX_TEXT_LENGTH in lib/extraction/result.js), so its exact length is not known. The limit stays as it is (coordinator, 2026-10-31).

**Engine seam.** lib/extraction/ocr-engine.js is the only module that knows the engine (ppu-paddle-ocr on ONNX Runtime WASM, single-threaded; PP-OCRv6 small since 2026-10-31, research 31). It takes a straightened page image and returns lines of boxes. The worker (ocr-worker.js) only deskews and shapes lines, so a different engine means replacing that file and the assets scripts/copy-ocr-assets.mjs self-hosts.

**Marking (QUESTIONS 18, decided by the product owner 2026-10-31): OCR text is marked per document.** documents.ocr_pages and documents.page_count (migration 20261031002400, checked by a constraint, covered by the table's Row Level Security) record the pages OCR read, as numbers only. The browser posts ocrPages and pageCount with the text, and every review of that document, fresh or reopened, shows one note above the summary (COPY.scannedNote, e.g. "Redline read 1 of this document's 2 pages from a scan."). There is no marking per sentence or per page.

## Engine switch to PP-OCRv6 small (2026-10-31, branch feature/23b-ocr-v6)

PP-OCRv6 small replaces PP-OCRv5 English mobile, as research 31 recommends. The unreadable-amount rule gets the post-check (missing ₹, broken roman numerals, headings with no number); ADR 0008 has the amendment. The real scans were re-run through the in-browser pipeline (production build, Chromium, 127.0.0.1:3121). The harness and outputs are in the job's ocr-runs-v6 folder. Nothing from the samples is committed.

| Scan | OCR pages | Time (v5 before) | Characters, no spaces | Dictionary-word share (v5 before) | Post-check hits | ₹ printed | Stray non-Latin letters | Requests off the origin |
|---|---|---|---|---|---|---|---|---|
| S01 | 3 | 25 s (22 s) | 5,391 | 0.84 (0.81) | 0 | 0 | 2 Han | 0 |
| S03 | 4 | 28 s (24 s) | 6,377 | 0.87 (0.83) | 0 | 0 | 0 | 0 |
| S04 | 12 | 85 s (65 s) | 19,921 | 0.86 (0.85) | 3, all a missing ₹ | 2 | 3 Han | 0 |
| S05 | 1 | 5 s (5 s) | 660 | 0.79 (0.75) | 0 | 0 | 0 | 0 |

S04 has 5 ₹ figures. v6 small printed ₹ on 2 of them and left it out on the other 3, and the post-check found all 3, so a flag citing any of those 3 sentences is withheld. All four scans loaded, and the stray Han glyphs did not trip the English-language check. S02 was not re-run (it is over the character limit, see above).
