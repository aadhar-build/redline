# 0004. Ship four Default Red lines

Status: Accepted, 2026-09-11

## Decision
Red lines ship pre-filled with four Default Red lines, which the Reviewer can edit or remove. Each is labelled with its basis:
1. **Personal guarantee:** the Owner is personally liable for the business's obligations. Basis: research, qualitative only and snippet only (A2 F8).
2. **Auto-renewal with an exit fee, or a minimum term over 12 months.** Basis: research, FTC consumer complaint volume (A2 F1) and the First American case (A1 F1). The 12-month threshold is the product owner's judgment; the only term length in the research is First American's three years.
3. **The Counterparty can change terms or prices without the Owner's consent.** Basis: weak. The cited figure (A2 F9) is a snippet-only statistic about consumers not reading terms of service; the research has no evidence of small businesses harmed by terms changed later.
4. **Uncapped indemnity or liability carried by the Owner.** Basis: the product owner's judgment; the research found no complaint data for indemnity or liability caps.

Sources: research/summary.md, sections 1, 2 and 6.

## Alternatives
- **An empty list the Reviewer fills in.** Every Red line would reflect the business's own choices, but the first document gets no Red-line analysis and most lists stay empty.

## Why
Redline has to earn trust on the first document, and an empty list fails it. Under ADR 0003, Default Red lines are also what catch harmful clauses that are Market standard.

## Consequences
- **Redline ships with opinions, and one of the four is not backed by evidence.** The brief must say so rather than present it as data.
- **A Reviewer who removes a Default Red line loses protection** against that clause when it is Market standard (ADR 0003).
- **The defaults are written for small-business contracts reviewed before signing** (ADR 0002) and would not suit consumers or freelancers.
