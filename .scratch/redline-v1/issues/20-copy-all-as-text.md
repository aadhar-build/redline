# 20: Copy all as text

**What to build:** From a review, the Reviewer copies every displayed Risk flag, with its Source sentence, Severity and Counter-offer, as plain text in one action, ready to paste into an email to the Owner or the Counterparty. This is a scope change the product owner approved on 2026-09-11 while shaping the review flow; CLAUDE.md's scope list does not include it yet.

**Blocked by:** 08 (Counter-offers for Don't sign as written and Negotiate flags)

**Needs approval for:** None

**Status:** merged into `development` (2026-10-31); not re-run in final-real-run-2026-11-02

- [x] One action copies every displayed Risk flag grouped by Severity, each with its Source sentence word for word, what the clause says, its Red line match or Redline's judgment label, and its Counter-offer.
- [x] The copied text contains nothing that is not displayed on screen; withheld flags are not included, and where the withheld count appears is left to OQ11 (PRD.md section 3, open question 11).
- [x] Each copied Source sentence is identical to the one displayed.
- [x] Redline's own text in the copy passes the hedge-word and verdict-word check, excluding Source sentences and Counter-offers (PRD criterion 8; Counter-offer wording waits on OQ14).
- [x] (ticket 11 has landed) Once ticket 11 has landed, copying a Clean result includes its plain statement and every Red line checked (PRD criterion 7).
- [x] Copying writes to the clipboard only; no request leaves the browser.
- [x] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).

## Rulings from ticket 07 (Fable advisor, 2026-10-31, high confidence)
- For an Ambiguous clause, the copied block also lists each reading after "What the clause says", in the order shown on screen, none marked as chosen, then the Counter-offer. The same labels and hedge-word marking as on screen.
- Also in this ticket's build: add to `AMBIGUOUS_PROMPT_LINES` in lib/review/review.js that the Counter-offer's wording must be one of the shown readings, not a third construction (a person checks this, PRD criterion 17). Remove the "for now (QUESTIONS.md)" hedge on `shownSeverity`: a Red line match outranks Ambiguous (ADR 0003, spec-gaps 15). That is settled.

## Build notes (2026-10-31)
- One "Copy all as text" button above the review (CopyAll.js), on fresh and reopened reviews alike, since both use ReviewResult. Text comes from `reviewAsText` in app/(app)/review/review-text.js, built from the same review object and COPY strings as the screen, in screen order: summary pane (template note, summary, marked notes, summary note), then the flags pane (status, Owner line, Severity note, withheld count), the Clean result or the Severity groups, Outside references with their reviewed state, the marked-word notes and Red lines checked. The key, the question box and the controls are left out. No OCR notes are shown on screen yet, so none are copied.
- Withheld count: copied where the screen shows it, under the Severity note, before the flags (settles this ticket's part of OQ11 the way that claims least: it mirrors the screen).
- Marked words and numbers: plain text has no highlight, so each marked span is wrapped in [square brackets], and when any are present the copy opens with "Words in [square brackets] are highlighted on screen." That line is the one thing in the copy not on screen; it only explains the brackets. Source sentences are never bracketed; each is copied in straight quotes, word for word.
- Each flag reads: "N. <Severity>: <title>", then what the clause says, the Red line match or Redline's judgment label, any readings ("Reading i of n: ..."), Source sentences, then the Counter-offer, matching the panel's order and labels.
- Screen readers: a polite live region says "Copied the whole review.", the Counter-offer copy pattern. Copying writes only to the clipboard; the e2e checks no request is sent.
- Rulings applied: AMBIGUOUS_PROMPT_LINES gains the line that the Ambiguous Counter-offer uses one of the given readings, not a third one; the "for now (QUESTIONS.md)" hedge on shownSeverity is removed.
- Severity labels moved to app/severity-labels.js (Glyph.js re-exports them) so the text builder can use them outside React.
- Tests: tests/unit/copy-all.test.js (one per section, nothing hidden, reopened equals fresh); tests/e2e/copy-all.spec.mjs (fake-adapter) and copy-all-saved.spec.mjs (library).
