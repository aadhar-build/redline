# What OCR engines run in the browser and how well they read contracts

Type: research
Status: resolved
Blocked by: none

## Question

Facts for ticket 24: which OCR engines run fully client-side (tesseract.js, scribe.js, others), with licence, size including language data, self-hosting of model files (no CDN), speed per page, accuracy on dense English legal text (digits, currency, section numbers), word confidence output, and Next.js integration notes.

## Answer

Research: [23-browser-ocr-engines.md](../research/23-browser-ocr-engines.md). tesseract.js 7 (Apache-2.0, ~7 MB, word confidence) cannot output ₹ with stock English data; PaddleOCR browser ports (official PaddleOCR.js, ppu-paddle-ocr) include ₹ but need a 15 MB+ ONNX Runtime and COOP/COEP headers, with line-level confidence only; scribe.js is AGPL-3.0 and most accurate on its own benchmark. All default to CDN downloads; each can self-host.
