# What browser PDF and DOCX parsers exist and what each can detect

Type: research
Status: resolved
Blocked by: none

## Question

Facts for OQ21 and OQ18: which maintained libraries parse a text-layer PDF and a DOCX file entirely in the browser, with licence, size, maintenance and whether each can tell, per page, that a PDF page has no text layer. Options only; install nothing.

## Answer

Research: [06-browser-pdf-and-docx-parsers.md](../research/06-browser-pdf-and-docx-parsers.md). Every maintained browser PDF option is pdf.js underneath: pdfjs-dist (Apache-2.0, worker, manual Next.js wiring, own per-page detection) or unpdf (MIT, main thread, built-in per-page inspectPages incl. hidden-text detection, young and fast-moving). DOCX: mammoth (BSD-2, mature, likely loses auto-numbered clause labels) or JSZip/fflate plus raw XML. New gap: a scan with a hidden OCR text layer passes a naive has-text check.
