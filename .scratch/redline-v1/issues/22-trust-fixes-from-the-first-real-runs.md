# 22: Trust fixes from the first real runs

**What to build:** rulings B–E below, settled by a Fable advisor on 2026-10-31 after ticket 09's first real runs (6 public contracts, Sonnet 5.5). Ruling A (PDF page joins) is built with ticket 21 because it lives in extraction.

**Blocked by:** 09 (Real model adapter and first end-to-end run on a real contract)

**Status:** merged into `development` (2026-10-31)

**A. PDF pages join with a single "\n"** (high). Trim trailing newlines from each page before joining. Blank lines in pasted text and DOCX stay boundaries. Built in ticket 21.

**B. A quote may omit the numbering token that opens its sentence** (high on approach, medium on the token set). Accept a quote whose match starts at S when there is a boundary B < S such that stored[B,S) is only whitespace plus 1–3 tokens, each followed by whitespace, total at most 24 characters, and the character at S is a capital, digit, "(", "[", opening quote or currency sign ($, ₹, "Rs"). Tokens: the existing NUMBERING forms; capital forms "A." "A)" "(A)" "IV." "(IV)"; bullets U+2022 U+25E6 U+25AA U+25CF U+2043 U+2219, "*", "-", "–", "—"; a bare integer only at the start of a line. Not tokens: inline headings ending ":" and words such as "Clause". The shown span is stored[B,end], so the Reviewer sees "17.2 The Licensee shall…". The prompt also tells the model to begin each quote at the clause number or bullet that opens the line. Tests: "17.2 ", "• $1,500.00", "(a) " shapes; negatives "12 months are…", "17.2 percent…", a quote starting mid-sentence after a word.

**C. No unsupported claims** (prompt rules high, code checks medium).
- Prompt: a document with blanks, placeholders or unfilled signature blocks is described as an unsigned template or form ("provides for", never "is signed/executed/dated"); no facts from outside the document (geography, law, rates, dates, parties); where the text is silent, say so; compare only like with like.
- Code (a): template detection (runs of 3+ underscores or dots, "[●]", "[__]", "[Name…]"-style brackets). When found, Review adds one fixed line to the prompt ("This document contains blanks and is an unsigned form") and the UI shows a template note.
- Code (b): every number in a flag's "says" (digits after stripping commas, currency, "%") must occur in the document text, or the flag is withheld with reason "unsupported-number" (add it to the stored withheld reason codes with a migration). In the summary and in "judgment", such numbers are marked like banned words.

**D. No "typical/usual" claims in v1** (medium). The judgment may say what the clause does to the Owner and what is absent, never what is market, standard, customary, usual, typical or common. When a judgment matches wording.js's market-standard list, drop the judgment (the flag still shows with its says and Source sentences) and count the drop. Severity stays as the model gives it, labelled Redline's judgment. Revisit when approved table rows are passed to the prompt (ADR 0009).

**E. Owner party** (high on the end state, medium on the interim). The model returns "ownerParty" (defined term and role, e.g. "the Allottee") and "parties". The review shows "Reviewed for: the Allottee" above the flags with a "Change" control that re-runs with the Owner fixed in the prompt ("The Owner is X"). The later pre-analysis screen (ADR 0009 contract type) will confirm both before analysis.

- [x] Each ruling has tests through the Review seam (and extraction seam for A).
- [x] Re-run the ticket 09 real contracts through the CLI adapter: no fragment is shown, and the run table is recorded again for comparison.
- [x] New copy through the humanizer.

## Comments

- 2026-10-31, what was built (feature/22-trust-fixes):
  - **B** (lib/review/source-check.js): a quote whose match does not start on a boundary is accepted when 1–3 numbering tokens (at most 24 characters) sit between it and a boundary and the quote opens with a capital, digit, "(", "[", an opening quote or a currency sign. The tokens are the NUMBERING forms, the capital forms and the bullets the ruling lists; a bare integer counts only at the start of a line. The shown span starts at the number. Tests cover the ruling's shapes and negatives, plus "C. GRANT COMMISSION: If…", which stays withheld. Under ADR 0010, "4. The…" and "B. If…" were already boundaries, so those quotes were accepted before this change, without their number. The prompt now asks the model to begin each quote at the clause number or bullet.
  - **C** (review.js, wording.js): new prompt rules. There is no outside fact; a form "provides for" and is never "signed, executed or dated"; where the document is silent, say so; compare like with like; write numbers as the document writes them; and never claim what is market, standard, usual, typical, common or one-sided.
    - `looksLikeTemplate` detects runs of 3+ underscores or dots, "…" runs, "[●]"/"[•]", "[__]" and named placeholders. When it fires, the prompt gets the fixed line and the review returns `template: true`; the summary pane then shows a note.
    - Numbers are compared by their digits, with commas removed. A plain amount matches with or without decimals; a clause reference such as "16.2.5" must match exactly. A number in "says" that the document lacks withholds the flag as `unsupported-number`. In the summary and the judgment, such numbers are marked with their own note.
    - Migration 20261031002200 adds `unsupported-number` to the stored withheld reason codes. The isolation tests cover that it inserts, and that a variant code or an extra key is refused.
  - **D**: a judgment that matches wording.js's market-standard list is dropped. The flag still shows, and `judgmentsDropped` counts the drops. The flags pane says Severity is Redline's judgment.
  - **E**: the model returns `ownerParty` and `parties`, kept only when the document uses the term. `review()` takes a fixed `ownerParty`, which must be a term in the document; anything else is refused with `bad-owner-party` before the model is called. The flags pane shows "Reviewed for: X" with Change. Change posts the same text with `ownerParty` through the same guarded route. /api/review only passes `ownerParty` through.
  - A reopened saved review runs the same number check, number marks, judgment drop and template detection.
  - Also fixed: a reply wrapped whole in one ```json code fence is now read. Sonnet 5.5 sent one in a T05 run (1 of 20 runs), and the whole review was lost.
  - Tests: unit 459, isolation 69, e2e 48 (tests/e2e/trust-fixes.spec.mjs, on a scripted licence-form fixture). build, check:client-bundle and test:bundle-check-plant all pass.
  - The vendor fixture's two scripted judgments ("usually", "not standard") are now dropped, so its e2e test expects that. The label test moved to the new fixture.
- 2026-10-31, real re-run. Sonnet 5.5 through the CLI adapter, `DEFAULT_RED_LINES` as the signed-out route uses (ticket 09 used none), on text re-extracted by the merged lib/extraction (ticket 21: single "\n" page joins, headers removed, and rule (c) page numbers, which changed only T05). Each document ran twice. Outputs are in gitignored tmp/real-runs/.

  | Doc | Before (ticket 09): shown / withheld | Code-only replay of ticket 09 replies on new text | After, run 1: shown / withheld | After, run 2: shown / withheld | Fragments shown (before → after) |
  |---|---|---|---|---|---|
  | T01 leave and licence, NDMC | 9 / 12 | 6 / 15 (2 unsupported-number) | 9 / 6 | 4 / 9 | 1 → 0 |
  | T02 leave and licence template | 5 / 3 | 8 / 0 | 5 / 1 | 6 / 0 | 0 → 0 |
  | T03 tender agreement | 3 / 2 | 3 / 2 | 2 / 1 | 3 / 1 | 0 → 0 |
  | T05 RERA agreement for sale | 8 / 9 | 12 / 5 | 8 / 1 | 7 / 5 | 2 → 0 |
  | T06 professional services | 9 / 4 | 10 / 3 | 6 / 2 | 6 / 2 | 0 → 0 |
  | T07 office lease | 8 / 0 | 8 / 0 | 5 / 2 | 6 / 0 | 0 → 0 |

  - **Fragments:** no shown Source sentence ends mid-sentence in any of the 12 final runs, or in 4 earlier T05 runs on the pre-rule-(c) text.
  - **Withheld:** 30 of 72 flags before (42%, one run per document); 30 of 97 after (31%, two runs per document). T01 and T05 carry most of it.
    - The largest remaining cause is ADR 0010's lead-in rule: a clause or proviso that follows a line ending ":" or ";". That includes operative clause 1 after "AS FOLLOWS:" (T02, T03, T07) and clauses under an inline heading with ":" or ";" ("7. COMPENSATION: A.", "3. LICENCE PERIOD; EFFECTIVE DATE"). See QUESTIONS.md 21.
    - 5 quotes were real alterations by the model (T01 run 2: 4; T05 run 2: 1), correctly withheld.
    - The rest: a bullet item with no full stop (T06); a signature block ending "INC.", an abbreviation (T06); a quote ending at a dash; an address block before the sentence (T05).
  - **unsupported-number:** 0 in the live runs. In the replay of ticket 09's replies there were 2, both in T01 and both correct: "Rs. 53.36 crore" restated from "Rs. 53,36,47,818", and "about Rs. 35.6 crore", a calculation. No number written in words versus digits was withheld.
  - **Judgments dropped:** 1 in 12 live runs (T07). Replaying ticket 09's replies on the old text drops 8, so the new prompt line stops nearly all "typical" claims at the source.
  - **Template:** detected in all six. Each has blanks or unfilled signature or date lines. T01 would also match on its table-of-contents dot leaders alone.
  - **Owner:** named in all 12 runs: the Licencee (T01), licensee / the licensee (T02, as the document writes it), the bounden (T03), Allottee / the Allottee (T05), GDS (T06), LESSEE (T07).
  - **Claims the document doesn't support** (read against the text: T02, T03, T05, T06 and T07 in full; T01 in a targeted read):
    - Gone: ticket 09's T02 "signed by both parties and two witnesses". T02 now says the signature blocks are blank.
    - Gone: ticket 09's T07 Valdosta claim.
    - Gone: ticket 09's T06 rate-versus-cap comparison. It now compares the $500 hard-cost limit with the $2,000 hard-cost amount.
    - New, caused by C(a): T06 run 1's summary ends "The date line and signature blocks are blank, so the form is unsigned." The preamble says "made and executed this 17th day of April 2024". Run 2 says only that it is a form with a blank execution-date line. See QUESTIONS.md 22.
    - T06 also flags a real defect that is supported: the invoice clause cites Section 5, but the fees are in Section 7.
  - **Before the final text:** T05's footers ("Page n of 37", outside the 10% band) caused 3 withholds across 3 runs, where the model quoted across them. After rule (c), there are none.
