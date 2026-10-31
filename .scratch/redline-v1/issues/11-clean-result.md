# 11: Clean result

**What to build:** A review with no Don't sign as written or Negotiate flags says plainly it is a Clean result, lists every Red line checked, and shows Know this flags beneath.

**Blocked by:** 06 (Default Red lines drive the analysis)

**Decisions (2026-10-31):** C2: Clean result is in scope. Withheld flags and Ambiguous clauses block it (ADR 0006 plus spec-gaps 15 and 16).

**Needs approval for:** None

**Status:** ready-for-agent

- [x] Clean result content: the plain statement, every Red line in the Review input, and the Know this flags (PRD criterion 7).
- [x] The verdict-word check on Clean result text finds zero "safe", "fine" or "good to sign" (PRD criterion 8).
- [x] Fixtures contain no withheld flags, Ambiguous clauses or Outside references; those cases are tickets 13 and 16.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Evidence (2026-10-31, branch feature/11-clean-result)

- Rule: cleanResultOf in lib/review/review.js decides it in code from the finished review: only Know this flags, withheldCount 0, no Ambiguous clause, no unresolved Outside reference (resolved only when an entry has resolved === true). null when the Risk flags could not be read. reopenReview in lib/review/saved.js calls the same function. Unit tests: tests/unit/clean-result.test.js.
- Content (criterion 7): fixture clean-agreement-01 gives a Clean result with all four Default Red lines and its two Know this flags; tests/e2e/clean-result.spec.mjs checks the statement, every Red line checked in order, and Know this beneath. Fake adapter only; not yet run on a real document.
- Verdict words (criterion 8): findBannedWording finds nothing in COPY.clean, the Default Red lines, or the rendered Clean result block minus Source sentences (unit and e2e).
- Fixtures: clean-agreement-01 has no withheld flags, Ambiguous clauses or Outside references. Blocking cases for those are checked through cleanResultOf directly and inline scripted replies, not new fixtures.
- Copy: COPY.clean and the new COPY.flags.none went through the humanizer skill.
- Gate (Fable advisor, 2026-10-31): `CLEAN_RESULT_READY = false` in lib/review/clean-result-gate.js holds the Clean result back until tickets 13 and 07 land. While it holds, cleanResult is null in fresh and reopened reviews; cleanResultHeld is true when the rule would give a Clean result, and the review then shows one line saying Redline can't check Outside references or Ambiguous clauses yet, alongside every Red line checked and its Know this flags (unit: tests/unit/clean-result.test.js; e2e: tests/e2e/clean-result.spec.mjs). The Clean result view (statement, Red lines checked, Know this beneath) was verified in the browser before the gate and stays in RiskFlags.js for when it lifts.
