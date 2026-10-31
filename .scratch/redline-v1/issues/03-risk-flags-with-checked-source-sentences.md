# 03: Risk flags with checked Source sentences

**What to build:** Each Risk flag shows its Source sentence, one Severity, and what the clause says stated as fact. Redline's code withholds and counts any flag whose Source sentence it cannot find in the document text.

**Blocked by:** 01 (Pasted text gets a plain-English summary)

**Decisions (2026-10-31):** C1: grouped by Severity, not ranked (ADR 0003).

**Needs approval for:** a schema validator for model output, only if one is wanted.

**Status:** ready-for-agent

- [x] With the fake adapter returning altered or invented Source sentences, every one is withheld, none shown, and the withheld count equals the number withheld (PRD criterion 2).
- [x] Every displayed Source sentence is found in the document text; the interim check accepts identical text only and errs toward withholding; the tolerant rule comes in ticket 14, so criterion 1 is only partly covered here (PRD criterion 1).
- [x] Every Unusual clause or Market standard claim carries the label Redline's judgment (PRD criterion 9).
- [x] The hedge-word and verdict-word check extends to Risk flag text (PRD criterion 8).
- [x] Flags are grouped by Severity and not ranked within a level; this criterion waits on C1.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

**Evidence (2026-10-31, branch feature/03-risk-flags):**
- Criterion 2: the local fake script for vendor-agreement-01 returns 11 flags, 5 of them with altered or invented quotes: ninety changed to sixty, an invented guarantee, two sources with one invented, an ellipsis splice and a cut-off sentence. All 5 are withheld. None of their text appears in the review or on the page, and the count shown is 5 (tests/unit/risk-flags.test.js, tests/e2e/risk-flags.spec.mjs).
- Criterion 1: the check follows ADR 0010, as the orchestrator directed: safe normalisations, a span on sentence boundaries, and the stored span shown. It does not use "identical text only". Spans have to be whole sentences, which errs toward withholding. Each pasted-text negative from research 09 section 7 is withheld: 30 changed to 60, shall changed to may, not dropped, a defined term's case changed, unless dropped, and an ellipsis splice. NBSP, U+200B, curly quotes and an em dash in the document still match. Tests check that each displayed sentence equals the stored-text slice at its offsets. This only partly covers PRD criterion 1 until ticket 14.
- Criterion 9: the model's "judgment" field always carries the label Redline's judgment. Any flag text that uses Market standard wording gets the label too (QUESTIONS.md 10).
- Criterion 8: banned words in a flag's title, says and judgment are marked, as in the summary. Source sentences are never marked.
- C1: groups run Don't sign as written, Negotiate, Know this. Within a group, flags follow the document order of their first Source sentence, not the model's order.
- Not run against a real document: there is no real model adapter yet (ticket 09).
