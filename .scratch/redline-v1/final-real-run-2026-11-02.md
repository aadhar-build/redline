# Final real run 2, 2026-11-02

Counts and short notes only. No contract text is quoted here. Raw outputs, scripts and screenshots are kept outside the repo, in ~/redline-tools/final-run-2.

**Setup:** `development` at 868c645. Sonnet 5.5 through the Claude Code CLI adapter, `npm run dev:local`, local Supabase, one throwaway signed-in account, default Red lines. Unlike the last run, every document went through signed-in Chromium, and each document had one run. "Shown" counts Risk flags; Outside references are listed separately.

## 1. Text contracts

| Doc | Shown (DSAW / Neg / Know) | Withheld (reasons) | Ambiguous | Outside refs (DSAW / Neg) | Clean | Counter-offers (marked) | Adds a term |
|---|---|---|---|---|---|---|---|
| T01 | 6 (2/2/2) | 5 (4 source-not-found, 1 reference-not-citable) | 0 | 6 (1/5) | no | 6 (0) | 0 |
| T02 | 5 (0/4/1) | 0 | 2 | 0 | no | 5 (1) | 0 |
| T03 | 2 (1/1/0) | 1 (source-not-found) | 0 | 1 (1/0) | no | 2 (1) | 0 |
| T05 | 7 (2/4/1) | 3 (source-not-found) | 0 | 6 (2/4) | no | 7 (1) | 0 |
| T06 | 8 (1/4/3) | 1 (source-not-found) | 1 | 0 | no | 8 (2) | 2 |
| T07 | 5 (0/2/3) | 1 (source-not-found) | 0 | 0 | no | 5 (0) | 0 |
| **Total** | **33** | **11** | 3 | 13 | none | 33 | **2** |

- **Withheld rate:** 11 of 44 (25%), flat against the last run's 25%. Why each quote failed was not split out in this run.
- **Source sentences:** every one on these documents and on T04, T08, the scans and the converted DOCX equals the stored text at its recorded offsets (read back from the database; 0 mismatches). Stored text equals the posted text on all of them.
- **Counter-offers:** 2 of 33 add a term the document lacks (last run: 3 of 35). This is my reading, by the last run's rule: caps tied to an amount in the document count as tightening.
  - T06, definite and marked: pay for fees due on a termination for cause.
  - T06, borderline and not marked: a new qualifier narrowing what confidentiality and copyright cover.
  - Close but not counted: T01's forfeiture limited to unpaid fee and interest (the words are in the document), and T02's indemnity narrowed to the licensee's own failure (marked).
- **Summaries:** all read, with 0 marked words. I found no unsupported claim on the text contracts. Each states its blanks and silences.

## 2. Scans (browser OCR with the v6 engine, then Review)

| Scan | Pages OCR'd | OCR time | Scanned note | Shown | Withheld (reasons) | Ambiguous | Outside refs | Clean |
|---|---|---|---|---|---|---|---|---|
| S01 | 3 of 3 | 26 s | shown | 3 | 1 (source-not-found) | 0 | 0 | no |
| S03 | 4 of 4 | 28 s | shown | 4 | 1 (source-not-found) | 0 | 0 | no |
| S04 | 12 of 12 | 86 s | shown | 4 | 2 (1 source-not-found, 1 unreadable-amount) | 0 | 0 | no |
| S05 | 1 of 1 | 5 s | shown | 0 | 0 | 0 | 0 | **yes, see bug 1** |
| S02 | refused | 0.23 s | n/a | n/a | n/a | n/a | n/a | n/a |

- **S04's withheld rate fell from 77% to 33%** (2 of 6). Its e-stamp web address is no longer raised as an Outside reference.
- **S02 (304 pages, 65 MB)** was refused 0.23 s after the file was set, with the page-limit message and 0 review requests.
- **Scan Counter-offers:** read, but not part of the adder count. S04 has one that adds the second party to who defines the milestones, and one that replaces a 5-year period with the MoU's end date.
- **S01's summary** calls a 49% equity cap "the only amount of money". A small wording slip.

## 3. DOCX

No real DOCX exists in the samples. **This is a CONVERTED file:** a generated DOCX of T02's extracted text, not a real Word contract. It uploaded and was read in the browser, and its text equals T02's apart from whitespace. Review: 5 shown (1/2/2), 0 withheld, 0 Ambiguous, 0 Outside references, 5 Counter-offers. Real-file DOCX handling remains unproven.

## 4. Added-document follow-ups (FIXTURES: outside-references-01, its schedule-b, and referenced-02 with its nested Schedule B and order details)

| Step | Result |
|---|---|
| Add | 4 references; flags 3 to 4, 2 from the added document, 0 withheld, reference marked added. No second add offered. |
| Marks carried over | the mark and its statement survived the add, the remove and the re-add |
| Question from the added document | answered, source labelled as from the added document, plus one from the contract |
| Question not in either | "not in the document" message |
| Remove | flags back to 3, 0 from the added document, 0 withheld; the same question then gets "not in the document" |
| Re-add and reopen | 6 flags, 3 from the added document; same on reopen; 4 history rows |
| Add inside an added document | outer add raised a third reference labelled as inside the added document; adding to it gave 2 added documents, and all survived reopen |
| Party dropdown on reopen | a select with both parties, no typed field. Changing it re-ran the review, kept the mark and the added document, and held on reopen (5 history rows) |

The 2 against 3 flags from Schedule B between adds is model variance. The Clean step on referenced-02 did not reach Clean, because the model raised Risk flags on the fixture.

## 5. Clean result

- **T04:** not Clean. 0 shown, 3 withheld (source-not-found), and the withheld flags block it as they should. This shows Clean is blocked, but no flag on T04 could be shown.
- **T08:** not Clean. 7 shown (1/3/3), 3 withheld (source-not-found), 1 Ambiguous.
- **S05:** Clean, the only real sample to reach it, but it is a one-page stamp certificate with no contract terms. See bug 1. **No real contract with terms came out Clean.**
- **Fixture clean-agreement-01** (real model): not Clean, 3 flags, including at least one above Know this. No fixture-based Clean was recorded in the browser.

## Verdicts

| Feature | Verdict |
|---|---|
| Extraction, text-layer PDF | works on real documents (8) |
| Extraction, scans through OCR | works on real documents (4) |
| 300-page cap | works on real documents (S02, 0.23 s) |
| DOCX | works on a converted file only; no real DOCX run |
| Plain-English summary | works on real documents |
| Risk flags with checked Source sentences | works with caveats: 0 mismatches, 25% withheld on text PDFs |
| Ambiguous clauses | works on real documents (3 in the six) |
| Counter-offers | works with caveats: 2 of 33 add terms, so criterion 17 is still not fully met |
| Outside references | works with caveats: see finding 2 |
| Added-document follow-ups | works on fixtures only |
| Question box from an added document | works on fixtures only |
| Clean result | not proven on a real contract; **wrongly reachable on a page with no terms (bug 1)** |
| Unreadable-amount withhold | works on real documents (1 on S04) |
| Scanned note | works on real documents (4 of 4) |
| Library save and reopen | works (every review saved; fixtures reopened) |

Copy all was not re-run, and neither was the question box on a real contract.

## Bugs and findings

1. **Bug, high: a document with no contract terms gets a Clean result.**
   - Reproduce: sign in, upload ~/redline-samples/scans/S05, wait for OCR, press Review.
   - Seen: "This contract has a Clean result" and "no clause matched" every Red line, on a one-page stamp certificate. The summary says the terms are missing, and the page says Redline can't tell which party the Reviewer is on.
   - Why it matters: the Reviewer is told a contract was checked when no clauses were there to check, and for no known party. It meets ADR 0006's definition as written, so the fix is a spec decision (for example, no Clean without clauses or an Owner).
2. **Finding, low, flags more: T03's undated Act stays Don't sign as written.**
   - Reproduce: run T03 through Review.
   - Seen: its "for the time being in force" reference matches Red line 3. QUESTIONS 44 says undated Acts lose that match, but this one sits mid-sentence and so fails the strict clause-start gate.
   - This also closes the last run's finding 3: the reference is now raised. T05's 2 and 4 is the state QUESTIONS 46 already describes.
3. **Finding, medium: all flags on T04 withheld.** The Reviewer gets a review with 0 shown and 3 withheld. Reproduce: upload T04 and review. The behaviour is correct, but the document yields no usable flags; the cause was not split out.

Harness notes, not product bugs: the CLI guard allows one model run at a time and returns 429 to parallel requests, so runs were made in series. What the Reviewer sees on a 429 was not checked.

## Follow-up run, ticket 06c (same day)

Counts only. Sonnet 5.5 through the CLI adapter, called directly at the Review seam (not through the browser), one run each, on the text saved from final run 2. Reopen was worked out in the same script.

| Doc | Shown (DSAW / Neg / Know) | Withheld (reasons) | Ambiguous | Outside refs | Has clauses | Clean | Clean on reopen |
|---|---|---|---|---|---|---|---|
| S05 | 0 | 0 | 0 | 0 | no | no | no |
| T03 | 4 (1/3/0) | 1 (source-not-found) | 1 | 1 ("other", Negotiate) | yes | no | no |

Bug 1 is fixed for S05. Finding 2 is fixed for T03's reference, now Negotiate with no Red line 3 match. Clause test on saved text: T01 to T08, S01, S03, S04 and the converted DOCX pass, S05 fails.
