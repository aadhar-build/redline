# 15: Red lines in the Reviewer's own words; saved reviews after Red line edits

**What to build:** Red lines the Reviewer adds in their own words are matched against clauses, and saved reviews behave as decided when Red lines change.

**Blocked by:** 12 (Reviewer edits their Red lines)

**Decisions (2026-10-31):** OQ16/OQ17: ../../spec-gaps/issues/20-red-lines-in-the-reviewers-own-words.md.

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31)

- [x] A clause seeded for each added Red line is flagged Don't sign as written (PRD criterion 5).
- [x] Re-analysis of saved documents and the Red line list kept with each saved review follow the OQ17 decision (PRD criterion 7, for saved reviews).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Evidence (2026-10-31, branch feature/15-own-red-lines-saved-reviews)

All runs use the local fake adapter. Nothing here has run on a real document with the CLI adapter yet.

- Criterion 5: fixture fixtures/contracts/own-red-lines-01.txt seeds a clause for each of four Red lines written in the Reviewer's own words (fixtures/contracts/own-red-line-seeds.js). Its script names each Red line by its wording, and the local fake adapter swaps that for the id on the same line of the prompt's Red line list. That depends on the prompt keeping each Red line on one line with its id and wording. Two matches are scripted below Don't sign as written and get raised. One own-words match quotes an invented sentence and is withheld. Removing an own Red line removes its match. Covered in tests/unit/own-red-lines.test.js (Review seam), tests/isolation/saved-reviews.test.ts (stored Red lines, saved and reopened) and tests/e2e/saved-reviews.spec.mjs (added on the Red lines page, then reviewed through the interface).
- OQ17: every saved review keeps its reviews.red_lines. When the Reviewer's current list differs from it (id, wording or what each Red line catches, in order; basis ignored), the library row and the saved review page say "checked against an older list". The saved page offers a button that reviews the stored text again against the current list. It goes through the guarded /api/review route with `documentId`; the server reads the text and the Red lines itself. The result is saved as a new review and the old one is kept. Listing or opening never calls the model. A re-run that fails or is incomplete saves and removes nothing. Another account's re-run, open and list find nothing, and it cannot add a review to the first account's document. No migration was needed. For criterion 7, this ticket covers only the saved-review part: the list the review was checked against is kept, reopened and shown under the Red lines checked. The Clean result itself is still null until ticket 11. Covered in tests/isolation/saved-reviews.test.ts and tests/e2e/saved-reviews.spec.mjs.
- Copy: the new LIBRARY_COPY entries (older-list marker, note, re-run button, busy, off and error messages, library lede) and the Red lines lede were run through the humanizer skill, and a unit test checks them for banned words.
