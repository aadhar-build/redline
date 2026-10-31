# 13: Outside references raised and marked as reviewed

**What to build:** Sentences bringing in a web address, a Statement of Work or an Order Form are raised as Outside references with their checked Source sentence, and block a Clean result until the Reviewer marks them reviewed.

**Blocked by:** 10 (Saved library); 11 (Clean result)

**Decisions (2026-10-31):** C2: the Outside reference flow is in scope.

**Needs approval for:** None

**Status:** built on feature/13-outside-references, awaiting merge. Clean result still held by CLEAN_RESULT_READY=false until ticket 07.

- [x] Each seeded kind is raised with the referencing sentence as its Source sentence; no Clean result while any is unresolved; once all are marked reviewed a Clean result is given (PRD criterion 6, in part). Evidence: tests/unit/outside-references.test.js (cleanResultOf with the gate's logic: blocked until every reference is marked, an "as amended" Red line 3 match never resolves); tests/e2e/outside-references.spec.mjs. The shown Clean result stays held by the gate until ticket 07.
- [x] Marked as reviewed is saved and shown as the Reviewer's statement, not something Redline checked. Evidence: reviews.outside_references (migration 20261031003000), tests/isolation/outside-references.test.ts (another account can't read or write it), tests/e2e/outside-references-saved.spec.mjs (survives reload and reopen).
- [x] A network check shows no request to any referenced address. Evidence: both e2e specs record every request.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Comments

- From ticket 11 (2026-10-31, settled by the Fable advisor): the Clean result is held back by `CLEAN_RESULT_READY = false` in lib/review/clean-result-gate.js until this ticket and ticket 07 both land; remove the gate together with 07. This ticket must:
  - populate `outsideReferences` in Review's output (cleanResultOf counts an entry as resolved only when `resolved === true`; anything else blocks);
  - persist the list in `toStoredReview` and read it back in `reopenReview`, removing the hardcoded `outsideReferences: []` there;
  - persist "marked as reviewed" as the Reviewer's statement, not something Redline checked.
- Lift the gate only when a no-flags fixture with a Statement of Work, web address or "as amended from time to time" reference is not a Clean result until every reference is marked reviewed, and (with ticket 07) a no-flags fixture with one Ambiguous clause is not a Clean result.
