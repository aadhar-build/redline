---
version: 1
slug: "app-page-js"
primary_target: "app/page.js"
related_targets: []
---

# Landing page

## Scope and mode
- Public route `/`. Mode: Persuade.
- Built and reviewed locally only. Not deployed publicly until an API key is adopted, because v1 analysis runs only on the product owner's machine (CLAUDE.md).

## Audience and job
A Reviewer (ops manager, bookkeeper, office manager, fractional COO) about to check a negotiable vendor agreement, commercial lease or client agreement before the Owner signs it.

## What the page demonstrates
One thing: a contract turning into Risk flags grouped by Severity, each showing the exact Source sentence it came from.
- Built from a synthetic sample contract, labelled as a sample wherever a visitor could mistake it for a real one.
- Flags are grouped by Severity level and not ranked within a level (ADR 0003).

## The one action
"Try it on a document", leading to the app's sign-in and upload.

## Claims the page never makes
- A verdict on whether to sign; the words safe, fine or good to sign (ADR 0006).
- Legal advice.
- Scanned or photographed documents.
- Document types other than vendor agreements, commercial leases and client agreements; consumer, freelancer or already-signed use.
- Prices, customers, quotes or testimonials.
- Hedge words in Redline's own copy (ADR 0005). All copy goes through the humanizer skill before commit (CLAUDE.md).

## Direction
- World: Audit Workpaper, chosen by the product owner (seed 20f69d25, pick card).
- Pinned by the product owner: the findings pane takes Inspection Report's structure: numbered findings, an action stamp per Severity, a Source sentence box, and a fixed Severity key with a distinct glyph per level. It is drawn in the workpaper's inks so the page reads as one world.
- Memorable moment: a finding is ticked only once its Source sentence is found in the contract, and the tick and reference code link finding and sentence both ways.

## Unresolved
- Outside references in the demo carry no Severity (OQ1 is open); show them as not reviewed and blocking a Clean result only.
- Final copy wording is subject to the humanizer pass.
