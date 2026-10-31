# Questions for the product owner

Open items that block work. Each one is skipped, not guessed, until answered. The full decision record is the wayfinder map at .scratch/spec-gaps/map.md.

## Batch 1 (asked 2026-10-20; all answered 2026-10-31)

1. ~~C1, ranking.~~ Group by level only (ADR 0003).
2. ~~C2, scope additions.~~ Clean result, Outside references and Copy all all join the scope.
3. ~~C4, Counter-offers.~~ The truth rule and the hedge-word ban both apply to the wording; it may only restate or tighten terms in the document.
4. ~~Q20, model.~~ Sonnet 5.5.

## Open (2026-10-31)

1. ~~OCR engine.~~ Chosen 2026-10-31 on your instruction: ppu-paddle-ocr (reads ₹). Validation run on public scans in progress.
2. ~~India Market standard table.~~ Answered: statute rows only (MSMED, Contract Act s.27, Registration Act).
3. ~~Statute citations.~~ Answered: fixed approved list.
4. **Statute wording.** Please open India Code for the three approved sections so their exact text can be recorded (.scratch/spec-gaps/issues/30); automated fetches are blocked. No legal point is shown until then.
5. ~~Ticket 01's live check.~~ Done 2026-10-31 with `vercel curl` against the preview.
6. ~~"fine" as a penalty (from ticket 01).~~ Answered: allowed in the money sense, next to an amount. Built in lib/review/wording.js.
7. ~~"May" as a month (from ticket 01).~~ Answered: allowed capitalised next to a day number or year. Built in lib/review/wording.js.
8. ~~What happens when a summary breaks the ban (from ticket 01).~~ Answered: show the summary with the banned words highlighted and a short note.
9. **ADR 0010 "shorter than a sentence" (from ticket 03).** The ADR says a quote "may be shorter than a sentence but must start and end on sentence boundaries", which reads as contradictory. Ticket 03 accepts one or more whole sentences only (ending at ".", "!" or "?" before a capital, a clause number or a line break; a blank line; or the text's ends), which errs toward withholding. Did you mean a quote can be shorter than a numbered clause, or that it can end at a clause boundary such as ";" or ":" inside a sentence? Ticket 14 needs the answer.
10. **Market standard wording in flag text (from ticket 03).** Any of Redline's flag text that uses words such as "standard", "usual", "typical", "common" or "industry" (outside a word-for-word quote) is shown with the label Redline's judgment, even when the model put it in "what the clause says". Is that the rule you want, or should such a flag be withheld instead?
