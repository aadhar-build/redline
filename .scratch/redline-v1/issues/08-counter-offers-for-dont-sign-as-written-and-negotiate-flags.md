# 08: Counter-offers for Don't sign as written and Negotiate flags

**What to build:** Each Don't sign as written and Negotiate flag has a Counter-offer the Reviewer can send to the Counterparty.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** C4/OQ14: Counter-offer wording may only restate or tighten terms in the document, and no hedge words in it (../../spec-gaps/issues/03-truth-rule-and-hedge-words-in-counter-offer-wording.md).

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31); person-read on a real run still open

- [x] Every displayed Don't sign as written and Negotiate flag has a Counter-offer (PRD criterion 12, in part). Evidence: tests/unit/counter-offers.test.js ("every flag has a Counter-offer", all eight scripted fixtures); tests/e2e/counter-offers.spec.mjs (every shown flag has a visible Counter-offer box after its Source sentences, with a copy button). A flag that comes back without one still shows, with "Redline has no Counter-offer for this flag." (QUESTIONS.md 25).
- [ ] A person reads Counter-offers for claims about the document it does not support (PRD criterion 17). Not done: no real run of Counter-offers yet. Code cannot catch a new term. The prompt states the restate-or-tighten rule. The counter-offers-01 fixture scripts a new term (insurance), and the tests assert it shows unmarked, so a person has to read for it.
- [ ] Know this flags and Outside references get no Counter-offer yet (tickets 17 and 18); the hedge-word check does not run on Counter-offers yet (OQ14). Superseded: built together with ticket 17. Know this flags get Counter-offers and the check runs. Outside references don't exist yet (ticket 18).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). COPY.counterOffer in app/(app)/review/copy.js.

## Notes

- Code: lib/review/counter-offer.js (check and prompt lines), wired into Review (lib/review/review.js) and saved reviews (lib/review/saved.js: stored as `counter_offer` in the flags jsonb, marks worked out again on reopen; no migration, since the database check inspects only source_sentences). UI: app/(app)/review/CounterOffer.js inside each flag panel.
- The prompt names the side the Counter-offer protects: the Owner the Reviewer fixed, or "the party you give as ownerParty" (ticket 22).
- Numbers: a number in a Counter-offer that the contract lacks is highlighted with its own note and never withheld, because tightening a term can legitimately change a figure. Which direction counts as tightening depends on the clause, so code doesn't judge it (QUESTIONS.md 24). Only numbers written in digits are seen.

## 08b: Counter-offers that add terms (final real run, bug 1), 2026-10-31

Branch `feature/08b-counter-offer-new-terms`. Two layers:
- **Prompt** (lib/review/counter-offer.js `counterOfferPromptPart`): lists what a Counter-offer is allowed to do (delete words, narrow a right, cap or shorten what the document states, restate) and what it never adds (a duty, notice step, cure period, consent standard such as "not unreasonably withheld", refund or return obligation, carve-out, evidence requirement, cross-reference to an amount the document doesn't state). When the only fix needs a new term, the model restates and tightens as far as the document allows and sets `"needsNewTerm": true` with `"newTermNote"`. The UI and Copy all show that as "Redline's judgment: the contract has no …", never as wording. The note is stored as `counter_offer_note` in the flags jsonb (no migration).
- **Code backstop, marked never withheld** (`findNewTerms`): a content word of 4+ letters, not a stopword, whose light stem (case-folded, prefix-tolerant) isn't among the document's stems is marked `kind: "new-term"`, neighbours joined into one phrase. "not (to be) unreasonably withheld" and "the amount/date/... stated in this Agreement" are marked when the document lacks the phrase. Shown with a dotted underline and its own note; Copy all brackets them.

Measurement: T01, T02, T05, T06, T07, Sonnet 5.5 through the CLI adapter, default Red lines, one run each, same text as the final run. Counts only; read by hand.

| | Counter-offers | Add a term the document lacks | Marked by the backstop |
|---|---|---|---|
| Before (final run, development 9707cd1) | 37 | 12 | 20 Counter-offers marked; 8 of the 12 adders among them |
| After (this branch) | 35 | 3 (T05 1, T06 1, T07 1) | 2 Counter-offers marked; 1 of the 3 adders among them |

- After: 15 Counter-offers set needsNewTerm with a note; 0 marked hedge words or numbers.
- The 3 remaining adders use only words already in the document (a right moved from one party to the other, a charge restated as included, a limit tied to the payment schedule), so a word check can't see 2 of them. Criterion 17 still needs a person reading; it is not met at 0.
- Backstop false positives on the before outputs: mostly cross-reference words ("clause", "stated") on a document that never uses them, and inflections the light stemmer misses. 
