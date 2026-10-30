# How the truth rule and the hedge-word ban apply to Counter-offer wording

Type: grilling
Status: resolved
Blocked by: none

## Question

CLAUDE.md applies 'state only what the document says' to Counter-offers, which are new wording by definition (C4), and ADR 0005 bans hedge words such as 'may', which is ordinary contract language (OQ14). Does the truth rule govern only claims about the document, with the proposed wording exempt? Does the hedge-word ban apply to the proposed wording, or only to Redline's own commentary? QUESTIONS.md batch 1 item 3. Gates implementation tickets 08 and 17.

## Answer

Product owner, 2026-10-31 (asked in session). Both rules apply to the Counter-offer wording itself: a Counter-offer may only restate or tighten terms already in the document (no new terms the document does not contain), and the hedge-word ban covers the proposed wording too, so 'may' and similar words are not allowed in it. Closes C4 and OQ14. Consequence to watch on the first real run: replacement clauses that would normally grant a permission ('Customer may terminate…') must be phrased without 'may' (for example 'Customer is entitled to…').
