# 02: Accounts isolated in the database

**What to build:** Documents (extracted text), reviews and Red lines belong to one account, enforced by database policy; no UI.

**Blocked by:** None (can start immediately)

**Needs approval for:** Approved 2026-10-31 (Vitest, Supabase JS and CLI, Playwright test, Vercel project access).

**Status:** ready-for-agent

- [x] Isolation seam test: a second account querying the database directly for the first account's documents, reviews and Red lines gets no rows (PRD criterion 15).
- [x] No table stores original files, Claude credentials or session tokens.
