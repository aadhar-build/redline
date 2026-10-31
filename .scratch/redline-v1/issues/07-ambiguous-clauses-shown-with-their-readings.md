# 07: Ambiguous clauses shown with their readings

**What to build:** A clause that can be read two ways is shown as an Ambiguous clause with its checked Source sentence and each reading; no reading is chosen.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] Each two-reading fixture clause shows both readings and no chosen reading (PRD criterion 11).
- [ ] Readings pass the hedge-word check (PRD criterion 8).
- [ ] It is not a Risk flag, gets no Severity and does not affect a Clean result; that is ticket 16.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Comments

- From ticket 11 (2026-10-31, settled by the Fable advisor): the Clean result is held back by `CLEAN_RESULT_READY = false` in lib/review/clean-result-gate.js until this ticket and ticket 13 both land; remove the gate together with 13. This ticket must populate `ambiguousClauses` in Review's output (cleanResultOf blocks on any entry, per spec-gaps 15), persist the list in `toStoredReview` and read it back in `reopenReview`, removing the hardcoded `ambiguousClauses: []` there.
- Lift the gate only when a no-flags fixture with one Ambiguous clause is not a Clean result, and (with ticket 13) a no-flags fixture with a Statement of Work, web address or "as amended from time to time" reference is not a Clean result until every reference is marked reviewed.
