# 14: Source sentence matching rule

**What to build:** The written rule for "the same sentence" replaces ticket 03's interim identical-text check.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** OQ9: ADR 0010; fixtures from ../../spec-gaps/research/09-what-extraction-does-to-sentences.md section 7.

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31); 0 source mismatches on real documents in final-real-run-2026-11-02; heading-line loophole closed (QUESTIONS 11)

- [x] Fixtures with line-break, hyphenation and whitespace changes behave as the rule states. (2026-10-31: fixtures/contracts/extracted-shapes-01.js, PDF- and DOCX-shaped strings, plus the twelve cases below, in tests/unit/source-check.test.js.)
- [ ] Every displayed Source sentence is found under the rule in every run (PRD criterion 1). (Shown on fixtures through the Review seam with the fake adapter, tests/unit/risk-flags.test.js. Not ticked: no run on a real document or with the real model yet, ticket 09.)
- [x] Altered and invented Source sentences are still withheld (PRD criterion 2). (2026-10-31: every altered and invented quote in the PDF, DOCX and pasted fixtures is withheld and counted through the Review seam.)

## Comments

- 2026-10-31: sentence-boundary rule settled (ADR 0010 addendum, Fable advisor). Implement it in lib/review/source-check.js with these tests (text / quote / expected):
  1. "12.3 Termination\nEither party may terminate this Agreement on 30 days' notice." / "Either party may terminate this Agreement on 30 days' notice." / found
  2. "TERMINATION AND RENEWAL\nEither party may terminate this Agreement on 30 days' notice." / same / found
  3. "The Consultant shall not, without the prior written consent of the\nCompany, engage any subcontractor." / "Company, engage any subcontractor." / not found
  4. "The Consultant shall:\n(a) deliver the reports; and\n(b) keep the Company's information confidential." / "(b) keep the Company's information confidential." / not found
  5. "Payments are due within 30 days unless the Company\ndisputes the invoice in writing." / "disputes the invoice in writing." / not found
  6. "Sharma Infrastructure Private\nLimited shall pay the fee." / "Limited shall pay the fee." / found (accepted cost)
  7. "ABC Pvt. Ltd. shall indemnify the Company against all claims." / "shall indemnify the Company against all claims." / not found
  8. "The Consultant shall deliver reports, invoices, etc. within 7 days." / "within 7 days." / not found
  9. "This Agreement is governed by S. 27 of the Indian Contract Act, 1872." / "27 of the Indian Contract Act, 1872." / not found
  10. "Notices shall be sent to A. K. Sharma at the registered office." / "Sharma at the registered office." and "K. Sharma at the registered office." / not found
  11. "The fee is set out in Schedule A. The Company shall pay within 30 days." / "The Company shall pay within 30 days." / found
  12. "The Consultant shall be paid Rs. 1,50,000.00 on signing." / "00 on signing." / not found; whole sentence / found

## Ticket 14c, 2026-10-31: boundary allowances and two Outside reference bugs
- Built ADR 0010 addendum (ticket 14c): lowercase roman list markers i-xx at a line start, page-footer lines skipped for boundaries, "&" in heading lines; prompt line to quote the stored text exactly. Tests: tests/unit/boundary-allowances.test.js.
- Bug 3: "for the time being in force" added to the "as amended" wordings; bug 2: government e-stamp and registration verification hosts are not Outside references (ADR 0007 addendum). Tests: tests/unit/outside-reference-14c.test.js.
- Re-measure (counts only, research 32): S04 replays 24 withheld before, 6 after over three reruns; S01 and the six text contracts unchanged. Fresh CLI run: S04 8 shown, 3 withheld; S01 4 shown, 1 withheld; T03 2 shown, 1 withheld.
