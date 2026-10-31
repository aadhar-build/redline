# OCR bake-off on real Indian scans

Type: prototype
Status: open
Blocked by: 23

## Question

Run tesseract.js and a PaddleOCR browser port on 3–5 real Indian contract scans (stamp paper, phone photos turned to PDF) rendered by pdfjs-dist, in Chrome and Safari, on a throwaway branch with both as temporary dev dependencies (owner approved the bake-off 2026-10-31). Score digits, ₹/Rs., lakh/crore figures, section numbers and party names against a hand transcription, plus first-load size and time per page. HITL input: the product owner supplies the scans, which must not be committed to the public repo.

## Comments

- 2026-10-31: engine chosen before the bake-off (ticket 24). This ticket becomes a validation run of ppu-paddle-ocr only; results go to assets/ocr-validation-results.md on `prototype/ocr-bake-off`.
