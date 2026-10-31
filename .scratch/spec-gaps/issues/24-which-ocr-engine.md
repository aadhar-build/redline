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
