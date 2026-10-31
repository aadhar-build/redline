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

## Addendum (2026-10-31, Fable advisor, QUESTIONS.md 27 and 30)
- **A statute "as amended" is no Red line 3 match (27).** When the words just before the phrase are an Act, Rules, Regulations, Code or Ordinance with its year (bare, in brackets or "of YYYY"), an optional bracketed alias and an optional comma, Parliament amends the terms, not the Counterparty. The rule fails closed (security review, 2026-10-31): the sentence stays an Outside reference, of kind "other" at Negotiate, so it blocks a Clean result until the Reviewer marks it; it only loses the Red line 3 match. The exemption never applies when the name before the keyword has a possessive ("'s") or a party term: any party the document names, or Provider, Supplier, Vendor, Company, Licensor, Lessor, Customer or Client. So a Counterparty's own "Service Code, 2024" stays a Red line 3 match. The rule applies to every "as amended" wording.
- **One Outside reference per referenced document (30).** Matches are grouped by the document they name, in order of first appearance: a web address by host and path (no scheme, no "www.", host in lower case, trailing "/" and punctuation trimmed); every Statement of Work as one; every Order Form as one; a schedule by its word and label. An "as amended" sentence joins the document it names and makes that group a Red line 3 match; one naming no document, and each one the model adds, stands alone. Each group lists all its Source sentences in document order, its title gives the count, and one Reviewer mark covers the whole group. Stored as {kinds, label, source_sentences[], reviewed, reviewed_at} (migration 20261031003100). On reopen a group keeps its mark while at least one of its sentences still passes the Source sentence check, and lists only those that pass.
