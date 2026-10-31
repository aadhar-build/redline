# 0010. The rule for what counts as the same sentence

Status: Accepted, 2026-10-31. Completes the matching-rule consequence of ADR 0001.

## Decision
A Source sentence the model returns is accepted only if, after the normalisations below are applied identically to the quote and the stored text, it appears in the stored text as a span that starts and ends on sentence boundaries.

- **Span.** A quote is one sentence or a run of consecutive whole sentences, found anywhere in the stored text: it must start and end on sentence boundaries, so it can never be part of a sentence. (Corrected 2026-10-31: the first wording said a quote "may be shorter than a sentence", which contradicted the boundary rule; the owner's chosen option was "part of the text, starting and ending on sentence boundaries", as against citing numbered sentences.) An ellipsis is never a wildcard; a quote containing one is altered.
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

## Addendum, 2026-10-31: what a sentence boundary is

Settled by a Fable advisor under the product owner's question rule (high confidence on 2 and 3, medium on 1 and 4).

1. **A single newline is a boundary only after a heading line that starts on a boundary and is followed by a capital.** (Tightened 2026-10-31, settled by Fable advisor, high confidence: as first written, a title-case line or a "Page 2 of 6" footer in the middle of a wrapped sentence counted as a heading, so a quote could end there and drop a qualifier, or start halfway through a sentence.) A single-line-break gap is a boundary only when all three hold:
   - the line before it is a heading line: at most 8 words and 80 characters, ends with a letter, digit or ")", contains no ";" or ":", and every word starts with a capital, is a numbering token ("12.3", "(a)", "(iv)", "I."), or is one of a, an, and, the, of, for, to, in, on, by, or, with. Page-number lines are not excluded from this test;
   - that heading line itself starts on a boundary: the start of the text, a blank line, a ".", "!" or "?" boundary under the rules here, or a single-newline boundary under this same rule (checked recursively, always further back);
   - the first non-space character after the gap is a capital letter, a digit, "(", "[" or an opening quote mark.

   A blank line, or ".", "!", "?" followed by whitespace, is a boundary as before. A list item ending in ";" or a lead-in ending in ":" is not, so a sub-item cannot be cited without its lead-in.
2. **Lowercase-next backstop.** ".", "!" or "?" followed by whitespace is not a boundary when the next non-space character is a lowercase letter.
3. **More abbreviations** that never end a sentence: ltd, inc, llp, govt, dept, rd, ref, encl, annex, exh, etc. (alongside the existing list).
4. **Initials.** A lone capital followed by "." is not a boundary when the next token is a digit ("S. 27"), or another lone capital with "." ("A. K."), or when the previous token is one ("K." in "A. K. Sharma"). "Schedule A. The Company…" stays a boundary.

Accepted cost: a narrow PDF line made only of title-case words ("Sharma Infrastructure Private") that starts on a boundary can pass the heading test, so a quote may start after it and drop part of a party name, never an operative word. Decimals stay non-boundaries (a "." only counts when followed by whitespace). Test cases: the advisor's twelve, recorded in implementation ticket 14.

Stored-text shape (ticket 22 ruling A, built in ticket 21): PDF pages are joined with a single "\n", after each page's trailing newlines and its running headers and page numbers are removed, so a page join is never a blank-line boundary by itself; blank lines in pasted text and DOCX stay boundaries.

## Addendum, 2026-10-31: four lead-in exceptions

Settled by Fable advisor, 2026-10-31 (QUESTIONS.md 21; medium-high confidence on A, B and D, medium on C). The principle stays: a lead-in's ":" or ";" is not a boundary. Four narrow exceptions, all **start-only**: a quote may begin after them, but a span never ends at ":" or ";".

- **A. Heading lines with punctuation.** At a quote's start, a heading line may end in one ":" or ";" and be split by ":" or ";" into segments; every word of every segment passes the rule 1 word test, at most 8 words and 80 characters in all ("7. COMPENSATION:", "3. LICENCE PERIOD; EFFECTIVE DATE", "Payment Terms:"). No heading line, with or without punctuation, may contain an operative word, case-folded: shall, must, will, may, not, no, never, unless, except, provided, subject, if, only, without, means, includes. So "The Licensee shall not:", "Licensee Shall Not:" and "Subject to clause 4:" are lead-ins, not headings.
- **B. Formula openers.** A line ending ":" whose upper-cased text ends with AS FOLLOWS, AS UNDER, WITNESSETH, HEREBY AGREED, AGREED AND DECLARED or AGREE AS FOLLOWS is a start boundary for the line break after it when the next text starts with a capital, digit, "(", "[" or opening quote. The list is fixed.
- **C. Provisos.** An inline ":" followed by whitespace and exactly "Provided that", "Provided further that" or "Provided always that" (capital P) is a start boundary for the proviso. The main clause still cannot end at that ":".
- **D. Inline all-caps headings** (extends ticket 22 ruling B). The left-out prefix before a quote may also hold up to 8 all-caps words (at least 2 letters; digits, "&", "," and "-" allowed), each optionally ending ":" or ";", at most 80 characters, no operative word, starting at a line start on a boundary; the quote opens with a capital, digit, "(", "[", opening quote or currency sign. The shown span starts at the line start ("7. COMPENSATION: A. GRANT APPLICATION GDS shall pay…"). Title-case inline headings are not skipped.

Built in ticket 24 part 1; its tests are in tests/unit/source-check.test.js. One listed case, "NOW IT IS AGREED THAT:" withheld, conflicts with A as written and is open as QUESTIONS.md 25.
