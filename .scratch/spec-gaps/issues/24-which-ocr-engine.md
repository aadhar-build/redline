# Which OCR engine to adopt

Type: grilling
Status: resolved
Blocked by: 23, 27

## Question

Given the OCR research, which engine does the product owner approve? Gates OCR in implementation tickets 05 and 19.

## Comments

- 2026-10-31: owner chose a bake-off before picking (tesseract.js vs a PaddleOCR browser port). Stays open until ticket 27 reports.

## Answer

Chosen 2026-10-31 by Claude on the product owner's instruction ("Choose the best one now for the OCR engine… and move forward"), before the bake-off finished: **ppu-paddle-ocr** (MIT, v6.6.x, actively maintained) with **PP-OCRv5 English mobile** models (det ~4.75 MB + rec ~7.86 MB), model files and ONNX Runtime WASM self-hosted (no CDN or Hugging Face at runtime), run through its worker-safe `/web` entry, single-threaded so the site needs no COOP/COEP headers.

Why: it is the only permissive option whose English dictionary contains ₹, which Indian contracts use for every amount; stock Tesseract English data cannot output ₹ at all. Its weaknesses don't bite under the owner's decisions: confidence is per line rather than per word, but OCR text is shown unmarked (ADR 0008), so word confidence was not going to be used; reading order must be assembled by Redline, which extraction does anyway. tesseract.js is dropped. scribe.js is ruled out by AGPL-3.0. The bake-off (ticket 27) becomes a validation run of this engine on real scans; if ₹ or reading order fails badly there, this is reopened.

- 2026-10-31, after validation (ticket 27, results on `prototype/ocr-bake-off`, assets/ocr-validation-results.md): engine kept, settled by Fable advisor (medium-high). ₹ read 0 of 5, but every permissive alternative cannot emit ₹ at all; untested PP-OCRv6 models or fine-tuning are the only in-engine paths left. Carry forward the in-house projection-profile deskew (no new dependency); import `onnxruntime-web/wasm` and set the self-hosted paths before importing ppu; single-threaded, no COOP/COEP for now (revisit, scoped to the analysis route, if real documents are too slow). Safe ₹ rule: never repair a glyph into ₹; on OCR text, a sentence with a lone non-digit glyph (Z, 2, ~, f…) right before an Indian digit-group amount, or a letter o inside a digit group, is an "unreadable amount" and any flag citing it is withheld and counted.
