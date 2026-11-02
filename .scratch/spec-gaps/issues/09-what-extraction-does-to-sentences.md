# What extraction does to a sentence

Type: research
Status: resolved
Blocked by: none

## Question

Facts for OQ9: what PDF text extraction and DOCX extraction do to a sentence compared with the source document (line breaks, end-of-line hyphenation, ligatures, curly versus straight quotes, non-breaking spaces, footnote markers, page headers splitting a sentence), and what normalisations are standard for exact-quote verification.

## Answer

Research: [09-what-extraction-does-to-sentences.md](../research/09-what-extraction-does-to-sentences.md). pdf.js invents or drops spaces from glyph gaps, keeps line-end hyphens, interleaves columns and leaves headers, footers and footnote digits inline; mammoth applies tracked changes as accepted and glues words across w:br. Safe normalisations N1–N6 (NFC, whitespace collapse, zero-width removal, quote/dash/ligature folding); risky N7–N9 (hyphen rejoin, footnote and header stripping); avoid N10–N12 (NFKC, case folding, ignoring punctuation or digits). Biggest risk: accepting a partial sentence that drops a qualifier.
