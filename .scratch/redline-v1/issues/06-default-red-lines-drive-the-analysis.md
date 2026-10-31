# 06: Default Red lines drive the analysis

**What to build:** Review runs against the four Default Red lines, each shown with its basis; a clause matching a Red line is always Don't sign as written.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Needs approval for:** None

**Status:** built on feature/06-default-red-lines, verified at the Review seam and in e2e with the fake adapter. Not yet run end to end on a real document (needs ticket 09's real adapter).

- [x] Fixtures of each contract type with a seeded clause for each Default Red line (one modelled on First American's three-year term and $495 fee): every seeded clause is flagged Don't sign as written with the seeded sentence as its Source sentence (PRD criterion 3).
  Evidence: fixtures/contracts/red-line-seeds.js lists the seeds in vendor-agreement-02 (First American, $495), vendor-agreement-03 (Indian-style, Rs. 42,000), commercial-lease-01 and client-agreement-01. tests/unit/red-lines.test.js checks every seed; tests/e2e/risk-flags.spec.mjs checks vendor-agreement-02 in the browser.
- [x] A Red line match stays Don't sign as written even when the fake adapter scripts a lower Severity.
  Evidence: each fixture's script puts some matches at Negotiate or Know this; the unit test "raises a Red line match the script put at a lower Severity" passes for all four.
- [x] Superseded wording, ticked against the decided version. The original box read: "Default Red lines 2 and 4 are seeded within a single sentence while OQ10 is unsettled; Default Red line 3 fixtures contain no fee escalator (OQ8) and no 'as amended from time to time' (OQ3)." OQ10 was settled by .scratch/spec-gaps/issues/11 (a flag cites several Source sentences, each checked, withheld if any fails), and OQ3 and OQ8 by .scratch/spec-gaps/issues/12 (both match Red line 3). So Red lines 2 and 4 are seeded across two sentences in every fixture, Red line 4 carries "No cap appears in the document." labelled Redline's judgment, and Red line 3 is seeded as a one-sided change (vendor-agreement-02, client-agreement-01), "as amended from time to time" (vendor-agreement-03) and a written-in escalator (commercial-lease-01).
- [x] With a Red line left out of the Review input, its clause is no longer marked a Red line match (PRD criterion 4, at the seam).
  Evidence: unit test "with <id> left out" runs for each Default Red line in each fixture: the Red line is not in the prompt or redLinesChecked, its clauses have redLineMatch null and keep their scripted Severity, and the others still match.
- [x] Basis labels show Default Red line 4 as the product owner's judgment with no evidence.
  Evidence: lib/review/red-lines.js label "No evidence: the product owner's judgment"; unit test and e2e check it.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
  Evidence: the Red line names, catches, basis labels and notes, the Red line match label, the Red lines checked section and the rewritten no-flags message went through the humanizer skill before commit, then were checked by hand against ADR 0004.
