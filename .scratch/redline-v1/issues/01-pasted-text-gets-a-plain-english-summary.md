# 01: Pasted text gets a plain-English summary

**What to build:** The Reviewer pastes contract text and gets a plain-English summary produced by server-side Review with the fake model adapter locally; the same build deploys to Vercel with no model adapter and says analysis is unavailable there.

**Blocked by:** None (can start immediately)

**Needs approval for:** test runner and Next.js install (stack is settled but CLAUDE.md says ask before adding a dependency); Vercel project access.

**Status:** ready-for-agent

- [ ] Review seam test: document text, empty Red line list and fake model adapter in, summary out.
- [ ] A reusable whole-word hedge-word and verdict-word check runs on the summary, excluding text reproduced word for word from the document (PRD criterion 8).
- [ ] The browser never calls the model adapter; a check against the deployed build proves no code path reaches Claude and fails when one is planted (PRD criterion 16).
- [ ] A person reads fixture summary output and finds no unsupported claims (PRD criterion 17).
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
