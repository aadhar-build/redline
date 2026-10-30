# Map: close the spec gaps in Redline v1

Label: wayfinder:map
Tickets: `.scratch/spec-gaps/issues/` (local-markdown tracker, docs/agents/issue-tracker.md)

## Destination

Every implementation ticket in `.scratch/redline-v1/issues/` has a Blocked-by line that names only other implementation tickets (no OQ or C references), every PRD.md section 3 open question a v1 ticket depends on is marked decided with a link to its ticket here, and the dependencies those tickets need are approved.

## Notes

- Domain: the product spec for Redline v1. Read CLAUDE.md, CONTEXT.md, PRD.md, `.scratch/redline-v1/spec.md` and docs/adr/ before working a ticket.
- Grilling tickets call the grilling and domain-modeling skills. Any copy a Reviewer will read goes through the humanizer skill.
- HITL tickets resolve only from the product owner's own answer. A recommended option is not an answer. If no answer comes, the ticket stays open and the question goes into QUESTIONS.md.
- Each resolution flows back to three places: the PRD.md section 3 entry (marked decided, linked here), `.scratch/redline-v1/spec.md` Further Notes, and the Blocked-by line of every implementation ticket it unblocks. A new ADR is written when the decision is one ADR-worthy (domain-modeling skill decides).
- Execution override (owner, 2026-10-31: "as they start getting clarity, lets push to development"): once an implementation ticket's blockers are all cleared, it may be built on its own feature branch and pushed. Never to main. No Vercel deploy without asking.
- C1 (ranking within a Severity level) is already settled: grouped by level, not ranked (ADR 0003, CLAUDE.md edit 2026-10-20).

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

## Not yet specified

- **Eval targets.** PRD.md section 4 "Numbers that are unset": targets for misses, false alarms, Clean result share, how many Know this flags is too many, and a method for catching unsupported claims. Becomes sharp once the model (ticket 05) and Market standard basis (ticket 19) are known and a first real run exists.
- **What a "clear case" for Don't sign as written is**, outside Red line matches (ADR 0005). Probably falls out of ticket 19.
- **Real test contracts.** No test set of real vendor agreements, leases or client agreements exists; where they come from is a task ticket once the eval targets are clearer.

## Out of scope

- Payments, OCR, sharing between accounts: excluded in CLAUDE.md.
- Missing protection flags and after-signing help: ADR 0001, ADR 0002.
