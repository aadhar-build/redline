# Questions for the product owner

Open items that block work. Each one is skipped, not guessed, until answered. The full decision record is the wayfinder map at .scratch/spec-gaps/map.md.

## Batch 1 (asked 2026-10-20; all answered 2026-10-31)

1. ~~C1, ranking.~~ Group by level only (ADR 0003).
2. ~~C2, scope additions.~~ Clean result, Outside references and Copy all all join the scope.
3. ~~C4, Counter-offers.~~ The truth rule and the hedge-word ban both apply to the wording; it may only restate or tighten terms in the document.
4. ~~Q20, model.~~ Sonnet 5.5.

## Open (2026-10-31)

1. **OCR engine.** Waits on the bake-off (.scratch/spec-gaps/issues/27). Needs 3–5 real Indian contract scans from you (stamp paper, phone photos to PDF), shared locally, never committed.
2. **India Market standard table.** A draft will need your approval row by row (.scratch/spec-gaps/issues/28).
3. **Statute citations.** How a cited statute is checked before it is shown (.scratch/spec-gaps/issues/29). No legal point is shown until this is settled.
4. ~~"fine" as a penalty (from ticket 01).~~ Answered 2026-10-31: "fine" is allowed in the money sense, when an amount sits right before or after it ("a fine of Rs. 5,000", "₹500 fine", "fine of INR 2,000"). Every other "fine" stays banned. Built in lib/review/wording.js.
5. ~~"May" as a month (from ticket 01).~~ Answered 2026-10-31: "May" is allowed as the month when it is capitalised and next to a day number or a year ("1 May", "May 1", "May 2026"). Lowercase "may" is always banned. Built in lib/review/wording.js.
6. ~~What happens when a summary breaks the ban (from ticket 01).~~ Answered 2026-10-31: show the summary with the banned words highlighted and a short note saying why. Review returns the marked spans with the summary.
