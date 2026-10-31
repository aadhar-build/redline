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

## Settled (from ticket 13, 2026-10-31)

27. ~~**A statute "as amended from time to time" (from ticket 13's run over the sample PDFs).**~~ Settled by Fable advisor, 2026-10-31: option (b), built fail-closed after the security review as option (c): a statute or its rules with a year, then "as amended", in any wording, stays an Outside reference at Negotiate without the Red line 3 match. No year, a possessive or a party term in the name keeps the match (ADR 0007 addendum).
28. ~~**Other wordings of "as amended" (from ticket 13).**~~ Settled by Fable advisor, 2026-10-31: yes, as a bounded list of wordings (the verb synonyms, "as in force/effect", "as published by X", and "then-current"/"current version" beside a named document, terms or policy), quoted in the copy (lib/review/outside-references.js).
29. ~~**A reworded or removed Red line 3 (from ticket 13).**~~ Settled by Fable advisor, 2026-10-31: no. Red line 3 matches only in its original wording (with its catches); reworded or removed, the reference is Negotiate and marking resolves it. The Red lines page says so.
30. ~~**One Outside reference per sentence, every sentence (from ticket 13).**~~ Settled by Fable advisor, 2026-10-31: one reference per referenced document, with all its sentences and one mark (ADR 0007 addendum, migration 20261031003100).
31. ~~**The same sentence flagged twice (from ticket 13).**~~ Settled by Fable advisor, 2026-10-31: merge. A model flag on the same Red line citing only the reference's sentences is dropped (not withheld, not stored) and counted in mergedCount.

## Open (from ticket 24 part 1, 2026-10-31)

32. ~~**"NOW IT IS AGREED THAT:" against ruling 21 A.**~~ Settled by Fable advisor, 2026-10-31: AGREED THAT and AGREE THAT join the formula openers, and a heading line ending ":" or ";" may not hold a lead-in word (that, agree(s), agreed, undertake(s), covenant(s), hereby). Built; two of its cases were settled in 35.
33. ~~**The operative-word guard also catches plain all-caps headings (from ticket 24 part 1).**~~ Settled by Fable advisor, 2026-10-31: (a) keep the guard on every heading line; a real heading with NO or NOT cannot start a quote, and that sentence is withheld and counted.
34. ~~**"as follows:-" is not a formula opener (from ticket 24 part 1).**~~ Settled by Fable advisor, 2026-10-31: (a) a lead-in colon may be ":" plus one dash (":-", ":–", ":—"), at start and end alike. Built.
35. ~~**Two QUESTIONS 32 cases that conflict with built rules (from ticket 24 part 2).**~~ Settled by Fable advisor, 2026-10-31: (1) option (a), a lead-in word also disqualifies an all-caps word in rule D, so "LESSEE AGREES TO:\n(a) Pay…" is withheld; (2) as ADR 0010 says, "The Licensor…" is shown without the "1.". Built.

## Settled (from ticket 18, 2026-10-31)

Each is built the way that claims least; numbers may need renumbering when 13b lands.

36. ~~**Outside references inside an added document.**~~ Settled by Fable advisor, 2026-10-31: yes. A reference inside an added document joins the Outside references, numbered after the contract's and titled with the document it sits in, with the same severity rules, mark, add and Remove. Every reference must be resolved for a Clean result. The separate "References in the documents you added" section is gone (ADR 0007 addendum, migration 20261031003800).
37. ~~**Changing or removing an added document.**~~ Settled by Fable advisor, 2026-10-31: Remove on the latest review, fail closed (review again with the rest; delete only if that saves). Replace is Remove, then Add. Earlier reviews reopen with "referenced-document-removed" (migration 20261031003700; ADR 0007 addendum).
38. ~~**Marks after adding a document.**~~ Settled by Fable advisor, 2026-10-31: yes. Marks carry over by key on Add, Remove and re-run (Change), with their original time; a mark whose reference is gone is dropped, and a carried mark never resolves a Red line 3 match.
39. ~~**"As amended" and an added document.**~~ Settled by Fable advisor, 2026-10-31: keep as built. The reference's line now says both that the document was reviewed and that it still blocks under Red line 3.
40. ~~**Length cap.**~~ Settled by Fable advisor, 2026-10-31: yes, one combined cap of 200,000 characters, checked on the server before anything is stored and in the browser before posting, with how many characters are left.
41. ~~**Questions about an added document.**~~ Settled by Fable advisor, 2026-10-31: yes. The question box answers from the contract and the added documents of the review shown; each source names its text and is checked against it alone, or the whole answer is withheld.
42. ~~**A schedule named in the added document but present in the contract.**~~ Settled by Fable advisor, 2026-10-31: the contract's headings count for schedules named in an added document, never the reverse, and added documents don't count for each other.

## Open (from ticket 18b, 2026-10-31)

43. **An added document's own title line.** An added Order Form whose first line is "ORDER FORM" (or a Statement of Work titled "STATEMENT OF WORK") is read as a reference to an Order Form inside that document, so it blocks a Clean result until the Reviewer marks it. Schedules are exempt because their heading counts as present. Built the way that claims least: it stays a reference. Should a heading line in an added document that names the document's own kind count as present?

## Open (from ticket 14c, 2026-10-31)

44. **General law "for the time being in force".** Ticket 14c added "for the time being in force" to the "as amended" wordings, with the QUESTIONS 27 statute rule unchanged. On a replay of the stored T05 reply, T05's Red line 3 Outside references (Don't sign as written) went from 1 to 4. All three new ones are general-law wordings ("any law for the time being in force", "any other law for the time being in force", "applicable laws ... for the time being in force", one split across a line break). T03's "Revenue Recovery Act for the time being in force" has no year, so it is also a Red line 3 match, not Negotiate. Built as specified, which flags more, not less. Should "law" or "laws" just before the phrase, or an Act named without a year, be exempt the way a dated statute is?
