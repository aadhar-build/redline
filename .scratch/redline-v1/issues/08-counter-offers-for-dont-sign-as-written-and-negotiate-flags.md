# 08: Counter-offers for Don't sign as written and Negotiate flags

**What to build:** Each Don't sign as written and Negotiate flag has a Counter-offer the Reviewer can send to the Counterparty.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** C4/OQ14: Counter-offer wording may only restate or tighten terms in the document, and no hedge words in it (../../spec-gaps/issues/03-truth-rule-and-hedge-words-in-counter-offer-wording.md).

**Needs approval for:** None

**Status:** built with ticket 17 on feature/08-counter-offers

- [x] Every displayed Don't sign as written and Negotiate flag has a Counter-offer (PRD criterion 12, in part). Evidence: tests/unit/counter-offers.test.js ("every flag has a Counter-offer", all eight scripted fixtures); tests/e2e/counter-offers.spec.mjs (every shown flag has a visible Counter-offer box after its Source sentences, with a copy button). A flag that comes back without one still shows, with "Redline has no Counter-offer for this flag." (QUESTIONS.md 25).
- [ ] A person reads Counter-offers for claims about the document it does not support (PRD criterion 17). Not done: no real run of Counter-offers yet. Code cannot catch a new term. The prompt states the restate-or-tighten rule. The counter-offers-01 fixture scripts a new term (insurance), and the tests assert it shows unmarked, so a person has to read for it.
- [ ] Know this flags and Outside references get no Counter-offer yet (tickets 17 and 18); the hedge-word check does not run on Counter-offers yet (OQ14). Superseded: built together with ticket 17. Know this flags get Counter-offers and the check runs. Outside references don't exist yet (ticket 18).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). COPY.counterOffer in app/(app)/review/copy.js.

## Notes

- Code: lib/review/counter-offer.js (check and prompt lines), wired into Review (lib/review/review.js) and saved reviews (lib/review/saved.js: stored as `counter_offer` in the flags jsonb, marks worked out again on reopen; no migration, since the database check inspects only source_sentences). UI: app/(app)/review/CounterOffer.js inside each flag panel.
- The prompt names the side the Counter-offer protects: the Owner the Reviewer fixed, or "the party you give as ownerParty" (ticket 22).
- Numbers: a number in a Counter-offer that the contract lacks is highlighted with its own note and never withheld, because tightening a term can legitimately change a figure. Which direction counts as tightening depends on the clause, so code doesn't judge it (QUESTIONS.md 24). Only numbers written in digits are seen.
