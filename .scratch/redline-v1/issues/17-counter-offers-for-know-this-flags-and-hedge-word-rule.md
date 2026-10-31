# 17: Counter-offers for Know this flags; hedge-word rule for Counter-offers

**What to build:** Know this flags get Counter-offers or deliberately do not, and Counter-offer wording is checked for hedge words or exempted.

**Blocked by:** 08 (Counter-offers for Don't sign as written and Negotiate flags)

**Decisions (2026-10-31):** OQ4: every Know this flag gets a Counter-offer. OQ14: the hedge-word ban applies to Counter-offer wording.

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31); person-read on a real run still open

- [x] Every displayed flag has a Counter-offer except any exception OQ4 sets (PRD criterion 12). OQ4 sets none. Evidence: tests/unit/counter-offers.test.js ("including Know this flags"); tests/e2e/counter-offers.spec.mjs checks every shown flag. The Know this box is quieter (data-quiet="true": no fill, grey text) but always open.
- [x] The hedge-word check covers Counter-offers if OQ14 says so (PRD criterion 8). It does. A banned word is highlighted, as in the summary, and never withheld. Only "fine" next to an amount and "May" the month are exempt. Text copied from the document is not excused (QUESTIONS.md 26). Evidence: unit tests for "may" marked, a verbatim document sentence still marked, verdict words, both exemptions; e2e highlights "may" and "14" in the counter-offers-01 fixture.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
