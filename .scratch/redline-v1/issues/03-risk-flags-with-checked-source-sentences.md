# 03: Risk flags with checked Source sentences

**What to build:** Each Risk flag shows its Source sentence, one Severity, and what the clause says stated as fact. Redline's code withholds and counts any flag whose Source sentence it cannot find in the document text.

**Blocked by:** 01 (Pasted text gets a plain-English summary); C1 (CLAUDE.md contradiction 1, see .scratch/redline-v1/spec.md Further Notes) blocks only the ordering criterion

**Needs approval for:** a schema validator for model output, only if one is wanted.

**Status:** ready-for-agent

- [ ] With the fake adapter returning altered or invented Source sentences, every one is withheld, none shown, and the withheld count equals the number withheld (PRD criterion 2).
- [ ] Every displayed Source sentence is found in the document text; the interim check accepts identical text only and errs toward withholding; the tolerant rule comes in ticket 14, so criterion 1 is only partly covered here (PRD criterion 1).
- [ ] Every Unusual clause or Market standard claim carries the label Redline's judgment (PRD criterion 9).
- [ ] The hedge-word and verdict-word check extends to Risk flag text (PRD criterion 8).
- [ ] Flags are grouped by Severity and not ranked within a level; this criterion waits on C1.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
