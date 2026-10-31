# Final real run, 2026-10-31

Counts and short notes only. No contract text is quoted here. Raw outputs, scripts and screenshots are kept outside the repo, in ~/redline-tools/final-run.

**Setup:** branch `development` at 9707cd1. Sonnet 5.5 (`claude-sonnet-5-5`) through the Claude Code CLI adapter on this machine. Each document got one run with `DEFAULT_RED_LINES`.
- Text contracts went through Review from a Node script, the same way as ticket 24. The text came from the real PDFs, read by the merged `lib/extraction` `readPdf`, and is byte-identical to ticket 24's text for all six.
- Scans, ticket 18 in the browser, the question box, the library, Copy all and the Owner change ran in Chromium (Playwright) against `npm run dev:local` (`REDLINE_MODEL_ADAPTER=cli`, 127.0.0.1:3000) and the local Supabase, signed in with a throwaway account.

## 1. The six text contracts

"Shown" counts Risk flags. Outside references are listed separately.

| Doc | Shown (DSAW / Neg / Know) | Withheld (reasons) | Ambiguous | Outside refs (groups) | Merged | Clean | Counter-offers / marked words | Judgments dropped | Blanks note | Owner named |
|---|---|---|---|---|---|---|---|---|---|---|
| T01 | 6 (2/3/1) | 6 (5 source-not-found, 1 reference-not-citable) | 0 | 6 (1 "as in force", Don't sign as written; 5 Negotiate: 3 statute or sentence groups, 1 annexure, 1 schedule) | 0 | no | 6/6, 0 marked | 0 | yes | yes |
| T02 | 6 (1/3/2) | 0 | 0 | 0 | 0 | no | 6/6, 0 marked | 1 | yes | yes |
| T03 | 2 (1/1/0) | 2 (source-not-found) | 0 | 0 | 0 | no | 2/2, 0 marked | 0 | yes | yes |
| T05 | 7 (2/4/1) | 2 (source-not-found) | 1 | 3 (1 "as amended", Don't sign as written; 2 schedules, Negotiate) | 0 | no | 7/7, 0 marked | 0 | yes | yes |
| T06 | 8 (1/3/4) | 2 (source-not-found) | 2 | 0 | 0 | no | 8/8, 0 marked | 0 | no | yes |
| T07 | 10 (0/4/6) | 1 (source-not-found) | 1 | 0 | 0 | no | 10/10, 0 marked | 0 | yes | yes |
| **Total** | **39** | **13** | 4 | 9 | 0 | none | 39/39, 0 marked | 1 | 5 of 6 | 6 of 6 |

- **Withheld rate:** 13 of 52 (25%). Leaving out the one Outside reference that couldn't be cited, it's 12 of 51 (24%). Ticket 22 was 31% and ticket 24 part 1 was 25%, so the rate is flat against part 1. Of the 13 withheld quotes, 12 are in the text but fail a boundary rule (list items, lead-ins, quotes that stop mid-sentence) and 1 was altered by the model.
- **Summaries:** all 6 shown, with no marked words or numbers.
- **T07 variance:** the browser run of T07 (section 6) gave 5 shown and 2 withheld, against 10 and 1 here. That is model variance between runs.

## 2. Trust spot-check by hand

- **Source sentences:** for each document, at least 5 shown flags were read against the stored text. That was every flag on T02, T03, T06 and T07, 6 on T01 and 7 on T05. For every shown flag (39 of 39), each Source sentence equals the stored text at its recorded offsets, and that text came straight from the real file. None was a fragment.
- **Summaries:** I read all six and checked them against the flags and the text. One claim on T05, that the possession date isn't stated, was checked against the clause and holds. I found no unsupported claim.
- **Counter-offers (PRD criterion 17):** I read all 39. The terms below don't appear in the document, so the run doesn't meet criterion 17 ("none found"):
  - **T02, 4:** a deposit-return duty, a written-notice step before handover, a fixed fee for the period, and consent "not unreasonably withheld".
  - **T01, 2:** a 30-day cure notice, and damages limited to "loss shown by written evidence".
  - **T05, 2:**
    - One sets the registration charges "in the amount stated in this Agreement", but no amount is stated, which the flag's own judgment says.
    - One allows other rates only with written agreement.
  - **T06, 3:** milestone pay on termination for cause, and two carve-outs for the funding body.
  - **T07, 1:** "no fee is payable on non-renewal".
  - **T03, 0:** both of T03's Counter-offers only tighten its terms.
  - **Not counted:** caps tied to an amount the document already states, such as the deposit, the total fee or the Liquidated Damages. I read those as tightening.
- **Hedge words:** no Counter-offer had a marked word or number.

## 3. Scans (browser OCR, then Review)

| Scan | Pages OCR'd | OCR time | Scanned note | Shown | Withheld (reasons) | Ambiguous | Outside refs | Counter-offers |
|---|---|---|---|---|---|---|---|---|
| S01 (image-only MoU) | 3 of 3 | 26 s | shown | 5 | 2 (source-not-found) | 1 | 0 | 5/5 |
| S04 (scan with a prior OCR layer) | 12 of 12 | 85 s | shown | 3 | 10 (9 source-not-found, 1 unreadable-amount) | 0 | 1 | 3/3 |

- **S04's own OCR layer was ignored.** All 12 pages were read by Redline's OCR, as ADR 0008 requires.
- **The unreadable-amount rule works on a real scan.** It found 3 unreadable-amount spots in S04's OCR text (0 in S01), and withheld 1 flag that cited one.
- **S04's withheld rate is 77% (10 of 13).** Most of it is source-not-found on OCR text. Boundary rules on OCR'd line breaks look like the cause, but this was not separated per quote.
- **One S04 Outside reference is a false positive.** It is the e-stamp provider's web address printed on the stamp paper, raised as a Negotiate reference.

## 4. Ticket 18: Outside reference plus its referenced document

The run used outside-references-01 with outside-references-01.schedule-b.txt.
- **Review seam (Node, CLI):** the model's raw reply gave 2 flags with `"document": "R1"`, one of them the Schedule B suspend clause, plus 1 `"main"` flag. Both R1 flags were shown and checked against Schedule B's own text, with 0 withheld. The Schedule B reference shows as resolved. The other 3 Outside references stay open, so there is no Clean result, as expected.
- **Browser (signed in):**
  - First review: 3 flags and 4 Outside references.
  - Adding Schedule B by pasting its text against the Schedule B reference re-reviewed the two together: 4 flags, 2 of them "from the referenced document" (the suspend clause among them), 0 withheld, and 1 reference marked added.
  - No Clean result, because the other 3 references are unresolved.

## 5. Question box (T07, signed in)

- **A question the document answers** (the initial term): 1 answer with 1 cited source. The source matches the stored text at its offsets.
- **A question it doesn't answer** (an insurance type the lease never mentions): the "not in the document" message, with no answer and no sources.

## 6. Library, Copy all, Owner change, review history (T07 PDF uploaded, signed in)

- **Upload and save:** the PDF was read in the browser and reviewed (5 shown, 2 withheld, 1 judgment dropped). The review was saved, and the library shows 1 item.
- **Reopen:** opening it from the library showed the 5 Source sentences.
- **Copy all:** it put 9,720 characters on the clipboard.
  - Every Source sentence of every shown flag and Outside reference appears in it word for word.
  - It includes nothing about the withheld flags.
- **Owner change:**
  - On the reopened review, Change offered a typed field because parties aren't stored. I typed the other named party, and the review re-ran and showed it.
  - The library still has 1 item.
  - The document now has 2 history rows. The latest reopens with the new Owner.
  - The earlier one opens with the earlier-review tag and the original Owner.

## Verdicts

| Feature | Verdict |
|---|---|
| Extraction, text-layer PDF | works on real documents |
| Extraction, scans through OCR | works with caveats: S01 and S04 only (3 scans not run); S04's OCR text leads to 77% withheld |
| Plain-English summary | works on real documents |
| Risk flags with checked Source sentences | works with caveats: 25% withheld on text PDFs, mostly boundary rules |
| Ambiguous clauses | works on real documents (4 across six docs, 1 on S01) |
| Counter-offers (one per flag, hedge rule) | works with caveats: 12 of 39 add terms the document doesn't contain (criterion 17) |
| Outside references and groups | works with caveats: e-stamp web address raised on S04; on T03, "Act for the time being in force" was not raised |
| Ticket 18 referenced document | works on real documents (fixture contract; R1 flags shown) |
| Question box | works on real documents |
| Red lines drive the analysis (defaults) | works on real documents (Red line matches on T01, T02, T03, T05, T06) |
| Saved library and reopen | works on real documents |
| Copy all | works on real documents |
| Owner change and review history | works on real documents |
| Clean result | not reached: no real document came out clean (every one had flags), so not exercised here |
| Unreadable-amount withhold | works on real documents (1 on S04) |
| Judgments dropped | works on real documents (1 on T02, 1 on the T07 browser run) |
| Blanks note | works on real documents (5 of 6, not T06, matching ticket 24) |

## Bugs and findings

1. **Counter-offers add terms the document lacks (criterion 17).**
   - Reproduce: run T02 through Review with the default Red lines and read the Counter-offers on the deposit, handover and consent flags.
   - Seen: they add obligations that are nowhere in the document.
   - Also: T05's registration-charges Counter-offer points to "the amount stated in this Agreement" when no amount is stated.
2. **The e-stamp web address is raised as an Outside reference.**
   - Reproduce: upload ~/redline-samples/scans/S04 while signed in, wait for OCR, then press Review.
   - Seen: one Negotiate Outside reference whose group is the stamp-paper provider's web address.
3. **"…Act for the time being in force" is not raised as an Outside reference** (a question, not certain to be a bug).
   - Reproduce: run T03 through Review.
   - Seen: the recovery-clause Source sentence carries that phrase, and 0 Outside references come back.
   - "as in force from time to time" is raised on T01, so this may be a gap in the pattern list.
4. **`npm run dev:local` rewrites the tracked CLAUDE.md.**
   - Reproduce: start `npm run dev:local` on a clean tree, then run `git status`.
   - Seen: `M CLAUDE.md`. Next 16 logged "Generated CLAUDE.md for AI agents", and 10 lines were added. The fix is `agentRules: false` in next.config.mjs.
   - The change was not committed in this run. Remove it before the next commit.
5. **Withheld rate on OCR text is high** (S04: 10 of 13). Reproduce as in item 2. Not yet split into boundary failures and altered quotes.
