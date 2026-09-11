# 06: Default Red lines drive the analysis

**What to build:** Review runs against the four Default Red lines, each shown with its basis; a clause matching a Red line is always Don't sign as written.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] Fixtures of each contract type with a seeded clause for each Default Red line (one modelled on First American's three-year term and $495 fee): every seeded clause is flagged Don't sign as written with the seeded sentence as its Source sentence (PRD criterion 3).
- [ ] A Red line match stays Don't sign as written even when the fake adapter scripts a lower Severity.
- [ ] Default Red lines 2 and 4 are seeded within a single sentence while OQ10 is unsettled; Default Red line 3 fixtures contain no fee escalator (OQ8) and no "as amended from time to time" (OQ3).
- [ ] With a Red line left out of the Review input, its clause is no longer marked a Red line match (PRD criterion 4, at the seam).
- [ ] Basis labels show Default Red line 4 as the product owner's judgment with no evidence.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
