# 0009. Market standard for Indian contracts comes from a curated, dated table

Status: Accepted, 2026-10-31. Refines ADR 0003.

## Decision
- Redline v1 serves English-language Indian small-business contracts. Documents in other languages are rejected with a clear message; output is in English.
- Market standard comes from a reference table Redline maintains per contract type (vendor agreement, commercial lease including leave and licence, client agreement) and clause type. Every row cites its source and date. A Severity claim with no row behind it is labelled Redline's judgment.
- Before analysis the model proposes the contract type and the Reviewer confirms or changes it. A document that is none of the three is checked against the Red lines only, without Market-standard Severity, and the review says so.
- Redline may state a legal point only when it cites the statute it rests on (for example Indian Contract Act s.27 on non-competes). How a statute citation is checked is .scratch/spec-gaps/issues/29; until it is settled, no legal point is shown.

## Alternatives
- **Severity only where a source exists**, everything else Know this. Not chosen.
- **No basis at all; every Market-standard Severity labelled Redline's judgment.** Not chosen.
- **No legal claims in v1.** Offered and not chosen.

## Why
Research found no Indian survey of small-business contract terms and no Indian equivalent of Common Paper or Bonterms (.scratch/spec-gaps/research/25-india-market-standard-sources.md). A dated table with a source on every row keeps each Severity claim traceable, which ADR 0001 and ADR 0005 demand.

## Consequences
- The table has to be written and approved row by row before the model sees it (.scratch/spec-gaps/issues/28).
- Broker-report figures for lease terms are weaker than government sources; the table says which is which.
- Legal points raise the accuracy bar: a wrong statute citation is a false claim.
