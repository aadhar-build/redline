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
4. **Registration Act s.49 (parked, Fable advisor's confidence low).** C2, C4 and L7 were verified from official copies and are in use (.scratch/spec-gaps/issues/30). The central text of s.49 (what happens if a lease isn't registered) was only found on a non-official site. Open India Code once in a browser to confirm it; until then Redline says nothing about s.49. Also worth a glance: MSMED ss.15-16 were read as enacted in 2006.
5. ~~Ticket 01's live check.~~ Done 2026-10-31 with `vercel curl` against the preview.
6. ~~"fine" as a penalty (from ticket 01).~~ Answered: allowed in the money sense, next to an amount. Built in lib/review/wording.js.
7. ~~"May" as a month (from ticket 01).~~ Answered: allowed capitalised next to a day number or year. Built in lib/review/wording.js.
8. ~~What happens when a summary breaks the ban (from ticket 01).~~ Answered: show the summary with the banned words highlighted and a short note.
9. ~~ADR 0010 span wording (from ticket 03).~~ Answered 2026-10-31: the wording was a drafting error. A quote is one or more whole consecutive sentences; ADR 0010 corrected.
10. ~~Market standard wording in flag text (from ticket 03).~~ Answered by ADR 0009: with no table row behind it, the claim is labelled Redline's judgment, as built.
