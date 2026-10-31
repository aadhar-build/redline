# 24: Lead-ins, form detection, Owner change and review history

**What to build:** the Fable advisor's rulings of 2026-10-31 on QUESTIONS.md 21–24 (asked after ticket 22's real re-run). Part 1 (rulings 21 and 22) and part 2 (rulings 23 and 24) can be built separately.

**Blocked by:** 22 (Trust fixes from the first real runs), 15 (Red lines in the Reviewer's own words and saved reviews)

**Status:** ready-for-agent

## Part 1

**21. Lead-in exceptions** (medium-high on A, B, D; medium on C). The principle stays: a lead-in's ":" or ";" is not a boundary. Four narrow exceptions, all **start-only**: a quote may begin after them, but a span may never end at ":" or ";".
- **A. Heading lines with punctuation.** In isHeadingLine, strip a trailing ":" or ";", split the rest on ":"/";", and require every word of every segment to pass the existing word test (≤8 words, ≤80 chars). New guard for every heading line: no word, case-folded, is an operative word {shall, must, will, may, not, no, never, unless, except, provided, subject, if, only, without, means, includes}. Rule 1 otherwise unchanged. Passes: "7. COMPENSATION:", "3. LICENCE PERIOD; EFFECTIVE DATE", "Payment Terms:". Fails: "The Licensee shall not:", "Licensee Shall Not:", "Subject to clause 4:".
- **B. Formula openers.** A line ending ":" whose upper-cased text ends with one of {AS FOLLOWS, AS UNDER, WITNESSETH, HEREBY AGREED, AGREED AND DECLARED, AGREE AS FOLLOWS} is a start boundary for the gap after it when the next text starts with AFTER_HEADING. Fixed list.
- **C. Provisos.** An inline ":" followed by whitespace and exactly "Provided that" / "Provided further that" / "Provided always that" (capital P) is a start boundary for the proviso. The main clause still cannot end at that ":".
- **D. Inline all-caps heading** (extends ticket 22 ruling B). The skipped prefix may also contain ALL-CAPS words (≥2 letters; digits, &, comma, hyphen allowed), each optionally ending ":" or ";", up to 8 words and 80 chars, no operative word, starting at line start on a boundary; the quote must pass OPENS_SENTENCE. The shown span starts at the line start. Title-case inline headings are not skipped.
- Accept: "AS FOLLOWS:\n1. The Licensor hereby grants…" quoted from "The Licensor"; "7. COMPENSATION: A. GRANT APPLICATION GDS shall pay…" quoted from "GDS shall" and from "A. GRANT", shown from "7."; "3. LICENCE PERIOD; EFFECTIVE DATE\n3.1 The licence period…"; "…as provided in the Act: Provided that no fee…" quoted from "Provided that".
- Withhold: "The Licensee shall not:\n(a) sublet…" quoted as "(a) sublet…" or "sublet…"; "LICENSEE SHALL NOT sublet" quoted as "sublet"; a quote ending "…shall not:"; "…as provided in the Act:" without its proviso; "Subject to Clause 9:\n(a) …" quoted as "(a) …"; "NOW IT IS AGREED THAT:\n…"; "7. Compensation: A. Grant Application GDS shall" quoted as "GDS shall". Regression: the twelve addendum cases and ticket 22 ruling B's cases unchanged.

**22. Form detection** (high on the dot-leader and signature-block rules, medium on prompt wording). `template` fires only on body blanks: (i) any placeholder bracket ("[●]", "[__]", "[Name…]"); (ii) an underscore or dot/ellipsis run only when, after removing the run, punctuation and the label words {name, date, signature, signed, by, title, designation, witness, witnesses, place, for, authorised, authorized, signatory, seal, stamp, and}, at least 3 words remain on that line. A dot/ellipsis run followed by optional space and a number or roman numeral at line end (a contents leader) never counts. Prompt: the fixed line becomes "This document contains blanks."; the rule becomes "Say the document is signed, executed or dated only where its text states it. A blank signature or date line is not evidence either way." The UI note says the document has blanks, not "unsigned form". Tests: "Definitions .......... 3" alone → false; "Signature: ________\nDate: ______" alone → false; "this ___ day of ____ 2024" → true; "a monthly fee of Rs. ______" → true; "[●]" → true; through the Review seam, the prompt contains neither "unsigned" nor "form".

## Part 2

**23. Change Owner and reopen** (high on a and c, medium-high on b). (a) Signed in, Change posts {documentId, ownerParty}; rerunSaved takes ownerParty and saves a new review on the same document (ticket 15's path); nothing new under documents. Signed out, unchanged. Test: two Changes leave one documents row and three reviews rows; another account's documentId → null. (b) One migration on reviews: owner_party text null, owner_fixed boolean not null default false, judgments_dropped integer not null default 0 check ≥ 0. Reopen shows "Reviewed for: X" with Change, and judgmentsDropped = stored count + any dropped on reopen. (c) Show "N judgments left out because they claimed what is usual" (wording through the humanizer) beside the withheld count, hidden when 0.

**24. Earlier reviews** (medium). Read-only, inside scope item 6: the saved document page lists its reviews (date, flag count, older-list tag) newest first; openSaved takes an optional reviewId that must belong to that document (RLS applies) and renders it through the same reopen path. No deleting, comparing or re-running an old review; no model call. Test: two reviews, open the older by id, it shows the older-list tag; another account → null.

- [x] Part 1 tests through the source-check and Review seams.
- [ ] Part 2 tests through the library and isolation seams, plus e2e.
- [x] A real re-run of the six contracts after part 1, before/after recorded here.
- [ ] New copy through the humanizer.

## Comments

- 2026-10-31, part 1 built (feature/24a-lead-ins-and-forms):
  - **21** (lib/review/source-check.js):
    - `isBoundary` now takes a start mode. Exceptions A, B and C apply only on the walk back from a quote's start, at every level of that walk. An end boundary uses the old rules.
    - A span never ends at ":" or ";". `isEndBoundary` checks this after any closing quotes or brackets.
    - The operative-word guard applies to every heading line, in both modes.
    - D lives in `numberingStart`. The caps words have their own budget: up to 8 words and 80 characters, mixed with up to 3 numbering tokens. The prefix must start at a line start on a boundary, so the walk goes past the boundary after "7." until it reaches the line start. A numbering-only prefix keeps ruling B's 24-character cap.
    - Tests cover every accept and withhold case the ruling lists. They also cover quotes ending "…shall not:", "…COMPENSATION:", "…in the Act:" and a list item's ";". The twelve addendum cases and ruling B's cases are unchanged.
    - One existing test flipped, as the ruling intends: "Fees:\nThe Company…" and "Fees; Taxes\nThe Company…" were withheld and are now shown (A). The test now also checks that a quote can't end at "Fees; Taxes", and that "The Company shall:" is still a lead-in.
    - "C. GRANT COMMISSION: If…" (ticket 22's negative) stays withheld, because that heading sits mid-line and D needs a line start.
    - Not built: the case "NOW IT IS AGREED THAT:" withheld. Rule A as written reads that line as a heading, so the test is skipped. See QUESTIONS.md 25.
    - ADR 0010 has a new addendum with the four exceptions.
  - **22** (lib/review/wording.js `looksLikeTemplate`):
    - Placeholder brackets count anywhere.
    - An underscore or dot run counts only when at least 3 words are left on its line after removing the runs, the punctuation and the label words. A contents leader never counts.
    - The two prompt lines are now "This document contains blanks." and the signed, executed or dated rule as ruled. No other prompt line changed.
    - The note now reads "This document has blanks that haven't been filled in. Redline calls it signed or dated only where the document itself says so." It went through the humanizer.
    - The test that the prompt contains neither "unsigned" nor "form" looks only at the prompt's instructions. It leaves out the document and the reply-shape line, which is untouched and says "in the form {…}" about the JSON. The old prompt-wording test now expects the new rule.
  - **Gates:** unit tests 528 passed (1 skipped, QUESTIONS 25); build, check:client-bundle and e2e (54) pass. Nothing under supabase/ changed.
- 2026-10-31, real re-run after part 1.
  - **Setup:** Sonnet 5.5 (the adapter's fixed `CLI_MODEL`) through the CLI adapter, with `DEFAULT_RED_LINES`, one run per document. The text was re-extracted with the merged lib/extraction and is byte-identical to ticket 22's final text for all six documents. Outputs are kept outside the repo.
  - **Before:** ticket 22's two final runs (for T05, its runs d and e). Every withheld flag before and after is `source-not-found`. No `unsupported-number` on either side.

  | Doc | Before run 1: shown / withheld | Before run 2: shown / withheld | After: shown / withheld | Ticket 22's replies re-checked by the new code (run 1; run 2) | Fragments shown (before → after) | Blanks note (before → after) |
  |---|---|---|---|---|---|---|
  | T01 leave and licence, NDMC | 9 / 6 | 4 / 9 | 8 / 5 | 9 / 6; 5 / 8 | 0 → 0 | yes → yes |
  | T02 leave and licence template | 5 / 1 | 6 / 0 | 8 / 0 | 6 / 0; 6 / 0 | 0 → 0 | yes → yes |
  | T03 tender agreement | 2 / 1 | 3 / 1 | 2 / 2 | 2 / 1; 3 / 1 | 0 → 0 | yes → yes |
  | T05 RERA agreement for sale | 8 / 1 | 7 / 5 | 8 / 4 | 9 / 0; 7 / 5 | 0 → 0 | yes → yes |
  | T06 professional services | 6 / 2 | 6 / 2 | 5 / 1 | 6 / 2; 6 / 2 | 0 → 0 | yes → **no** |
  | T07 office lease | 5 / 2 | 6 / 0 | 5 / 0 | 5 / 2; 6 / 0 | 0 → 0 | yes → yes |

  - **Withheld:** 30 of 97 before (31%, two runs per document) and 12 of 48 after (25%, one run each). A single run can't separate the rule change from model variance. The replay column checks that: re-checking ticket 22's own replies with the new code takes the withheld count from 30 to 27.
  - **Changed flags,** comparing development's check with the new one on the same replies: 5 gained and 2 lost on ticket 22's replies, 4 gained and 1 lost on the new runs.
    - Gained: T01 "3.1 Licence period…" under "3. LICENCE PERIOD; EFFECTIVE DATE" (A); T02 clause 1 after "AS FOLLOWS:" (B); T05 "Provided that where the Allottee(s)…" (C); T06 "A. The City may terminate…" and T07 "1. TERM: The initial term…" (D).
    - Lost: all to the operative-word guard on a plain heading. These are "No change in Control…" under "9. NO CHANGE IN CONTROL" (T01, twice) and "24.1 …" under "24. WAIVER NOT A LIMITATION TO ENFORCE" (T05). See QUESTIONS.md 26.
  - **Still withheld in the new runs:**
    - T01: list items or sub-clauses that end in ";" or follow one (correct under the ruling), one quote the model altered, and the guard loss above.
    - T03: clause 1 after "agreed as follows:-". That line ends ":-", not ":", so B doesn't apply. Also a "WHEREAS…" after a lead-in ending "tender:".
    - T05: 2 altered quotes; a sentence after an address block ending "Allottee [•]"; and "1.2 The Total Price…", where the model's quote ended mid-sentence.
    - T06: a lettered item after a line ending ";".
  - **Blanks note:**
    - It still fires on T01, T02, T03, T05 and T07. Each has a placeholder or a blank inside a sentence.
    - It no longer fires on T06, whose only blanks are signature and date lines. T06's summary now says: "The opening text says it was made and executed on the 17th day of April 2024. The execution line at the end leaves the day and month blank." That matches the text, and ticket 22's "the form is unsigned" claim (QUESTIONS 22) is gone in this run.
  - **Other results:** judgments dropped: 0 in the six runs. The Owner was named in all six.
  - **Not ticked:** "New copy through the humanizer" covers part 2 as well. Part 1's one new string went through it.
