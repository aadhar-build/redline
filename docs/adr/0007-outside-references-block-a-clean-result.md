# 0007. Outside references block a Clean result

Status: Accepted, 2026-09-11

## Decision
Every Outside reference becomes a Risk flag, with the referencing sentence as its Source sentence, so ADR 0001 is satisfied. A document with an unresolved Outside reference cannot get a Clean result (ADR 0006) until the Reviewer uploads the referenced document or explicitly marks the reference as reviewed.

## Alternatives
- **Review only the uploaded text and add a general note** that referenced documents were not reviewed.

## Why
What it buys:
- **Redline does not clear terms it never saw.** In business contracts the harmful terms often live in the referenced document: master terms, order forms, statements of work. Without this, Redline would give a Clean result on a contract whose dangerous terms it never read.
- **Default Red line 3 in another form.** "As amended from time to time" lets the Counterparty change terms without the Owner's consent (ADR 0004).

## Consequences
- **Many vendor agreements will show as incomplete** until the Reviewer finds a web page that may already have changed. Some Reviewers will leave.
- **Redline cannot fetch referenced documents itself.** Files are parsed in the browser and only uploaded text is stored (CLAUDE.md).
- **A reference marked as reviewed is the Reviewer's statement,** not something Redline verified.
- **Origin.** This was raised by the assistant as a blind spot the product owner had not considered.
