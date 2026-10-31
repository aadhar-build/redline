# India Market standard table: approved 2026-10-31 (statute rows only)

Ticket: [Draft the India Market standard table](../issues/28-india-market-standard-table.md). ADR 0009. Drafted 2026-10-31 from [research 25](../research/25-india-market-standard-sources.md).

Nothing here reaches the model until the product owner approves the row. "Strength" says what stands behind the figure: **primary** (a government form or statute read in full), **primary, snippet** (a primary source seen only second-hand; verify before approving), **reported deals** (figures that recur in deal reports and broker blogs, not a survey).

Statute rows (C2, C4, L7) form the approved statute list (ticket 29): the model may only select them by id, and Redline shows the row's own text. C2 applies only when the account says the Owner is a Udyam-registered micro or small enterprise.

Owner rulings 2026-10-31: GeM rows struck; state-specific rows (Maharashtra format, Model Tenancy Act cap) struck because Redline does not ask which state a lease is in.

## Vendor and supplier agreements (Owner buys)

No rows. The owner ruled out GeM procurement terms as a stand-in for private B2B practice (2026-10-31); vendor clauses get Severity from the Red lines only until another source is found.

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|

## Client and services agreements (Owner supplies)

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|
| C2 | Payment terms, micro or small supplier | No more than 45 days after acceptance (15 days with no written agreement); late payment carries compound interest at 3x the RBI bank rate whatever the contract says | MSMED Act 2006 ss.15–16 | statute, primary snippet (India Code fetch failed; DC-MSME summary read). Applies only if the Owner is Udyam-registered micro or small | yes, after ticket 30 verifies wording |
| C4 | Non-compete after the contract ends | Void to the extent it restrains a lawful trade (only exception: sale of goodwill) | Indian Contract Act 1872 s.27 | statute, snippet | yes, after ticket 30 verifies wording |

## Commercial leases and leave and licence

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|
| ~~L3~~ struck | Lock-in | 3 years | Office deal reports (Aon Bengaluru, Table Space Gurugram, Bank of America Powai) | reported deals, large occupiers, not SME shops | |
| ~~L4~~ struck | Rent escalation | 15% every 3 years (offices) or 5% a year (malls) | Deal reports; consultant quoted in BloombergQuint | reported deals | |
| ~~L5~~ struck | Security deposit | 3–10 months' rent, wide spread | Broker blogs | reported deals, weak | |
| L7 | Registration | A lease over one year must be registered; unregistered, it cannot prove the transaction | Registration Act 1908 ss.17(1)(d), 49 | statute, snippet | yes, after ticket 30 verifies wording |

## Gaps the owner should know about

- No row comes from a measured survey of Indian SME contracts; none exists publicly.
- No row for auto-renewal, price changes or personal guarantees: the four Default Red lines cover those regardless of Market standard.
- Redline does not ask which state a lease is in, so no state-specific row is used.
