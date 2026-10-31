# 07: Ambiguous clauses shown with their readings

**What to build:** A clause that can be read two ways is shown as an Ambiguous clause with its checked Source sentence and each reading; no reading is chosen.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Needs approval for:** None

**Status:** done (2026-10-31, fixture runs; not yet run against a real contract with the Claude CLI)

- [x] Each two-reading fixture clause shows both readings and no chosen reading (PRD criterion 11).
- [x] Readings pass the hedge-word check (PRD criterion 8).
- [x] ~~It is not a Risk flag, gets no Severity and does not affect a Clean result~~ Superseded by ticket 16 (OQ5): it is a Negotiate Risk flag (Don't sign as written when it matches a Red line) and blocks a Clean result.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Comments

- From ticket 11 (2026-10-31, settled by the Fable advisor): the Clean result is held back by `CLEAN_RESULT_READY = false` in lib/review/clean-result-gate.js until this ticket and ticket 13 both land; remove the gate together with 13. This ticket must populate `ambiguousClauses` in Review's output (cleanResultOf blocks on any entry, per spec-gaps 15), persist the list in `toStoredReview` and read it back in `reopenReview`, removing the hardcoded `ambiguousClauses: []` there.
- Lift the gate only when a no-flags fixture with one Ambiguous clause is not a Clean result, and (with ticket 13) a no-flags fixture with a Statement of Work, web address or "as amended from time to time" reference is not a Clean result until every reference is marked reviewed.

- Built: `readings` in the model reply; fewer than two distinct readings, or a reading with a number the document lacks, withholds the flag; hedge words in a reading are marked. Saved rows keep `readings` (text only) and reopen with the same Severity rule. Tests: tests/unit/ambiguous-clauses.test.js, tests/e2e/ambiguous-clauses.spec.mjs. CLEAN_RESULT_READY stays false until ticket 13.
