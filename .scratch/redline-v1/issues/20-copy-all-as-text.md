# 20: Copy all as text

**What to build:** From a review, the Reviewer copies every displayed Risk flag, with its Source sentence, Severity and Counter-offer, as plain text in one action, ready to paste into an email to the Owner or the Counterparty. This is a scope change the product owner approved on 2026-09-11 while shaping the review flow; CLAUDE.md's scope list does not include it yet.

**Blocked by:** 08 (Counter-offers for Don't sign as written and Negotiate flags)

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] One action copies every displayed Risk flag grouped by Severity, each with its Source sentence word for word, what the clause says, its Red line match or Redline's judgment label, and its Counter-offer.
- [ ] The copied text contains nothing that is not displayed on screen; withheld flags are not included, and where the withheld count appears is left to OQ11 (PRD.md section 3, open question 11).
- [ ] Each copied Source sentence is identical to the one displayed.
- [ ] Redline's own text in the copy passes the hedge-word and verdict-word check, excluding Source sentences and Counter-offers (PRD criterion 8; Counter-offer wording waits on OQ14).
- [ ] Once ticket 11 has landed, copying a Clean result includes its plain statement and every Red line checked (PRD criterion 7).
- [ ] Copying writes to the clipboard only; no request leaves the browser.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
