# Questions for the product owner

Open items that block work. Each one is skipped, not guessed, until answered. The full decision record is the wayfinder map at .scratch/spec-gaps/map.md.

## Batch 1 (asked 2026-10-20; all answered 2026-10-31)

1. ~~C1, ranking.~~ Group by level only (ADR 0003).
2. ~~C2, scope additions.~~ Clean result, Outside references and Copy all all join the scope.
3. ~~C4, Counter-offers.~~ The truth rule and the hedge-word ban both apply to the wording; it may only restate or tighten terms in the document.
4. ~~Q20, model.~~ Sonnet 5.5.

## Open (2026-10-31)

1. **OCR engine.** Waits on the bake-off (.scratch/spec-gaps/issues/27). Needs 3–5 real Indian contract scans from you (stamp paper, phone photos to PDF), shared locally, never committed.
2. ~~India Market standard table.~~ Answered: statute rows only (MSMED, Contract Act s.27, Registration Act).
3. ~~Statute citations.~~ Answered: fixed approved list.
4. **Statute wording.** Please open India Code for the three approved sections so their exact text can be recorded (.scratch/spec-gaps/issues/30); automated fetches are blocked. No legal point is shown until then.
5. **Ticket 01's live check.** The Vercel preview is behind Vercel Authentication and the Vercel connection here can't open it. Run `! npm i -g vercel && vercel login`, then the check can use `vercel curl`.
