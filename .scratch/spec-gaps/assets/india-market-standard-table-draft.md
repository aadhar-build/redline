# India Market standard table: DRAFT, not approved

Ticket: [Draft the India Market standard table](../issues/28-india-market-standard-table.md). ADR 0009. Drafted 2026-10-31 from [research 25](../research/25-india-market-standard-sources.md).

Nothing here reaches the model until the product owner approves the row. "Strength" says what stands behind the figure: **primary** (a government form or statute read in full), **primary, snippet** (a primary source seen only second-hand; verify before approving), **reported deals** (figures that recur in deal reports and broker blogs, not a survey).

Statute rows are legal points. They can only be shown once the statute-citation check (ticket 29) is settled.

## Vendor and supplier agreements (Owner buys)

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|
| V1 | Liability cap | Each party's total liability capped at the contract value; no indirect or consequential damages; exceptions for third-party IP claims, gross negligence and wilful misconduct | GeM GTC 4.0 v1.29 (25 Mar 2026), cl.18 | primary (government-as-buyer form; copy read from IISER Berhampur, confirm on gem.gov.in) | |
| V2 | Liquidated damages for late delivery | 0.5% of the delayed value per week, capped at 5% (10% for delay over 25% of the delivery period) | GeM GTC v1.29, cl.15 | primary (government-as-buyer) | |
| V3 | Performance security | 3–5% of contract value | GeM GTC v1.29, cl.7 | primary (government-as-buyer) | |

## Client and services agreements (Owner supplies)

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|
| C1 | Payment terms | Payment within 10 days of acceptance | GeM GTC v1.29, cl.12 | primary (government-as-buyer; tenders often override to 45–90 days) | |
| C2 | Payment terms, micro or small supplier | No more than 45 days after acceptance (15 days with no written agreement); late payment carries compound interest at 3x the RBI bank rate whatever the contract says | MSMED Act 2006 ss.15–16 | statute, primary snippet (India Code fetch failed; DC-MSME summary read). Applies only if the Owner is Udyam-registered micro or small | |
| C3 | Liability cap | As V1 | GeM GTC v1.29, cl.18 | primary (government-as-buyer) | |
| C4 | Non-compete after the contract ends | Void to the extent it restrains a lawful trade (only exception: sale of goodwill) | Indian Contract Act 1872 s.27 | statute, snippet | |

## Commercial leases and leave and licence

| # | Clause type | Typical term | Source and date | Strength | Approve? |
|---|---|---|---|---|---|
| L1 | Notice to end | One month's written notice on either side | Maharashtra IGR leave-and-licence e-registration format, cl.9 | primary (residential-shaped, Maharashtra) | |
| L2 | Overstay | Double daily compensation | Maharashtra IGR format, cl.10 | primary (residential-shaped) | |
| L3 | Lock-in | 3 years | Office deal reports (Aon Bengaluru, Table Space Gurugram, Bank of America Powai) | reported deals, large occupiers, not SME shops | |
| L4 | Rent escalation | 15% every 3 years (offices) or 5% a year (malls) | Deal reports; consultant quoted in BloombergQuint | reported deals | |
| L5 | Security deposit | 3–10 months' rent, wide spread | Broker blogs | reported deals, weak | |
| L6 | Security deposit cap | 6 months' rent for non-residential premises, where the state has adopted it | Model Tenancy Act 2021 s.11 | statute (model act), snippet; binds only adopting states | |
| L7 | Registration | A lease over one year must be registered; unregistered, it cannot prove the transaction | Registration Act 1908 ss.17(1)(d), 49 | statute, snippet | |

## Gaps the owner should know about

- No row comes from a measured survey of Indian SME contracts; none exists publicly.
- Vendor and services rows lean on government procurement terms. Whether they can stand for private B2B practice is the owner's call.
- No row for auto-renewal, price changes or personal guarantees: the four Default Red lines cover those regardless of Market standard.
- Lease rows depend on the state (stamp duty, registration, deposit caps). Redline does not yet ask which state a lease is in.
