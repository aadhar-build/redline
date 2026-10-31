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
4. ~~**Registration Act s.49 (parked, Fable advisor's confidence low).** C2, C4 and L7 were verified from official copies and are in use (.scratch/spec-gaps/issues/30). The central text of s.49 (what happens if a lease isn't registered) was only found on a non-official site. Open India Code once in a browser to confirm it; until then Redline says nothing about s.49. Also worth a glance: MSMED ss.15-16 were read as enacted in 2006.~~ Answered by the product owner, 2026-10-31: the s.49 candidate wording is acceptable; L7b is usable.
5. ~~Ticket 01's live check.~~ Done 2026-10-31 with `vercel curl` against the preview.
6. ~~"fine" as a penalty (from ticket 01).~~ Answered: allowed in the money sense, next to an amount. Built in lib/review/wording.js.
7. ~~"May" as a month (from ticket 01).~~ Answered: allowed capitalised next to a day number or year. Built in lib/review/wording.js.
8. ~~What happens when a summary breaks the ban (from ticket 01).~~ Answered: show the summary with the banned words highlighted and a short note.
9. ~~ADR 0010 span wording (from ticket 03).~~ Answered 2026-10-31: the wording was a drafting error. A quote is one or more whole consecutive sentences; ADR 0010 corrected.
10. ~~Market standard wording in flag text (from ticket 03).~~ Answered by ADR 0009: with no table row behind it, the claim is labelled Redline's judgment, as built.
11. ~~Heading lines in the middle of a sentence (from ticket 14).~~ Answered: settled by Fable advisor, 2026-10-31. A heading line's newline is a boundary only when the heading line itself starts on a boundary and the next line starts with a capital, a digit, "(", "[" or an opening quote. ADR 0010 addendum rule 1 updated; built in lib/review/source-check.js.
12. ~~Incomplete reviews in the library (from ticket 10).~~ Answered: settled by Fable advisor, 2026-10-31. Save only complete reviews (summary shown and Risk flags read; withheld flags never make a review incomplete); otherwise delete the document row in the same request and tell the Reviewer. Withheld reasons are stored as reason codes in reviews.withheld (migration 20261031000200), so a reopened review reads like a fresh one.
13. ~~**Source sentences cut at page joins (from ticket 09, a trust problem).** In the first rea…~~ Settled by Fable advisor, 2026-10-31: PDF pages join with a single newline (ticket 21 item 6, ticket 22 A).
    - (a) Extraction joins pages with a single line break. A footer then causes a withhold, not a fragment.
    - (b) A blank line ends a span only when the text before it ends a sentence or is a heading line. This also covers pasted text with blank lines.
    - (c) Extraction removes repeated page headers and footers before joining. This is riskier: it changes the stored text.
14. ~~**Correct quotes withheld because the clause number was left off (from ticket 09).** All 3…~~ Settled by Fable advisor, 2026-10-31: a quote may omit the opening clause number or bullet; the stored text with the number is shown (ticket 22 B).
    - (a) Review's prompt tells the model to start each quote at the clause number or heading that opens its line.
    - (b) The check treats a numbering token or bullet at the start of a clause as a boundary.
    - (c) Both.
    - (d) Leave as is.
15. ~~**Which party is the Owner (from ticket 09, not blocking).** Review's prompt does not say…~~ Settled by Fable advisor, 2026-10-31: the model names the Owner party and the review shows it with a Change control (ticket 22 E).
16. ~~**A reworded Default Red line (from ticket 12).** When the Reviewer edits a Default Red line's wording, does its ADR 0004 basis still apply? Built for now, as the choice that claims least: the edited line keeps its stable id and its "Default Red line N" label, but goes to the model in the Reviewer's words only, without the default's "catches" text or its basis, and the Red lines page says the basis covered the original wording only. Rewording it back to the original name restores both. Alternative: keep showing the basis, marked "for the original wording".~~ Settled by Fable advisor, 2026-10-31: keep what was built (the Reviewer's words only, no catches or basis; the page says the basis applies to the original wording, and it returns if the original is restored). A trailing space or full stop is not a rewording.
17. ~~**Limits on the Red line list (from ticket 12).** Built with a cap of 300 characters per Red line (the database allows 500) and 30 Red lines per account, to keep the review prompt bounded. Say if you want other numbers, or none.~~ Settled by Fable advisor, 2026-10-31: the limits stand. The database now holds 300 characters too (migration 20261031001210); 30 per account stays in code only, and a longer list written directly still loads and is reviewed.

## Parked for you (2026-10-31)

18. ~~**OCR text is still shown unmarked; do you want to keep that?** (Parked by the Fable advisor: it reverses your own explicit choice, so it's yours.) The OCR validation on 5 public scans measured: ₹ read correctly 0 of 5 (as "Z" or "2", so "₹. 17,19,26,000/-" became "2. 17,19,26,000/-"); a zero read as "o" inside an amount; section numbers 38 of 44 right ("(iii)" became "(ii )", "ARTICLE 9." lost its 9); a heading dropped with no warning; the engine's confidence scores didn't flag the garbage; 1.5% character error rate after deskew, tuned on the same 8 pages it was scored on. Already decided either way: flags citing a sentence with an unreadable amount are withheld and counted. Your choice: keep OCR text unmarked as decided, or add the cheapest safeguard, a note on any document that was partly read from a scan.~~ Answered by the product owner, 2026-10-31: mark it. A document partly or wholly read by OCR shows a note with the page count (ticket 23).
19. ~~Removed PDF headers per upload (from ticket 21).~~ Answered: settled by Fable advisor, 2026-10-31. Show them at upload in one line (up to five distinct strings, then "and N more", plus the total line count); never store or send them. Built in PasteForm (feature/21b-running-lines).
20. ~~Page numbers outside the 10% band (from ticket 21).~~ Answered: settled by Fable advisor, 2026-10-31. Keep the band at 10% and rules (a) and (b); add rule (c): a page-number line at any height is removed when the same shape sits within 0.02 of the page height on at least 3 pages and half the pages and one of its numbers counts up with the page. Built in lib/extraction/pdf-text.js.

## Open (from ticket 22, 2026-10-31)

21. ~~**Clauses withheld after a lead-in ending ":" or ";" (from ticket 22's real re-run).** Thi…~~ Settled by Fable advisor, 2026-10-31: see .scratch/redline-v1/issues/24-lead-ins-form-detection-and-review-history.md.
    - clause 1 after "NOW IT IS HEREBY AGREED AS FOLLOWS:" (T02, T03, T07);
    - a clause under an inline heading ("7. COMPENSATION: A. GRANT APPLICATION GDS shall…", "3. LICENCE PERIOD; EFFECTIVE DATE 3.1 Licence period…");
    - provisos after "…as provided in the Act: Provided that…".

    Options:
    - (a) Leave it. Those flags stay withheld.
    - (b) Treat ":" followed by a line break and a clause number as a boundary.
    - (c) Have the prompt ask the model to quote from the lead-in when a sentence follows one.
22. ~~**A form that the text says was executed (from ticket 22).** Template detection fires on a…~~ Settled by Fable advisor, 2026-10-31: see .scratch/redline-v1/issues/24-lead-ins-form-detection-and-review-history.md.
    - (a) Keep it as built.
    - (b) Drop the "never say signed/executed" line when the text itself says "executed" or "signed" with a date, and keep the template note.
    - (c) Word the fixed line as "This document contains blanks" without "unsigned".
    - Also: T01 matches on its table-of-contents dot leaders alone. Should dot leaders count?
23. ~~**Change when signed in, and what a reopened review keeps (from ticket 22).**…~~ Settled by Fable advisor, 2026-10-31: see .scratch/redline-v1/issues/24-lead-ins-form-detection-and-review-history.md.
    - Signed in, each Change saves the document again as a new library entry. Should Change instead replace the review on the same document?
    - The Owner chosen and the count of dropped judgments are not stored, so a reopened review shows neither. Store them, which needs a migration, or leave them out?
    - Should the dropped-judgment count be shown to the Reviewer at all?

## Open (from tickets 08 and 17, 2026-10-31)

24. ~~**When a Counter-offer changes a number, which direction counts as "tightening"?** The own…~~ Settled by Fable advisor, 2026-10-31, as built (see lib/review/counter-offer.js header).
    - (a) Keep it as built: highlight and don't withhold.
    - (b) Withhold a Counter-offer with a number the contract lacks, as is done for "says".
    - (c) Have the model state the direction for each changed figure and show that as Redline's judgment.
    Also known: only numbers written in digits are checked, so "thirty days" written in words is never highlighted.
25. ~~**A flag that comes back without a Counter-offer.** As built, the flag still shows, becaus…~~ Settled by Fable advisor, 2026-10-31, as built (see lib/review/counter-offer.js header).
26. ~~**A Counter-offer that copies a document sentence containing "may".** As built, the hedge-…~~ Settled by Fable advisor, 2026-10-31, as built (see lib/review/counter-offer.js header).

## Open (from ticket 13, 2026-10-31)

27. **A statute "as amended from time to time" (from ticket 13's run over the sample PDFs).** Redline's patterns treat every "as amended from time to time" as an Outside reference matching Default Red line 3, so it is Don't sign as written and never stops blocking a Clean result (spec-gaps 12). In T01 (3 of 5 hits) and T05 (1 of 2) the phrase follows an Act ("the Public Premises (Eviction of Unauthorised Occupants) Act 1971, as amended from time to time"). Parliament amends those, not the Counterparty. Built as decided: they are flagged. Options:
    - (a) Keep it.
    - (b) Exclude the phrase when it follows an Act, Rules or Regulations, so it is neither an Outside reference nor a Red line 3 match.
    - (c) Keep them as Outside references at Negotiate, but not as a Red line 3 match.
28. **Other wordings of "as amended" (from ticket 13).** Only the exact phrase "as amended from time to time" is matched. Should "as updated from time to time", "as revised from time to time", "as amended or replaced from time to time" and similar also count, with the same Red line 3 match?
29. **A reworded or removed Red line 3 (from ticket 13).** An "as amended" reference is a Red line 3 match only when Red line 3 (id default-one-sided-changes) is on the list the review used. Removed, the reference is Negotiate. Reworded by the Reviewer, it keeps its id, so it still matches, even if the new wording no longer covers terms changed later. Is that right?
30. **One Outside reference per sentence, every sentence (from ticket 13).** A master agreement names "Statement of Work" in many sentences, and each one becomes its own reference to mark reviewed. Keep it, or raise one reference per referenced document?
31. **The same sentence flagged twice (from ticket 13).** In vendor-agreement-03 the model's Red line 3 flag and Redline's Outside reference both cite the "as amended from time to time" sentence, so it shows twice: once in Don't sign as written, once under Outside references. Merge them, or keep both?
