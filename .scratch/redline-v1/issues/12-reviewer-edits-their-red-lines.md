# 12: Reviewer edits their Red lines

**What to build:** Red lines start as the four Default Red lines saved to the account; the Reviewer can add, edit or remove any, and the next review uses the current list.

**Blocked by:** 06 (Default Red lines drive the analysis); 10 (Saved library)

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31); own-words matching box belongs to ticket 15

- [x] After a Default Red line is removed, its seeded clause is not a Red line match in a review run after removal (PRD criterion 4).
- [x] Edits persist across sessions, and the Isolation seam still returns no rows (PRD criterion 15).
- [ ] Matching Red lines written in the Reviewer's own words is ticket 15.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Evidence (2026-10-31, branch feature/12-edit-red-lines)

- Criterion 4: tests/isolation/red-lines.test.ts, one fresh account per Default Red line: remove it, load the list in a new session, review vendor-agreement-02 against the stored list with the local fake adapter. The removed id is not in the prompt or the Red lines checked, its seeded clause has no Red line match, and the other three still match. tests/e2e/red-lines.spec.mjs does the same through the interface for Red line 1. Fake adapter only; not yet run on a real document with the CLI adapter.
- Criterion 15: edits, additions and removals read back in a new session (isolation and e2e); a second account gets no rows of the first account's red_lines or its red_lines_seeded_at, and its edits and removals of them touch nothing (tests/isolation/red-lines.test.ts, tests/isolation/accounts-isolated.test.ts).
- Own-words matching (ticket 15) left unticked here: the Reviewer's wording is sent to the model and a match names it (unit and isolation tests with scripted output), but the seeded-clause criterion belongs to ticket 15.
- Copy: app/(app)/red-lines/red-lines-copy.js and the new COPY and LIBRARY_COPY entries were run through the humanizer skill.
