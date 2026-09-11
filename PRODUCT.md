# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js, Supabase for auth and database, deployed on Vercel. Settled by the product owner (CLAUDE.md). For now, analysis runs only on the product owner's machine through the Claude Code CLI; nothing deployed calls Claude until an API key is adopted.

## Users
The primary user is the **Reviewer**: an ops manager, bookkeeper, office manager or fractional COO who reads a negotiable small-business contract on the Owner's behalf before it is signed, and decides what to raise with the Counterparty. The contracts are vendor agreements, commercial leases and client agreements. The Reviewer is sometimes the Owner.

Their job is to find what to push back on, and to show the Owner where the contract says it.

Not for: freelancers, consumers or renters, or anyone who has already signed (ADR 0002).

The research never studied Reviewers. What they do today, with what tools and how long it takes, is unknown.

## Product Purpose
Redline reads a contract before it is signed and shows what to push back on, with the Source sentence beside every Risk flag. Version 1 exists to prove the analysis can be trusted. Success is defined by PRD.md section 4 ("What good looks like"), which the eval suite will measure.

## Positioning
Built for the Reviewer: someone who has to justify every point to an Owner. Each capability serves that person:
- a Source sentence beside every Risk flag, so each point can be defended;
- Severity named by the Reviewer's next action (Don't sign as written, Negotiate, Know this);
- saved Red lines and a library of past documents.

This position is unvalidated and contestable:
- Reviewers were never studied (ADR 0002).
- goHeather already lists business ops and finance teams, small firms and fractional GCs as its audience, with risk-ordered flags, suggested redlines and document chat (research/agent3-what-exists.md). It is the closest neighbour to this position.

## Operating Context
- The contract arrives from the Counterparty as a PDF, a Word file, or text in an email or on a web page, before signing.
- The Reviewer reviews it and raises points with the Counterparty using Counter-offers, then tells the Owner what matters.
- Business contracts often bring in terms from documents that were not sent: master terms at a web address, Order Forms, Statements of Work.

## Capabilities and Constraints
Terminology is fixed in CONTEXT.md; use its terms and avoid the words it lists. Settled decisions are in docs/adr/0001–0007.

Version 1 capabilities (PRD.md section 3):
- Upload a text-layer PDF, a DOCX file or pasted text. Files are parsed in the browser and only extracted text is stored. Scanned or image-only PDFs are rejected; there is no OCR.
- A plain-English summary that states only what the document says.
- Risk flags, each with a Source sentence found word for word by code. Flags whose Source sentence is not found are withheld and counted.
- Three Severity levels. A Red line match is always Don't sign as written. Unusual clause claims are labelled Redline's judgment.
- A Counter-offer per flagged clause.
- A question box that answers only from the document.
- Editable Red lines, pre-filled with four Default Red lines.
- Outside references flagged, blocking a Clean result until uploaded or marked reviewed.
- A Clean result that lists every Red line checked.
- A saved library, with isolation between accounts enforced in the database.

Excluded on purpose: payments and billing, OCR, and sharing a document between accounts.

Undecided:
- the 21 open questions in PRD.md section 3, including the analysis model, the PDF and DOCX parsers, and document and output languages;
- whether v1 has a public landing page. CLAUDE.md's copy rule names one, but CLAUDE.md's scope list does not include it.

## Brand Commitments
- **Name:** Redline. No logo, colours or other brand assets exist yet; do not invent them.
- **"Redline" is also everyday contract language** for marked-up edits. CONTEXT.md avoids "Redline suggestion" and uses Counter-offer for replacement wording.
- **Voice (ADR 0005, ADR 0006):**
  - plain and audit-like;
  - what a clause says is stated as fact, backed by its Source sentence, and anything else is labelled Redline's judgment;
  - no hedge words ("may", "could potentially", "consider consulting a lawyer");
  - never "safe", "fine" or "good to sign".
- **Copy:** all copy a Reviewer reads (landing page, UI labels, error messages, empty states) goes through the humanizer skill before it is committed. Copy that reads as model-written is a defect (CLAUDE.md).

## Evidence on Hand
- research/: four research reports and research/summary.md.
- PRD.md: the brief, quoting the strongest evidence. That includes the FTC action against First American (a three-year term with a $495 cancellation fee) and the Adobe/Advanis survey of SMB owners.

Absent, and must not be fabricated:
- customers, testimonials, case studies or usage data;
- pricing or willingness-to-pay evidence;
- interviews with Reviewers;
- a test set of real vendor agreements, commercial leases or client agreements;
- verified first-person accounts from Owners.

## Product Principles
1. **Every claim traces to the document.** Statements rest on a Source sentence the reader can find; anything else is labelled as Redline's judgment.
2. **The Reviewer must be able to defend each point to the Owner.** Output that cannot be justified to someone else does not belong in the product.
3. **Never clear what was not read.** No Clean result on unread terms (Outside references, image-only pages), and no "safe" verdict.
4. **A miss costs the Owner money.** Lean toward flagging, but keep Don't sign as written meaning Redline is sure.
5. **Scope is a trust test.** Version 1 adds nothing that does not make the analysis more trustworthy.

## Accessibility & Inclusion
WCAG 2.2 AA is the floor for every screen.

Document and output languages are undecided. The strongest case in the research involved Owners with limited English, whose paperwork was only in English.
