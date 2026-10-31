# 23: Wire OCR into extraction

**What to build:** pages that extraction marks `needs-ocr` (image-only pages and scans with a hidden OCR text layer) are rendered with pdfjs-dist, deskewed, and read by ppu-paddle-ocr (PP-OCRv5 English mobile) in a web worker, all in the browser, with every model and runtime file self-hosted. Decisions: ADR 0008, .scratch/spec-gaps/issues/24 (engine, deskew, ₹ rule, single thread), harness and measurements on `prototype/ocr-bake-off` (prototypes/ocr-validation/).

**Blocked by:** 21 (Extraction follow-ups from ticket 05)

**Status:** ready-for-agent

- [ ] OCR runs only on `needs-ocr` pages; text-layer pages keep their embedded text.
- [ ] Projection-profile deskew from the prototype (no new dependency); `onnxruntime-web/wasm` with self-hosted paths set before ppu is imported; no request leaves the origin at runtime (Playwright network check).
- [ ] Unreadable-amount rule (spec-gaps 24) as a tested matcher with the five S04 shapes as fixtures (shapes only, no sample text committed); flags citing such a sentence are withheld with reason "unreadable-amount" (stored reason code via migration).
- [ ] Progress shown per page; the Reviewer can cancel; copy through the humanizer.
- [ ] The 5 real scans in ~/redline-samples run end to end locally; results summarised in the ticket.
