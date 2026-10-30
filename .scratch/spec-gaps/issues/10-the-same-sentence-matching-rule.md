# The written rule for what counts as the same sentence

Type: prototype
Status: resolved
Blocked by: 09

## Question

OQ9 (ADR 0001). Given the extraction research, which normalisations may Redline's code apply before it compares a model-returned Source sentence with the stored text, and which differences make it a different sentence? A prototype normaliser run against fixture text gives the owner something concrete to approve. Gates implementation ticket 14 and PRD criterion 1.

## Answer

Product owner, 2026-10-31 (asked in session). The written rule (OQ9, ADR 0001): (1) Span: a model's quote may be part of a sentence but must start and end on sentence boundaries; an ellipsis is never a wildcard and makes the quote altered. (2) Normalisations, applied identically to stored text and quote, are the safe set only: Unicode NFC; collapse every whitespace run (incl. NBSP and Unicode spaces) to one space and trim; delete zero-width and format characters and soft hyphens; fold curly quotes to straight; fold hyphen/dash variants to '-'; fold the U+FB00–FB06 ligatures. No hyphen rejoining, no footnote stripping, no case folding, no NFKC, never ignore digits or punctuation. Line-end hyphenated PDFs will withhold more flags; accepted. (3) The Reviewer sees the matched span from the stored document text, not the model's string. Research: [09](../research/09-what-extraction-does-to-sentences.md). Note: the owner chose boundary-aligned substrings over whole sentences, so a quote that ends at a sentence boundary but omits an earlier clause of a multi-clause sentence can still pass only if the omitted part is a whole sentence; the fixtures in research section 7 become ticket 14's tests.
