# Questions for the product owner

Open items that block work. Each one is skipped, not guessed, until answered. The 21 open questions in PRD.md section 3 stay there; this file tracks the ones being closed for the unattended build.

## Batch 1 (asked 2026-10-20, unanswered)

1. ~~**C1, ranking.**~~ Resolved 2026-10-20: group by level only. CLAUDE.md scope item 2 now says "grouped by severity (not ranked within a level, ADR 0003)". Ticket 03's ordering criterion is unblocked.
2. **C2 and ticket 20, scope additions.** Which of these join the six capabilities in CLAUDE.md: Clean result (ADR 0006), Outside reference flow (ADR 0007), Copy all as text (ticket 20). Blocks tickets 11, 13, 16, 18, 20.
3. **C4, Counter-offers.** How "state only what the document says" applies to new replacement wording. Recommended: it governs claims about the document; the proposed wording is exempt. Blocks ticket 08.
4. **Q20, model.** Sonnet 5.5, Opus 5.5, or run both on fixtures and then choose. Not picked. Blocks ticket 09.

C3 (the words "user" and "owner" in CLAUDE.md versus Reviewer and Owner in CONTEXT.md) is a wording fix. It needs no decision, only an edit to CLAUDE.md once you approve changing that file.
