# 14: Source sentence matching rule

**What to build:** The written rule for "the same sentence" replaces ticket 03's interim identical-text check.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** OQ9: ADR 0010; fixtures from ../../spec-gaps/research/09-what-extraction-does-to-sentences.md section 7.

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] Fixtures with line-break, hyphenation and whitespace changes behave as the rule states.
- [ ] Every displayed Source sentence is found under the rule in every run (PRD criterion 1).
- [ ] Altered and invented Source sentences are still withheld (PRD criterion 2).

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
