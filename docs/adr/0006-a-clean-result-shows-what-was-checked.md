# 0006. A Clean result shows what was checked

Status: Accepted, 2026-09-11

## Decision
When a review has no Don't sign as written or Negotiate flags (and no unresolved Outside reference, ADR 0007), it is a Clean result. Redline says so plainly, lists every Red line it checked, and shows any Know this items beneath. It never uses the words safe, fine or good to sign.

## Alternatives
- **Always surface the top few items so a report is never empty.** This is the crying-wolf problem: every document looks like it has something wrong with it.
- **A clean verdict such as "Looks good".** It is the claim Redline can least back up.

## Why
What it buys:
- **Flags that stay believable.** Most documents are acceptable, and a tool that always finds problems stops being believed.
- **A Clean result that is credible.** The list of checked Red lines shows the work, rather than looking like Redline did nothing.

## Consequences
- **The Owner does not get the reassuring verdict they want.**
- **Tension, recorded deliberately:** ADR 0005 sends uncertain flags to Know this, so almost every Clean result still carries Know this items; ADR 0007 blocks a Clean result while any Outside reference is unresolved, which most vendor agreements contain. Clean results will therefore be rare in practice, which undercuts the believability this decision is meant to protect.
