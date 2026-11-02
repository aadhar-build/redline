# How the Reviewer's own Red lines are matched and what edits do to saved reviews

Type: grilling
Status: resolved
Blocked by: none

## Question

OQ16 and OQ17. How is a Red line the Reviewer writes in their own words matched against clauses? When Red lines change, are saved documents re-analysed, and does each saved review keep the list it was checked against? Gates implementation ticket 15.

## Answer

Product owner, 2026-10-31 (asked in session). OQ16: a Red line in the Reviewer's own words goes to the model with the document; each match names the Red line it matched and cites its Source sentence, checked like any flag. OQ17: each saved review keeps the exact Red line list it was checked against; when the list changes, the library marks older reviews as checked against an older list and offers a re-run. No automatic re-analysis.
