# 22: Trust fixes from the first real runs

**What to build:** rulings B–E below, settled by a Fable advisor on 2026-10-31 after ticket 09's first real runs (6 public contracts, Sonnet 5.5). Ruling A (PDF page joins) is built with ticket 21 because it lives in extraction.

**Blocked by:** 09 (Real model adapter and first end-to-end run on a real contract)

**Status:** ready-for-agent

**A. PDF pages join with a single "\n"** (high). Trim trailing newlines from each page before joining. Blank lines in pasted text and DOCX stay boundaries. Built in ticket 21.

**B. A quote may omit the numbering token that opens its sentence** (high on approach, medium on the token set). Accept a quote whose match starts at S when there is a boundary B < S such that stored[B,S) is only whitespace plus 1–3 tokens, each followed by whitespace, total at most 24 characters, and the character at S is a capital, digit, "(", "[", opening quote or currency sign ($, ₹, "Rs"). Tokens: the existing NUMBERING forms; capital forms "A." "A)" "(A)" "IV." "(IV)"; bullets U+2022 U+25E6 U+25AA U+25CF U+2043 U+2219, "*", "-", "–", "—"; a bare integer only at the start of a line. Not tokens: inline headings ending ":" and words such as "Clause". The shown span is stored[B,end], so the Reviewer sees "17.2 The Licensee shall…". The prompt also tells the model to begin each quote at the clause number or bullet that opens the line. Tests: "17.2 ", "• $1,500.00", "(a) " shapes; negatives "12 months are…", "17.2 percent…", a quote starting mid-sentence after a word.

**C. No unsupported claims** (prompt rules high, code checks medium).
- Prompt: a document with blanks, placeholders or unfilled signature blocks is described as an unsigned template or form ("provides for", never "is signed/executed/dated"); no facts from outside the document (geography, law, rates, dates, parties); where the text is silent, say so; compare only like with like.
- Code (a): template detection (runs of 3+ underscores or dots, "[●]", "[__]", "[Name…]"-style brackets). When found, Review adds one fixed line to the prompt ("This document contains blanks and is an unsigned form") and the UI shows a template note.
- Code (b): every number in a flag's "says" (digits after stripping commas, currency, "%") must occur in the document text, or the flag is withheld with reason "unsupported-number" (add it to the stored withheld reason codes with a migration). In the summary and in "judgment", such numbers are marked like banned words.

**D. No "typical/usual" claims in v1** (medium). The judgment may say what the clause does to the Owner and what is absent, never what is market, standard, customary, usual, typical or common. When a judgment matches wording.js's market-standard list, drop the judgment (the flag still shows with its says and Source sentences) and count the drop. Severity stays as the model gives it, labelled Redline's judgment. Revisit when approved table rows are passed to the prompt (ADR 0009).

**E. Owner party** (high on the end state, medium on the interim). The model returns "ownerParty" (defined term and role, e.g. "the Allottee") and "parties". The review shows "Reviewed for: the Allottee" above the flags with a "Change" control that re-runs with the Owner fixed in the prompt ("The Owner is X"). The later pre-analysis screen (ADR 0009 contract type) will confirm both before analysis.

- [ ] Each ruling has tests through the Review seam (and extraction seam for A).
- [ ] Re-run the ticket 09 real contracts through the CLI adapter: no fragment is shown, and the run table is recorded again for comparison.
- [ ] New copy through the humanizer.
