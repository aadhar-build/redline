---
version: 1
slug: "app-app-layout-js"
primary_target: "app/(app)/layout.js"
related_targets: []
---

# App shell (behind sign-in)

## Scope and mode
- Every route behind sign-in. Mode: Operate.
- Brief only. No app screen is built yet; tickets 01–20 in .scratch/redline-v1/issues/ build it.

## Audience and job
The Reviewer, working through a negotiable vendor agreement, commercial lease or client agreement before the Owner signs, deciding what to raise and needing to defend each point to the Owner.

## What the frame holds
- **Paste or upload:** text-layer PDF, DOCX or pasted text. Image-only PDFs are rejected with a reason.
- **The review:** a workpaper header block (document, Counterparty, reference, Red lines checked, Reviewed by), then:
  - a short summary on top;
  - the findings pane in Inspection Report's structure (numbered findings, action stamp per Severity, Source sentence box, fixed Severity key), grouped by Severity and not ranked within a level;
  - the contract pane beside it, with ticks and reference codes linking each finding to its sentence;
  - a Counter-offer on each flag;
  - "Copy all as text" (ticket 20).
- **Clean result:** said plainly, listing every Red line checked, with Know this flags beneath. Never safe, fine or good to sign.
- **Question box:** answers only from the document, or says the answer is not in it.
- **Red lines:** the Reviewer's list, framed like an audit program, starting with the four Default Red lines, each with its basis label.
- **Library:** the Reviewer's past reviews, framed like a workpaper index.

## States that matter
- Analysing.
- Results.
- Clean result.
- Outside references not reviewed, blocking a Clean result.
- Withheld flags.
- Ambiguous clauses with their readings.
- Rejected upload.
- Empty library.
- Analysis unavailable in the deployed build (ticket 01).
- Errors that name the problem and the recovery.

## Direction
- The same world as the landing page: Audit Workpaper, with Inspection Report's findings pane pinned by the product owner.
- Operate discipline wins over expression: familiar controls, dense but legible, motion only for state.

## Constraints
- WCAG 2.2 AA.
- No state carried by colour alone.
- Account isolation enforced in the database.
- Analysis local-only until an API key is adopted.
- No OCR.
- All copy through the humanizer skill.

## Unresolved (builders must not invent these)
- Where the withheld count is shown (OQ11).
- Whether withheld flags or Ambiguous clauses block a Clean result (OQ12, OQ5).
- Severity and Counter-offer for Outside references (OQ1, OQ2).
- Counter-offers on Know this flags (OQ4).
- Source sentences in question-box answers (OQ13).
- Re-analysis after Red line edits (OQ17).
- Navigation topology across review, Red lines and library.
