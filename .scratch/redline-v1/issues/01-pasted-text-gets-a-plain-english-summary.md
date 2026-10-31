# 01: Pasted text gets a plain-English summary

**What to build:** The Reviewer pastes contract text and gets a plain-English summary produced by server-side Review with the fake model adapter locally; the same build deploys to Vercel with no model adapter and says analysis is unavailable there.

**Blocked by:** None (can start immediately)

**Needs approval for:** Approved 2026-10-31 (Vitest, Supabase JS and CLI, Playwright test, Vercel project access).

**Status:** ready-for-agent

- [x] Review seam test: document text, empty Red line list and fake model adapter in, summary out.
- [x] A reusable whole-word hedge-word and verdict-word check runs on the summary, excluding text reproduced word for word from the document (PRD criterion 8).
- [x] The browser never calls the model adapter; a check against the deployed build proves no code path reaches Claude and fails when one is planted (PRD criterion 16).
  - Verified 2026-10-31 against the live Vercel preview of `2fa94e0` (redline-8jq7nba1b-aadhar-build-projects.vercel.app) via `vercel curl`: `/review` shows the analysis-off message, `POST /api/review` returns 503 `{"error":"unavailable"}`, and the 8 client chunks served for `/` and `/review` contain no match for child_process, spawn(, claude, anthropic, model-adapter or REDLINE_MODEL_ADAPTER. The planted-call failure is covered locally by `npm run test:bundle-check-plant`.
- [ ] A person reads fixture summary output and finds no unsupported claims (PRD criterion 17).
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
