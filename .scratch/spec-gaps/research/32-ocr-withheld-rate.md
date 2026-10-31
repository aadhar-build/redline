# 32. Why flags on OCR'd scans are withheld (S04, S01)

Date: 2026-10-31. Read-only diagnosis; no product code changed. Scratch work: ~/redline-tools/ocr-withheld/.

## Method
The final run did not keep the model's raw quotes, so the Node review seam was re-run on the exact stored
OCR text of each scan (taken from the saved review request): S04 three times, S01 three times. Every quote
that failed the source check was located in the normalised stored text and the failure cause read off.
Withheld counts per rerun: S04 8 / 7 / 10 flags (browser run: 9 source-not-found), S01 1 / 1 / 1 (browser run: 2).

## Classification (31 failing quotes across 6 reruns)
| Cause | Count |
|---|---|
| Model silently "corrected" an OCR error | 0 |
| Line break or hyphenation inside the OCR text | 0 |
| OCR spacing, such as "(ii )" | 0 |
| Sentence-boundary rule | 28 |
| Genuinely altered quote | 3 |

In 28 of 31, the normalised quote is in the stored text character for character; only the boundary rules reject it.

Boundary sub-causes (28):
| Sub-cause | Count |
|---|---|
| Clause starts with a bare lowercase roman list marker on a new line ("ii ", "iv ", "vi. "); the "next character is lowercase" rule blocks the start | 20 |
| An OCR'd page footer line ("<n>IPage", "<n>Page") sits before a heading, so the heading does not start on a boundary | 3 |
| Heading line contains "&", so it is not a heading | 1 |
| Clause text ends without a full stop before the next numbered heading | 1 |
| S01: the line before the clause is an unterminated fragment (OCR layout order) | 3 |

Altered (3): the model dropped the full stop after a roman list marker ("vi." quoted as "vi"). All 3 would
still fail the lowercase-marker rule if quoted exactly.

Checked with toy strings: "(v) ..." and "V ..." pass; bare "v ..." fails; "4. AMENDMENT" passes, with a
"4IPage" line before it fails; a heading with "&" fails.

## Expected recovery
| Fix | Recovers (of 31) | Risk |
|---|---|---|
| (a) Prompt: quote OCR text exactly, errors included | 0 directly (the 3 altered ones still hit the marker rule); 3 together with (c) | Low. Prompt length only. |
| (b) Normalise line-wrap hyphenation and bracket spaces at extraction | 0 (no such cases seen) | Changes stored text; hyphen rejoining is on ADR 0010's never list. |
| (c) Boundary allowance in the source check, structural only | 20 (bare lowercase roman marker at a line start), up to 24 with page-footer lines and "&" in headings; 27 with (a) | A lowercase word that wraps onto a new line could open a false boundary. Limit it to roman numerals i-xx, optionally followed by "." or ")", then a space and a capital letter, at the start of a line. No content characters are matched loosely. |

None of these recovers the 3 S01 cases. The OCR line order there does not support a boundary.

## Recommendation
Do (c) as an ADR 0010 addendum, plus (a) as a cheap complement. It is a boundary rule, not an
OCR-only one: text PDFs with the same list style would hit the same rule. Skip (b). Order:
1. Accept a lowercase roman list marker at a line start as a sentence start (expected +20 of 31).
2. Treat a line that is only a page footer ("<n> | Page" and its OCR forms) as transparent to heading detection (+3).
3. Allow "&" in heading lines (+1).
4. Add (a): tell the model to keep list markers and punctuation exactly as stored (+3 together with step 1).
Expected S04 withheld rate falls from about 77% to about 10-20%. Re-measure on S04 and S01 after the change.
Not checked against the scan images: whether the bare markers are printed that way or are brackets OCR dropped.
