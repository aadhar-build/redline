# 0003. Severity comes from departure from Market standard

Status: Accepted, 2026-09-11

## Decision
A Risk flag's Severity is set by how far the clause departs from Market standard, not by its worst-case cost. There are three Severity levels, each defined by the Reviewer's next action: Don't sign as written, Negotiate, Know this. Statements about what a clause says are made as fact and backed by its Source sentence. The claim that a clause is an Unusual clause is labelled as Redline's judgment, because the document cannot prove it.

## Alternatives
- **Worst-case cost if the Counterparty enforces the clause as written** (money at stake, personal exposure, irreversibility). This was recommended during the brief and rejected by the product owner.
- **Likelihood the clause is actually used.** Rejected because it needs knowledge of the Counterparty's behaviour that the document does not contain.
- **A 1–10 score.** Rejected as false precision a Reviewer cannot explain to an Owner.
- **Two levels (flagged or not).** Rejected because a personal guarantee and a 60-day notice window would look the same.

## Why
No reason was stated by the product owner. What the choice buys:
- Reviewers are not shown clauses they already know are boilerplate at high Severity, which keeps the top level meaningful.
- Each level answers the Reviewer's actual question: what do I raise?

## Consequences
- **Conflicts with ADR 0001 and CLAUDE.md's "state only what the document says".** Market standard comes from outside the document. Resolved by labelling unusualness as judgment, not fact: the reader can verify the quote but not the comparison.
- **A common but harmful clause ranks low on its own.** The FTC First American case, a $495 exit fee on a three-year lock-in in the processor's standard agreement, would not have ranked high (research/summary.md, pain point 1). Default Red lines (ADR 0004) are what catch such clauses; removing one lowers protection.
- **A clause that matches a Red line is marked Don't sign as written regardless of Market standard.** Proposed during the brief; it stands because the product owner did not object when asked.
- **Within a level, flags are not ranked against each other.**
- **Redline needs a basis for Market standard per contract type** (vendor agreement, commercial lease, client agreement). The research provides none.
