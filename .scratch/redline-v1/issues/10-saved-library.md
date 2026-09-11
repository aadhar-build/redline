# 10: Saved library

**What to build:** The Reviewer signs in; each document's extracted text and its review are saved to their account and can be reopened.

**Blocked by:** 02 (Accounts isolated in the database); 03 (Risk flags with checked Source sentences)

**Needs approval for:** Supabase auth helpers, if any.

**Status:** ready-for-agent

- [ ] The Source sentence check runs against the stored text, and the withheld count is stored with the review (PRD criterion 1, 2).
- [ ] A second signed-in account sees none of the first account's documents (PRD criterion 15, through the interface).
- [ ] Saved documents are not re-analysed (OQ17 untouched).
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
