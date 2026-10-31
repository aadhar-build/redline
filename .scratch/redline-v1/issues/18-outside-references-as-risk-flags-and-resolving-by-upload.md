# 18: Outside references as Risk flags; resolving by upload

**What to build:** Each Outside reference becomes a Risk flag with a Severity and a Counter-offer, "as amended from time to time" is handled as decided, and the Reviewer can resolve a reference by uploading the referenced document.

**Blocked by:** 08 (Counter-offers for Don't sign as written and Negotiate flags); 13 (Outside references raised and marked as reviewed)

**Decisions (2026-10-31):** OQ1: Negotiate. OQ2: attach as a schedule, terms fixed as at signing. OQ3: 'as amended from time to time' is Don't sign as written (Red line 3). OQ15: analysed together as one review.

**Needs approval for:** None

**Status:** built on feature/18-referenced-upload, awaiting merge.

- [x] Every kind of Outside reference, including "as amended from time to time", is a Risk flag with its Source sentence (PRD criterion 6, in full). Built in ticket 13 (lib/review/outside-references.js): Negotiate, or Don't sign as written for "as amended" through Red line 3.
- [x] Each has a Counter-offer (PRD criterion 12). Built in ticket 13: attach as a schedule, terms fixed as at signing (spec-gaps 26).
- [x] Uploading the referenced document resolves it and is handled as OQ15 decides; once nothing else stands in the way, a Clean result is given (PRD criterion 6). Evidence: tests/unit/referenced-documents.test.js; tests/isolation/referenced-documents.test.ts (another account can't read, change, delete or attach; a review naming another account's text resolves nothing); tests/e2e/referenced-upload-saved.spec.mjs (DOCX parsed in the browser, only text posted, survives reopen). Table referenced_documents and reviews.referenced_document_ids (migration 20261031003500). Open points: QUESTIONS.md 36-40. Not yet run end to end with the Claude CLI on a real contract and its referenced document; the fake adapter covers the tests.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
