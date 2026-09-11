# 09: Real model adapter and first end-to-end run on a real contract

**What to build:** On the product owner's machine only, Review runs through server-side code calling the unmodified Claude Code CLI signed in to the product owner's own subscription.

**Blocked by:** 03 (Risk flags with checked Source sentences); OQ20 (PRD.md section 3, open question 20)

**Needs approval for:** None (uses the existing CLI, adds no package)

**Status:** ready-for-agent

- [ ] Existing Review seam tests keep working when only the adapter is swapped (spec story 69).
- [ ] The adapter is unavailable outside the local machine, and ticket 01's deployed-build check still shows no path to Claude (PRD criterion 16).
- [ ] No Claude credentials or session tokens are read, stored or handed on.
- [ ] One end-to-end run on a real contract is recorded for summary and Risk flags only (spec story 70).
- [ ] No Market standard basis or contract-type detection is given to the model (OQ6, OQ7).
- [ ] No capability counts as working until it has run end to end on a real document through this adapter (CLAUDE.md).
