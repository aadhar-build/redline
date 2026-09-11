# Redline

Redline reads a contract before it is signed and shows what to push back on. This glossary fixes the words used for the people involved and for what Redline produces.

## Language

### People

**Owner**:
The person at a small business who signs a contract and lives with its consequences.
_Avoid_: Customer, client, signer

**Reviewer**:
The person who reads a contract on the Owner's behalf before it is signed and decides what to raise. Redline's user; the Owner and the Reviewer can be different people.
_Avoid_: User, customer

**Counterparty**:
The other business named in the contract, such as a vendor, landlord or client.
_Avoid_: Other side, other party

### Findings

**Risk flag**:
A clause Redline marks as potentially harmful to the Owner. Always carries its Source sentence (see ADR 0001).
_Avoid_: Issue, warning, finding

**Source sentence**:
The exact sentence in the uploaded document that a Risk flag comes from.
_Avoid_: Citation, quote, excerpt

**Missing protection**:
A protection the document does not contain, such as no late-fee clause. Not a Risk flag, because there is no Source sentence (see ADR 0001).
_Avoid_: Missing clause, gap flag

**Counter-offer**:
Replacement wording for a flagged clause that the Reviewer can send to the Counterparty.
_Avoid_: Redline suggestion, rewrite, edit

**Red line**:
A term the business will not accept. The list of Red lines drives the analysis.
_Avoid_: Dealbreaker, requirement

**Default Red lines**:
The Red lines Redline ships with. The Reviewer can edit or remove them (see ADR 0004).
_Avoid_: Preset Red lines, template Red lines

**Outside reference**:
A sentence that brings in terms from a document that was not uploaded, such as terms at a web address, a Statement of Work, an Order Form, or terms "as amended from time to time" (see ADR 0007).
_Avoid_: Linked document, attachment

### Severity

**Severity**:
How strongly a Risk flag calls for action before signing. Always one of Don't sign as written, Negotiate or Know this (see ADR 0003).
_Avoid_: Score, risk score, rating

**Don't sign as written**:
The highest Severity. The Owner must know about the clause before signing, and it should not be accepted in its current wording.
_Avoid_: Critical, high, blocker

**Negotiate**:
The middle Severity. The Reviewer raises the clause with the Counterparty, using the Counter-offer.
_Avoid_: Medium, moderate

**Know this**:
The lowest Severity. The clause is acceptable, but the Owner should be aware of it.
_Avoid_: Low, info, FYI

**Market standard**:
The wording a Counterparty would typically offer in this kind of contract. A judgment by Redline, never something the document itself says.
_Avoid_: Industry standard, normal, typical terms

**Unusual clause**:
A clause that departs from Market standard.
_Avoid_: Non-standard clause, outlier

### Uncertainty and results

**Redline's judgment**:
The fixed label on any claim the Source sentence cannot prove, such as that a clause is an Unusual clause (see ADR 0005).
_Avoid_: Opinion, assessment, "may"

**Ambiguous clause**:
A clause whose Source sentence can reasonably be read more than one way. Redline shows the readings instead of choosing one (see ADR 0005).
_Avoid_: Unclear clause, vague clause

**Clean result**:
A review with no Don't sign as written or Negotiate flags and no unresolved Outside references. Never described as safe, fine or good to sign (see ADR 0006).
_Avoid_: Pass, all clear, approved, safe
