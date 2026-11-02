# 0006. A Clean result shows what was checked

Status: Accepted, 2026-09-11

## Decision
When a review has no Don't sign as written or Negotiate flags (and no unresolved Outside reference, ADR 0007), it is a Clean result. Redline says so plainly, lists every Red line it checked, and shows any Know this items beneath. It never uses the words safe, fine or good to sign.

## Alternatives
- **Always surface the top few items so a report is never empty.** This is the crying-wolf problem: every document looks like it has something wrong with it.
- **A clean verdict such as "Looks good".** It is the claim Redline can least back up.

## Why
What it buys:
- **Flags that stay believable.** Most documents are acceptable, and a tool that always finds problems stops being believed.
- **A Clean result that is credible.** The list of checked Red lines shows the work, rather than looking like Redline did nothing.

## Consequences
- **The Owner does not get the reassuring verdict they want.**
- **Tension, recorded deliberately:** ADR 0005 sends uncertain flags to Know this, so almost every Clean result still carries Know this items; ADR 0007 blocks a Clean result while any Outside reference is unresolved, which most vendor agreements contain. Clean results will therefore be rare in practice, which undercuts the believability this decision is meant to protect.

## Addendum, 2026-11-02: a Clean result needs clauses

Decided by the product owner, after final real run 2 gave a one-page stamp certificate (S05) a Clean result. A document must contain at least one numbered or operative clause that the review checked. Otherwise it gets no Clean result and shows "This doesn't look like a contract with terms, so Redline can't call it Clean."

Redline's code decides this from the stored contract text (lib/review/has-clauses.js), never from the model, and an added document's text does not count. It fails closed. A clause is a run of at least 6 words holding a lowercase operative word: a numbered line (with the line after it) may use the wider list, such as will, may, payable or governed; an unnumbered sentence needs a binding word, such as shall, must, agrees or hereby. Text naming a stamp, a certificate or a statutory alert does not count. Input is capped at 200,000 characters and each line at 1,000.

The rule runs on fresh reviews and reruns (review) and on reopen (reopenReview), and Copy all follows the result. A contract written only in capitals, or one with no listed word, is not Clean. This is a text test: it shows a clause-shaped sentence exists, not that the document is a contract. Replay: S05 fails it; T01 to T08, S01, S03, S04 and the converted DOCX pass.
