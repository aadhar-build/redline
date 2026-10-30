# 0010. The rule for what counts as the same sentence

Status: Accepted, 2026-10-31. Completes the matching-rule consequence of ADR 0001.

## Decision
A Source sentence the model returns is accepted only if, after the normalisations below are applied identically to the quote and the stored text, it appears in the stored text as a span that starts and ends on sentence boundaries.

- **Span.** A quote may be shorter than a sentence but must start and end on sentence boundaries. An ellipsis is never a wildcard; a quote containing one is altered.
- **Normalisations (the safe set, nothing else):** Unicode NFC; every run of whitespace, including no-break and other Unicode spaces, becomes one space, ends trimmed; zero-width and format characters and soft hyphens are deleted; curly quotes fold to straight; hyphen and dash variants fold to "-"; the U+FB00–FB06 ligatures fold to their letters.
- **Never:** rejoining line-end hyphens, stripping footnote markers, case folding, full NFKC, or ignoring digits, punctuation or accents.
- **What the Reviewer sees** is the matched span from the stored text, not the model's string.
- A flag may cite several Source sentences; each is checked, and the flag is withheld if any one fails.

## Alternatives
- **Whole numbered sentences only.** Safer against a quote that drops a qualifier; not chosen.
- **Also accept a line-end hyphen with or without the hyphen.** Not chosen: hyphenated PDFs will withhold more flags instead.

## Why
Research on what extraction does to text: .scratch/spec-gaps/research/09-what-extraction-does-to-sentences.md.

## Consequences
- Fixtures in that research (section 7), including quotes with "30" changed to "60", "shall" changed to "may", "not" dropped and clauses spliced with an ellipsis, become the tests for implementation ticket 14. Each must fail.
