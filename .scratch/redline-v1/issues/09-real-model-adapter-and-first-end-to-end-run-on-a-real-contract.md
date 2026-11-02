# 09: Real model adapter and first end-to-end run on a real contract

**What to build:** On the product owner's machine only, Review runs through server-side code calling the unmodified Claude Code CLI signed in to the product owner's own subscription.

**Blocked by:** 03 (Risk flags with checked Source sentences)

**Decisions (2026-10-31):** OQ20: Sonnet 5.5 (claude-sonnet-5-5). Market standard table (../../spec-gaps/issues/28-india-market-standard-table.md) is still not given to the model until approved.

**Needs approval for:** None (uses the existing CLI, adds no package)

**Status:** merged into `development` (2026-10-31). Real runs found trust bugs fixed in tickets 21 and 22

- [x] Existing Review seam tests keep working when only the adapter is swapped (spec story 69).
- [x] The adapter is unavailable outside the local machine, and ticket 01's deployed-build check still shows no path to Claude (PRD criterion 16).
- [x] No Claude credentials or session tokens are read, stored or handed on.
- [x] One end-to-end run on a real contract is recorded for summary and Risk flags only (spec story 70).
- [x] No Market standard basis or contract-type detection is given to the model (OQ6, OQ7).
- [x] No capability counts as working until it has run end to end on a real document through this adapter (CLAUDE.md).

## Comments

- 2026-10-31, what was built:
  - lib/review/adapters/claude-cli.mjs runs `claude -p --model claude-sonnet-5-5` with tools, MCP servers, slash commands, settings files and customisations off (`--tools "" --strict-mcp-config --disable-slash-commands --safe-mode --setting-sources ""`) and `--no-session-persistence`. It runs in an empty temporary directory and gets the prompt on stdin. It reads `.result` from the JSON envelope and returns only that. stderr, the session id and usage are dropped. There is a 10-minute per-run timeout.
  - `REDLINE_MODEL_ADAPTER=cli` selects it (lib/review/adapters/index.js). The module is loaded from disk at call time behind a bundler-ignored import, so it is never compiled into `.next` and never traced into a deployment.
  - The CLI adapter is selected, and runs, only when REDLINE_LOOPBACK_ONLY=1 is also set. `npm run dev:local` sets it together with `-H 127.0.0.1`, and that is the only documented way to run with the CLI: `REDLINE_MODEL_ADAPTER=cli PORT=3109 npm run dev:local`. Without the flag, /review says analysis is unavailable and the routes return 503 (checked live).
  - lib/review/local-guard.js sits in front of /api/review and /api/ask, but only when the CLI adapter is selected. It requires:
    - a localhost Host on PORT;
    - a same-origin Origin and Sec-Fetch-Site;
    - an application/json body;
    - the server's per-launch run token, a random value rendered only into /review and sent back as `x-redline-run-token`.
  - It also allows one CLI run at a time (otherwise 429).
  - These header checks stop browsers (CSRF, DNS rebinding). The loopback binding is what keeps LAN clients out. A Next 16 route handler cannot see the client's socket address, and x-forwarded-for can be forged, so there is no per-request remote-address check.
- Criterion 1: Review, its prompt and its checks are unchanged. The real runs call the same `review()` that the route calls. `npm test` passes, 184 tests including the existing Review seam tests on the fake adapter.
- Criterion 2: this criterion covers Vercel and the browser. With the env var set, the adapter would still run on any other machine.
  - On Vercel, `getModelAdapter` returns null before anything loads, and the adapter refuses to run when VERCEL is set. Both are tested.
  - In the browser, the adapter is absent from `.next/static` and `.next/server`, and from every `.nft.json`.
  - `npm run check:client-bundle` passes. `npm run test:bundle-check-plant` gives OK. A unit test plants claude-cli.mjs in fake server output, and the check fails with `server:claude-cli-call`.
  - The check's review-prompt rule still looked for an old prompt opening. It now matches the current one.
- Criterion 3: the CLI finds its own sign-in. Nothing reads ~/.claude.
  - The child gets an allowlist of PATH, HOME, USER, LOGNAME, LANG, LC_ALL, TMPDIR, SHELL and TERM. A test plants ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN and a Supabase key and checks that none reaches the child.
  - `--bare` is not used, because it would switch the CLI to API-key auth.
- Criterion 5: Review's prompt carries no Market standard table and no contract type.
  - The model's `judgment` text still asserts what is "typical" from its general knowledge, in every document. It is always labelled Redline's judgment.
  - The prompt also never says which party is the Owner. The model inferred it: licensee (T02), bounden (T03), allottee (T05), consultant (T06) and lessee (T07).
- Criterion 6: what ran end to end on real documents through this adapter:
  - **The summary** ran end to end. It had one unsupported claim, listed below.
  - **Risk flags** ran end to end. The Source sentence check is not yet trustworthy where pages join (QUESTIONS.md 13), and it withholds many correct quotes (QUESTIONS.md 14).
  - **The question box** has not been run through this adapter.
- 2026-10-31, real runs. The text-layer PDFs come from the owner's samples folder.
  - Text was extracted as feature/05-upload's lib/extraction/pdf.js does: pdfjs-dist 6.4.299 with the same page-text join and needs-OCR check, pages joined with a blank line. No page needed OCR.
  - Each run used Sonnet 5.5 through `getModelAdapter({REDLINE_MODEL_ADAPTER: "cli"})` and `review()`.
  - Outputs are under the gitignored tmp/real-runs/.
  - No reply was unreadable and none came wrapped in a code fence.

  | Doc | Type | Chars | Secs | Summary | Shown (DSW/N/K) | Withheld (all "source-not-found") | Check behaved? |
  |---|---|---|---|---|---|---|---|
  | T01 | Leave and licence, NDMC tender (India) | 154,707 | 59 | shown | 9 (1/6/2) | 12: 9 clause number dropped, 3 sub-item cut from its lead-in | No: 1 shown fragment at a page join |
  | T02 | Leave and licence template (AP Law Dept) | 4,841 | 19 | shown | 5 (1/1/3) | 3: running page header before the clause | Yes for shown flags; 3 false withholds |
  | T03 | Tender agreement (Kerala college) | 4,156 | 13 | shown | 3 (0/3/0) | 2: 1 clause number dropped, 1 recital after a line ending ":" | Yes; 2 false withholds |
  | T05 | Agreement for sale, RERA (Haryana) | 66,101 | 38 | shown | 8 (0/1/7) | 9: 7 clause number dropped, 1 page footer inside the sentence, 1 after an address block | No: 2 shown fragments at page joins |
  | T06 | Professional services agreement (Texas city) | 23,028 | 43 | shown | 9 (0/3/6) | 4: 3 clause letter or bullet dropped, 1 previous sentence has no full stop | Yes; 4 false withholds |
  | T07 | Office lease (Georgia county) | 7,328 | 29 | shown | 8 (0/3/5) | 0 | Yes |

  - Withheld flags: all 30 quotes are verbatim in the stored text, so none was altered or invented. They break down as follows:
    - 20 lost their sentence start because the model left off an inline clause number, letter, bullet or heading ("17.2 ", "C. GRANT COMMISSION: ", "• ").
    - 4 were broken by a page header or footer: 3 running headers before the clause (T02) and 1 "Page 16 of 37" inside the sentence (T05).
    - 3 are sub-items cut from their ";" or ":" lead-in. ADR 0010 withholds these on purpose.
    - 3 others have no sentence boundary in the source text before them: a recital after a line ending ":", an address block, and a previous sentence with no full stop.
    - Ticket 14's boundary rule shows exactly the same flags on these replies and rescues none. This was checked on feature/14-matching-rule, and again after merging development into this branch.
  - Shown fragments: 3 Source sentences are cut mid-sentence at a page join, because the blank line that joins pages counts as a span end. T05: "...the Allottee(s) fail(s) to" and "...breach of any of the aforesaid". T01: "...or the Definitive Documents or". Both development's check and ticket 14's accept them.
  - Claims the document does not support, from reading each summary and each shown flag against the text. T01 was checked for counts and fragments only and not read line by line.
    - T02 summary: "The document is signed by both parties and two witnesses." It is a blank template with empty signature blocks.
    - T06 flag "Execution date left blank": the judgment says the signing date is "not fixed in the document". The opening says "made and executed this 17th day of April 2024". A second judgment compares the $140 hourly rate with the $2,000 hard-cost cap, which is a muddled comparison.
    - T07: a venue judgment implies that Valdosta is outside Cook County. That comes from general knowledge, not the text.
    - T03 and T05: the summaries' specifics were checked against the text and are supported. These include the 10% Earnest Money, the 5-year/90-day defect terms, the 3- to 6-month conveyance, the two demands plus 90 days, the five landowner companies and Rule 15.
  - For ticket 17: the hedge-word marking hits the document's own permission wording ("the licensee may not transfer", "the Promoter may demand"). Of the 7 marks, all are "may" used this way.
- 2026-10-31, browser run.
  - On `REDLINE_MODEL_ADAPTER=cli npm run dev:local` (127.0.0.1), Playwright pasted T07's text (30 s) and, before the guard was added, T06's (44 s).
  - The summary rendered. Flags appeared grouped Don't sign as written, Negotiate, Know this. T06 showed "4 Risk flags withheld."
  - The first flag's Source sentence is in the pasted text. The browser's only request was POST /api/review, which returned 200.
  - Against the live server, a foreign Origin, a rebinding Host and a missing Origin each got 403, and a text/plain body got 415. The machine's LAN address did not connect.
  - After the run token was added, Playwright pasted T03 (16 s, "3 Risk flags withheld."). A same-origin curl without the token got 403.
  - That T03 browser run showed 3 flags (2 Don't sign as written, 1 Negotiate) with 3 withheld. The script run showed 3 Negotiate with 2 withheld. The same document gives different flags and Severities from run to run.
- e2e: another worktree's server held port 3101 throughout, so `npm run test:e2e` could not start its own server. The same suite ran against this build on ports 3121/3122 and 18 passed. The config for that is in gitignored tmp/.
