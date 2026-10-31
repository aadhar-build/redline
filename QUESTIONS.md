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
11. ~~Heading lines in the middle of a sentence (from ticket 14).~~ Answered: settled by Fable advisor, 2026-10-31. A heading line's newline is a boundary only when the heading line itself starts on a boundary and the next line starts with a capital, a digit, "(", "[" or an opening quote. ADR 0010 addendum rule 1 updated; built in lib/review/source-check.js.
12. ~~Incomplete reviews in the library (from ticket 10).~~ Answered: settled by Fable advisor, 2026-10-31. Save only complete reviews (summary shown and Risk flags read; withheld flags never make a review incomplete); otherwise delete the document row in the same request and tell the Reviewer. Withheld reasons are stored as reason codes in reviews.withheld (migration 20261031000200), so a reopened review reads like a fresh one.
13. **Removed PDF headers per upload (from ticket 21).** Extraction now records the running headers and page numbers it strips (distinct strings and counts), but only on the extraction result: they are not stored, shown or sent. Should they be stored with the document (a migration and a change to the posted body) or shown at upload?
14. **Page numbers outside the 10% band (from ticket 21).** One real sample (T05) prints its "Page n of m" footer 13.4% up from the bottom, and pdf.js reads it first on each page, so it stays in the text at every page join and any quote crossing a join is withheld. Should a page-number line that repeats on most pages be removed wherever it sits, or the band be widened?
