# 0005. Lean toward flagging and state judgment plainly

Status: Accepted, 2026-09-11

## Decision
- **When unsure, flag, but only at Know this.** When Redline is unsure whether a clause hurts the Owner, it raises a Risk flag at Know this. Don't sign as written is reserved for clauses that match a Red line and for clear cases.
- **No hedge words.** Redline does not write "may", "could potentially" or "consider consulting a lawyer". What a clause says is stated as fact, backed by its Source sentence. Any claim the Source sentence cannot prove carries the label Redline's judgment.
- **An Ambiguous clause is shown with its possible readings** rather than a guess at which one applies.

## Alternatives
- **Lean toward silence: flag only what is certain.** A missed personal guarantee or uncapped indemnity then reaches the signature.
- **Always a plain, confident voice, with uncertainty shown only through Severity.** Useful, but sometimes confidently wrong.
- **Hedged language.** Safe for Redline and unusable for the Reviewer. It is also the voice of the tools whose trust failed, such as DoNotPay (research/summary.md, section 3).

## Why
What it buys:
- **The cheaper mistake.** A miss costs the Owner money; a false alarm costs the Reviewer time. For small-business contracts, money is the worse loss.
- **A top level that keeps its meaning.** Uncertain flags stay at Know this, so Don't sign as written still means Redline is sure.
- **Fact and judgment kept apart,** following ADR 0001 (every claim sits next to a Source sentence the reader can check) and ADR 0003 (unusualness is labelled as judgment).

## Consequences
- **Know this fills up** and becomes the part Reviewers skim.
- **Output reads like an audit, not advice.** Some Reviewers will find it cold.
- **Redline must tell "unsure it hurts" from "unsure what it means".** The first is a Know this flag; the second is an Ambiguous clause shown with its readings.
