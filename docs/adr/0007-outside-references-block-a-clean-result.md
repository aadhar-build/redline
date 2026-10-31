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

## Addendum (2026-10-31, Fable advisor, QUESTIONS.md 36 and 37)
- **References inside an added document (36).** They are Outside references like the contract's own: found and checked against the text they sit in, with the same severity rules, and listed after the contract's, each saying which added document it is in. The Reviewer can mark one or add its document; that document is keyed R2, R3 and so on, and the chain is bounded by the 200,000-character cap shared by all the texts. A mark is stored with the id of the text it sits in, so the same sentence in the contract and in an added document are two references. A Clean result needs every reference resolved. Stored as referenced_documents.in_referenced_document_id, with a foreign key on (in_referenced_document_id, owner_id) that cascades on delete (migration 20261031003800).
- **Removing an added document (37).** Only on the latest review, and fail closed: the contract is reviewed again with the remaining documents; if that fails or is incomplete nothing is deleted; otherwise the row (and any document added inside it) is deleted and the new review saved. Replacing is Remove, then Add; a second Add on the same reference is still refused. Earlier reviews keep listing the removed id, and their flags from it reopen withheld as "referenced-document-removed" (migration 20261031003700).


## Addendum (2026-10-31, ticket 14c: two real-run bugs)
- **Government verification addresses (bug 2).** The web address printed on an e-stamp certificate is how the certificate is checked, not a document the terms come from. A web address is not an Outside reference when its host is shcilestamp.com or a subdomain of it, or when one of its host labels starts "igrs" or "egras" and the host ends in .gov.in or .nic.in (state IGRS registration and eGRAS receipt portals, such as igrs.telangana.gov.in, igrsup.gov.in, egras.raj.nic.in, egrashry.nic.in). Those suffixes are issued only to government bodies. The host is parsed strictly: cut at the first "/", "?", "#", "\\" or "@", letters, digits, "." and "-" only, so "shcilestamp.com@evil.com" or "evil.com\\shcilestamp.com" never qualifies; an address whose path, query or fragment carries another domain is raised whole; and a bare domain is judged on its own host, never on the address it sits inside. The IGRS and eGRAS rule is by suffix and name, not checked site by site. The list is fixed in lib/review/outside-references.js; every other web address is still raised, so the change fails closed.
- **"for the time being in force" (bug 3).** Added to the "as amended" wordings of QUESTIONS.md 28. The QUESTIONS.md 27 statute rule applies unchanged: right after an Act, Rules, Regulations, Code or Ordinance with its year it is a Negotiate reference with no Red line 3 match; otherwise ("the rules for the time being in force of the Provider", or an Act with no year) it matches Default Red line 3.

## Addendum (2026-10-31, Fable advisor, QUESTIONS.md 43 and 44)

- **General law and undated Acts (QUESTIONS.md 44).** This replaces the ticket 14c addendum's clause that an Act with no year matches Default Red line 3. A general-law phrase just before any "as amended" or "current version" wording ("any law", "any other law", "all applicable laws, rules and regulations", "applicable laws of India", with only a fixed list of modifiers and tails) loses the Red line 3 match, as a dated statute does. So does an Act named without a year, when at least one capitalised name word comes before "Act" ("the Act" alone does not count). Undated Rules, Regulations, Code and Ordinance keep the match. Both fail closed: a possessive or a party term in the name keeps the match, and the phrase is still an Outside reference of kind "other" at Negotiate that blocks a Clean result until marked. A dated statute may now be followed by "and the rules made thereunder". A stored "as amended" row for such a sentence reopens as the one "other" reference, with its mark.
- **An added document's own title line (QUESTIONS.md 43).** In an added text, a heading line naming the kind the text was added against (Order Form, or Statement of Work or SOW) counts as present, and every mention of that kind in that text is skipped. It never applies in the contract, never across added texts, and never to a kind the text was not added against. Web addresses, schedules and "as amended" are unchanged. A stored row for the old heading reference keeps its mark on reopen; a new review drops it, since only marks travel (QUESTIONS.md 38).

