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

**Engine seam.** lib/extraction/ocr-engine.js is the only module that knows the engine (ppu-paddle-ocr on ONNX Runtime WASM, single-threaded; PP-OCRv6 small since 2026-10-31, research 31). It takes a straightened page image and returns lines of boxes. The worker (ocr-worker.js) only deskews and shapes lines, so a different engine means replacing that file and the assets scripts/copy-ocr-assets.mjs self-hosts.

| Scan | OCR pages | Time | Result | Characters (no spaces) | Dictionary-word share | Requests off the origin |
|---|---|---|---|---|---|---|
| S01 | 3 | 22 s | text loaded | 5,346 | 0.81 | 0 |
| S02 | 304 | 587 s | rejected after OCR: over the 200,000-character limit | (none loaded) | n/a | 0 |
| S03 | 4 | 24 s | text loaded | 5,834 | 0.83 | 0 |
| S04 | 12 | 65 s | text loaded | 19,554 | 0.85 | 0 |
| S05 | 1 | 5 s | text loaded | 735 | 0.75 | 0 |

Run 2026-10-31 on the product owner's machine, from the scans in ~/redline-samples/scans (never committed), with the harness in the job's ocr-runs folder driving the real /review page in Chromium. What it covers: upload, in-browser OCR of every page, and the text reaching the field. It does not run the analysis. S02 read all 304 pages (about 1.9 s a page) and was then refused by the existing 200,000-character limit (MAX_TEXT_LENGTH in lib/extraction/result.js), so its exact length is not known. The limit stays as it is (coordinator, 2026-10-31).

## Amendment, 2026-10-31: engine switched to PP-OCRv6 small, with a post-check

**Engine (research 31, ticket 23).** The engine is now ppu-paddle-ocr with PP-OCRv6 small detection and recognition and ppocrv6_dict.txt, the files of ppu's V6_SMALL_MODEL preset. Deskew and per-box recognition are unchanged. These are PaddlePaddle's official models (Apache-2.0), downloaded from ppu's Apache-2.0 Hugging Face mirror snowfluke/ppu-paddle-ocr-models at a pinned commit. scripts/copy-ocr-assets.mjs checks each file's SHA-256 at build time and copies it to public/ocr/models/pp-ocrv6-small/. The models are never committed. On the 8 hand-transcribed pages in research 31, held-out CER falls from 2.08% to 1.12% and dropped lines from 3 to 0.

**Cost to the Reviewer.** The first OCR download grows from about 15.7 MB to about 30 MB gzip (26.2 MB of models plus 3.8 MB of ONNX Runtime). The models barely compress. Next serves public/ with max-age=0, so the worker keeps the three model files in Cache Storage (cache redline-ocr-pp-ocrv6-small), and a later visit reads them from disk. Caches left by an older engine are deleted. Pages take longer to read, about 10 s each against 7.5 s.

**Post-check.** v6 small does not print ₹ either. It mostly leaves the sign out (". 14,57,00,000/-"), a shape the first unreadable-amount rule did not catch. lib/review/unreadable-amount.js now also finds a bare full stop before an amount, a broken roman-numeral marker ("(ii )", "()"), and a line that starts with Article, Clause or Section but has no number. A Risk flag citing such a sentence in an OCR range is withheld with the existing reason "unreadable-amount" and counted, so no migration is needed. The withheld note now reads "...couldn't make out an amount or a clause number." The post-check only flags. It never repairs the text.

**Stray glyphs.** The v6 dictionary holds 18,709 entries, including CJK. On the real scans OCR printed a few stray Han characters (2 on S01, 3 on S04). None of them tripped the English-language check.

**OCR noise rules (coordinator ruling, 2026-10-31).** On blank or noisy areas, v6 small returns boxes like "一" or a lone "1". The noise rules in lib/extraction/ocr-lines.js handle them:
- A box with no Latin letter, digit or ₹ is dropped. This also removes the stray CJK glyphs.
- An OCR'd page with fewer than 20 Latin letters counts as having no readable text and contributes nothing. A scan that holds only such pages gets the "no text" result, not "not English".
- There is no confidence floor. On the round-2 pages, 4 of 361 real boxes score under 0.6.

## Amendment, 2026-11-02: a PDF page cap of 300 pages

Decided by the product owner. A PDF with more than 300 pages (MAX_PDF_PAGES in lib/extraction/result.js) is refused as "too-many-pages" as soon as pdf.js knows the page count, before any page's text is read and before OCR starts. A long scan such as S02 (304 pages, 587 s of OCR before the character limit refused it) is now refused at once. The 200,000-character limit stays, so a PDF of 300 pages or fewer can still be refused for length. Upload and the added-document form both go through extractFile, so the cap covers both. "Every PDF is accepted" in the Decision now reads subject to this cap.
