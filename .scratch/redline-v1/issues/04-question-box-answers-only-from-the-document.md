# 04: Question box answers only from the document

**What to build:** The Reviewer asks a question and gets an answer drawn from the document, or a not-in-document result.

**Blocked by:** 01 (Pasted text gets a plain-English summary)

**Decisions (2026-10-31):** OQ13: answers cite their Source sentences, checked like flags under ADR 0010; an answer whose sources fail is not shown ([spec-gaps 17](../../spec-gaps/issues/17-question-box-answers-and-source-sentences.md)).

**Needs approval for:** None

**Status:** ready-for-agent

- [x] Every question in a fixture set that the document does not answer returns not-in-document, with no general-knowledge answer (PRD criterion 10). Verified on fixtures with the fake adapter only (fixtures/questions/vendor-agreement-01.json, tests/unit/ask.test.js, tests/e2e/ask.spec.mjs): of the 8 questions the document does not answer, 6 return not-in-document (including one whose reply also carried a general-knowledge answer, which is dropped), and 2 are scripted to answer from general knowledge (no source, an invented source) and are withheld instead. None of the 8 shows an answer. Redline cannot tell on its own that the contract is silent, so a not-in-document result depends on the model saying so. What a real model does is not measured yet (ticket 09).
- [ ] Answers pass the hedge-word check (PRD criterion 8) and are read by a person for unsupported claims (PRD criterion 17). Hedge-word part done: answer text goes through findBannedWording and banned words are marked, as in the summary (unit and e2e tests). Not ticked: the person's read of the scripted answers in fixtures/questions/vendor-agreement-01.json is still to do.
- [x] ~~Answers show no Source sentences; adding them waits on OQ13, with no ticket yet.~~ Replaced by OQ13 (decided 2026-10-31): each answer shows the Source sentences it relies on, each checked under ADR 0010 (lib/review/source-check.js) and shown as the stored span; an answer with no sources or any failing source is withheld, never turned into not-in-document.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). app/(app)/review/ask-copy.js; a unit test also checks it for banned words.
