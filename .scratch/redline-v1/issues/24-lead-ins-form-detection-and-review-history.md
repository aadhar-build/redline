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

- [ ] Part 1 tests through the source-check and Review seams.
- [ ] Part 2 tests through the library and isolation seams, plus e2e.
- [ ] A real re-run of the six contracts after part 1, before/after recorded here.
- [ ] New copy through the humanizer.
