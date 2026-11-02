# 18: Outside references as Risk flags; resolving by upload

**What to build:** Each Outside reference becomes a Risk flag with a Severity and a Counter-offer, "as amended from time to time" is handled as decided, and the Reviewer can resolve a reference by uploading the referenced document.

**Blocked by:** 08 (Counter-offers for Don't sign as written and Negotiate flags); 13 (Outside references raised and marked as reviewed)

**Decisions (2026-10-31):** OQ1: Negotiate. OQ2: attach as a schedule, terms fixed as at signing. OQ3: 'as amended from time to time' is Don't sign as written (Red line 3). OQ15: analysed together as one review.

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31), follow-up 18b merged too; follow-ups run on fixtures only (final-real-run-2026-11-02)

- [x] Every kind of Outside reference, including "as amended from time to time", is a Risk flag with its Source sentence (PRD criterion 6, in full). Built in ticket 13 (lib/review/outside-references.js): Negotiate, or Don't sign as written for "as amended" through Red line 3.
- [x] Each has a Counter-offer (PRD criterion 12). Built in ticket 13: attach as a schedule, terms fixed as at signing (spec-gaps 26).
- [x] Uploading the referenced document resolves it and is handled as OQ15 decides; once nothing else stands in the way, a Clean result is given (PRD criterion 6). Evidence: tests/unit/referenced-documents.test.js; tests/isolation/referenced-documents.test.ts (another account can't read, change, delete or attach; a review naming another account's text resolves nothing); tests/e2e/referenced-upload-saved.spec.mjs (DOCX parsed in the browser, only text posted, survives reopen). Table referenced_documents and reviews.referenced_document_ids (migration 20261031003500). QUESTIONS.md 36-42 settled by the Fable advisor and built on feature/18b-referenced-rulings (see Comments); 43 open. Left unticked: built and tested with the fake adapter only, not yet run end to end with the Claude CLI on a real contract and its referenced document (CLAUDE.md).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

- 2026-10-31, final real run (../final-real-run-2026-10-31.md): outside-references-01 with its Schedule B, through the Claude CLI (Sonnet 5.5). Raw reply gave 2 flags with "document": "R1", both shown and checked against Schedule B; in the browser, signed in, adding Schedule B resolved the reference and showed 2 flags from it. Box 3 ticked.

## Comments

- 2026-10-31, the Fable advisor's rulings on QUESTIONS.md 36-42 built on feature/18b-referenced-rulings (migrations 20261031003600 parties, 20261031003700 withheld reason, 20261031003800 nested documents):
  - 38: marks carry over (previousMarks by text id and key) on Add, Remove and Change.
  - 39: copy only; an added "as amended" reference says it still blocks under Red line 3.
  - 40: one 200,000-character cap, checked before storing and in the browser before posting.
  - 42: the contract's schedule headings count in added documents (findOutsideReferences parentText).
  - 41: ask() takes the added documents of the review shown; sources name their text.
  - 37: removeReferencedDocument and DELETE /api/referenced-documents; Remove in the UI.
  - 36: references inside added documents join outsideReferences; on an Outside reference, addedDocument is the document added against it and referencedDocument is the text it sits in.
  - Tests: tests/unit/referenced-rulings.test.js, tests/isolation/referenced-rulings.test.ts, tests/e2e/referenced-rulings-saved.spec.mjs. Still fake adapter only; no real-document run of these flows yet.
