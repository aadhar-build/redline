# What Market standard is based on and how the contract type is decided

Type: grilling
Status: resolved
Blocked by: 18, 25

## Question

OQ6 and OQ7. What basis does Redline use for Market standard per contract type, how does it decide which of the three types a document is, and what happens when it is none of them? Implementation ticket 09 explicitly gives the model no basis until this is settled.

## Answer

Product owner, 2026-10-31 (asked in session). OQ6: Market standard for Indian English-language contracts is a curated, dated reference table per contract type and clause type, each row citing its source and date (GeM general terms, MSMED Act, Maharashtra leave-and-licence format, broker reports where marked as such). A severity claim outside the table is labelled Redline's judgment. Legal points: Redline may state a legal point only when it cites the statute (for example Indian Contract Act s.27 on non-competes, MSMED Act 45-day payment). OQ7: the model proposes the contract type before analysis and the Reviewer confirms or changes it; 'none of these' runs the Red lines only, with no Market-standard severity, and says so. The table itself is ticket 28; statute citations need their own check, ticket 29. Research: [18](../research/18-market-standard-sources.md), [25](../research/25-india-market-standard-sources.md).
