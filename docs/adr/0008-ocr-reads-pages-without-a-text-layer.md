# 0008. OCR reads PDF pages that have no real text layer

Status: Accepted, 2026-10-31. Supersedes the "OCR stays out" consequence of ADR 0001 and the OCR exclusion in CLAUDE.md.

## Decision
Every PDF is accepted. A page with a real text layer uses its embedded text. A page with only images, or a scan carrying a hidden OCR text layer, is read again by Redline's own OCR, which runs in the browser so the original file still never leaves it. OCR text is stored and treated like any other extracted text: no special marking in the interface, and the Source sentence check runs against it as it does against embedded text. The OCR engine is chosen after a bake-off on real Indian scans (.scratch/spec-gaps/issues/24, 27).

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
