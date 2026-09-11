# 0002. v1 serves Reviewers of small-business contracts before signing

Status: Accepted, 2026-09-11

## Decision
Redline v1 is for a Reviewer checking a negotiable small-business contract (vendor agreement, commercial lease, client agreement) before the Owner signs it. Redline v1 is not for freelancers, not for consumers or renters (terms of service, gym contracts, card agreements, residential leases), and not for anyone who has already signed.

## Alternatives
- **Freelancers.** They have the largest individual losses (91% paid late, 62% unpaid, 53% lost $10k+). Rejected because their worst harm is a Missing protection, which ADR 0001 rules out flagging, and only 28% use a written contract.
- **Consumers and renters.** The largest audience. Rejected because their terms are mostly non-negotiable with no Counterparty to send a Counter-offer to, free substitutes exist (LeaseChat, ToS;DR, ChatGPT), and there is no willingness-to-pay evidence.
- **The Owner as the user, wanting a sign/don't-sign verdict.** Rejected because Source sentences and a saved library serve someone who has to justify each Risk flag to someone else.
- **After-signing help (exit terms, cancellation deadlines).** The best-documented pain (69% discover terms after signing; ~70 FTC auto-renewal complaints a day). Rejected because Counter-offers are useless once signed.

## Why
Small business contracts are the one setting where every v1 capability has a use:
- Owners engage with contracts often: 91% monthly, 45% weekly (A4 F7);
- they avoid lawyers on cost (60%, snippet only);
- there is a Counterparty who negotiates, so Risk flags lead to Counter-offers.

The research names this as the least weak case, while warning that willingness to pay is unmeasured (research/summary.md, sections 1, 4 and 5).

## Consequences
- **Reviewers were never studied.** The research did not cover ops managers, bookkeepers or office managers. This choice rests on the product's shape, not on evidence, and needs validating first.
- **Payer and user may differ.** The Owner may pay while the Reviewer uses Redline; nothing in the research covers who pays.
- **Willingness to pay is unmeasured** for small business owners too.
- **Known exclusions.** Freelancers' top pain and consumers already trapped by auto-renewal are knowingly left out; the brief must say so.
- **Severity means "what to push back on before signing"**, not "how to get out".
