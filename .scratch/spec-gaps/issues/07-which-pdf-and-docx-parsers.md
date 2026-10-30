# Which PDF and DOCX parsers to adopt

Type: grilling
Status: resolved
Blocked by: 06

## Question

OQ21. Given the options in the parser research, which parsers does the product owner approve? Gates implementation ticket 05.

## Answer

Product owner, 2026-10-31 (asked in session). pdfjs-dist for PDF (worker wired into Next.js by us, our own per-page text-layer detection) and JSZip plus our own document.xml reader for DOCX, so auto-numbered clause labels are kept. Closes OQ21. Both are approved dependencies.
