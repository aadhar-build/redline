# 13: Outside references raised and marked as reviewed

**What to build:** Sentences bringing in a web address, a Statement of Work or an Order Form are raised as Outside references with their checked Source sentence, and block a Clean result until the Reviewer marks them reviewed.

**Blocked by:** 10 (Saved library); 11 (Clean result)

**Decisions (2026-10-31):** C2: the Outside reference flow is in scope.

**Needs approval for:** None

**Status:** built on feature/13-outside-references, awaiting merge. Clean-result gate lifted here with ticket 07 (CLEAN_RESULT_READY = true).

- [x] Each seeded kind is raised with the referencing sentence as its Source sentence; no Clean result while any is unresolved; once all are marked reviewed a Clean result is given (PRD criterion 6, in part). Evidence: tests/unit/outside-references.test.js (cleanResultOf with the gate's logic: blocked until every reference is marked, an "as amended" Red line 3 match never resolves); tests/e2e/outside-references.spec.mjs. With the gate lifted, marking every reference reviewed gives a shown Clean result (outside-references-saved.spec.mjs).
- [x] Marked as reviewed is saved and shown as the Reviewer's statement, not something Redline checked. Evidence: reviews.outside_references (migration 20261031003000), tests/isolation/outside-references.test.ts (another account can't read or write it), tests/e2e/outside-references-saved.spec.mjs (survives reload and reopen).
- [x] A network check shows no request to any referenced address. Evidence: both e2e specs record every request.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Comments

- From ticket 11 (2026-10-31, settled by the Fable advisor): the Clean result is held back by `CLEAN_RESULT_READY = false` in lib/review/clean-result-gate.js until this ticket and ticket 07 both land; remove the gate together with 07. This ticket must:
  - populate `outsideReferences` in Review's output (cleanResultOf counts an entry as resolved only when `resolved === true`; anything else blocks);
  - persist the list in `toStoredReview` and read it back in `reopenReview`, removing the hardcoded `outsideReferences: []` there;
  - persist "marked as reviewed" as the Reviewer's statement, not something Redline checked.
- Lift the gate only when a no-flags fixture with a Statement of Work, web address or "as amended from time to time" reference is not a Clean result until every reference is marked reviewed, and (with ticket 07) a no-flags fixture with one Ambiguous clause is not a Clean result.
- Follow-up 13b (2026-10-31, feature/13b-outside-reference-rulings): built the Fable advisor's rulings on QUESTIONS.md 27 to 31. Statute "as amended" kept at Negotiate without the Red line 3 match, fail-closed, never exempt with a possessive or party term (27); raw matching capped across all patterns; other "as amended" wordings, quoted in the copy (28); Red line 3 matches only with its catches, so a reworded line gives Negotiate (29); one reference per referenced document, one mark per group, stored as {kinds, label, source_sentences[], reviewed, reviewed_at} by migration 20261031003100, which cleared the earlier test rows (30); a model flag that only repeats a Red line 3 reference is merged and counted in mergedCount (31). Evidence: tests/unit/outside-reference-rulings.test.js, tests/isolation/outside-references.test.ts, tests/e2e/outside-references.spec.mjs. Known limit: mergedCount is not stored, so a review reopened from a row saved after the merge shows no merged line (the flag was never stored); a row that stored the flag is merged again on reopen.
