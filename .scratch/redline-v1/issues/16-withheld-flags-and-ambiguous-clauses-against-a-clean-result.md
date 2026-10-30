# 16: Withheld flags and Ambiguous clauses against a Clean result

**What to build:** Settles where the withheld count is shown, whether a review with withheld flags can be a Clean result, and whether an Ambiguous clause is a Risk flag and blocks a Clean result.

**Blocked by:** 07 (Ambiguous clauses shown with their readings); 11 (Clean result)

**Decisions (2026-10-31):** OQ5: Ambiguous clause is a Negotiate flag that blocks a Clean result. OQ11/OQ12: withheld count shown to the Reviewer; any withheld flag blocks a Clean result.

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] The withheld count appears where OQ11 decides (PRD criterion 2).
- [ ] Clean result fixtures including withheld flags and Ambiguous clauses give the outcome OQ12 and OQ5 decide (PRD criterion 7, 11).
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
