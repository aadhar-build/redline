# 10: Saved library

**What to build:** The Reviewer signs in; each document's extracted text and its review are saved to their account and can be reopened.

**Blocked by:** 02 (Accounts isolated in the database); 03 (Risk flags with checked Source sentences)

**Needs approval for:** Supabase auth helpers, if any. Approved 2026-10-31: @supabase/ssr for magic-link sessions (supabase-js moved to dependencies).

**Status:** built on `feature/10-saved-library` (2026-10-31), awaiting merge into `development`. Verified on fixtures with the fake adapter and the local Supabase stack only; not yet run end to end on a real document (needs ticket 09's real adapter).

- [x] The Source sentence check runs against the stored text, and the withheld count is stored with the review (PRD criterion 1, 2). Signed in, /api/review saves the text, reads it back by id and reviews that; /api/ask with a documentId reads the stored text and ignores any posted text, with no fallback (404 when not found). Reopening re-checks every stored Source sentence against the stored text. Evidence: tests/isolation/library.test.ts (prompt carries the DB text; a question uses text changed only in the DB; a sentence removed from the stored text is withheld on reopen; withheld_count 5 stored), tests/unit/saved.test.js, tests/e2e/library.spec.mjs (posting `text: "Tampered text."` with the id still answers from the stored fixture).
- [x] A second signed-in account sees none of the first account's documents (PRD criterion 15, through the interface). Evidence: tests/e2e/library.spec.mjs: account B, signed in by magic link, sees an empty library, gets 404 on /library/<A's id> and 404 from /api/ask with A's id; tests/isolation/library.test.ts covers the same through the library module.
- [x] Saved documents are not re-analysed (OQ17 untouched). openSaved/reopenReview take no model adapter; e2e reopens with no /api/review request and on the no-adapter server (3102).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md). Copy in app/(app)/library/library-copy.js plus two error strings in copy.js and ask-copy.js.

Notes:
- Signed out, the paste flow still works, unsaved (the simpler choice; the existing e2e specs are unchanged).
- Only a complete review is saved (summary shown and Risk flags read; settled by Fable advisor, 2026-10-31). Otherwise the document row is removed again and the Reviewer is told.
- Migration 20261031000200 adds reviews.withheld: reason codes only ({"reason": code}, enforced by a CHECK), with withheld_count equal to its length. A reopened review shows the same withheld line as a fresh one.
- The source kind from ticket 05 Extraction (pdf, docx, paste) is posted with the text and stored as documents.source_kind.
- Local sign-in links return only to the site_url host (127.0.0.1), so the library e2e project runs on 127.0.0.1:3101.
- Owner follow-up (map.md): add the Vercel preview URLs as auth redirect URLs on the hosted project.
