# How a statute citation is checked before it is shown

Type: grilling
Status: resolved
Blocked by: 19

## Question

Owner allowed legal points that cite a statute (ticket 19). Source sentences are checked against the stored document; what checks a statute citation? Options to raise: a fixed, owner-approved list of statute points the model may only select from (each with section text and URL), versus free citation. Until settled, no legal point is shown.

## Answer

Product owner, 2026-10-31 (asked in session). A fixed, owner-approved list of statute points: each entry holds the statute and section, its text, a URL, and when it applies. The model may only select entries from the list by id; Redline's code checks the id exists and shows the entry's own text and citation, never the model's wording of the law. Nothing outside the list is shown. The list lives with the Market standard table (ticket 28).
