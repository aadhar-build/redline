# 04: Question box answers only from the document

**What to build:** The Reviewer asks a question and gets an answer drawn from the document, or a not-in-document result.

**Blocked by:** 01 (Pasted text gets a plain-English summary)

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] Every question in a fixture set that the document does not answer returns not-in-document, with no general-knowledge answer (PRD criterion 10).
- [ ] Answers pass the hedge-word check (PRD criterion 8) and are read by a person for unsupported claims (PRD criterion 17).
- [ ] Answers show no Source sentences; adding them waits on OQ13, with no ticket yet.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
