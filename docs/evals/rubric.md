# Redline eval rubric (DRAFT, 2026-11-19, for the product owner to approve)

Each metric maps to a promise in CLAUDE.md or an ADR. "Gate" means the release to an API key waits until the metric meets its target. Targets are proposals.

Data never enters the repo. Contracts, gold labels and raw outputs live in `~/redline-samples/evals/`. Only aggregate counts and scores are committed.

## Datasets
- **G: the Indian gold set.** 30–50 Indian small-business contracts (the T and S samples, public templates, edited variants), each labelled by the product owner using the format below. This is the release gate.
- **C: a CUAD sample.** 50 contracts first, chosen across agreement types. CUAD's 41 labels are mapped to Redline's concerns (table below). It measures recall of risky clauses, but it does not measure Indian severity, because CUAD has no severity labels.
- **N: ContractNLI**, used only for question-box refusals, after its license is checked.

## A. Trust rules (hard gates: any miss is a bug)
| # | Metric | How it is scored | Target |
|---|---|---|---|
| A1 | Shown flags with a verified source | Every shown flag's sentence passes the ADR 0010 check against the stored text | 100% |
| A2 | No false Clean | A Clean result on a document whose gold set has any flag at Negotiate or higher, or on a non-contract | 0 |
| A3 | Counter-offers that add a term | A judge (Claude, then a person spot-checks 20%) marks each Counter-offer restate, tighten or adds-term | adds-term ≤ 2% |
| A4 | Hedge words | Banned-word scan of the summary, flags, Counter-offers and answers | 0 |
| A5 | Unsupported summary claims | A judge marks each summary sentence supported or not by the document | ≥ 98% supported |
| A6 | Question box out of scope | Questions whose answer isn't in the document get the "not in the document" reply | ≥ 95% |

## B. Detection quality
| # | Metric | How it is scored | Target |
|---|---|---|---|
| B1 | Recall | Gold risky clauses that get a shown flag citing an overlapping sentence | G ≥ 85%, C ≥ 75% |
| B2 | Precision | Shown flags a person marks as a real concern | ≥ 80% |
| B3 | Red line recall | Gold clauses matching one of the 4 default Red lines, flagged Don't sign as written | ≥ 95% |
| B4 | Severity agreement | Shown flags with the gold severity; exact, and within one level | exact ≥ 70%, within one ≥ 95% |
| B5 | Withheld rate | Withheld flags / all flags the model returned | ≤ 10% (now about 25%) |
| B6 | Citation precision | The cited sentence covers the gold clause span without extra clauses | ≥ 90% |

## C. Answers and outside references
| # | Metric | Target |
|---|---|---|
| C1 | Answerable questions answered correctly with a verified source | ≥ 90% |
| C2 | Outside references found (Order Form, SOW, web address, schedules, "as amended") | recall ≥ 90% |
| C3 | Correct Clean on gold-Clean documents | ≥ 80% (it is fine to lean toward not Clean) |

## D. Operations (reported, not gated)
Run time per document, failures and timeouts, withheld reasons, and run-to-run stability: the same document run 3 times, flag set Jaccard ≥ 0.8.

## Gold label format (one JSON per document)
```json
{
  "id": "G07", "type": "vendor-agreement", "clean": false,
  "flags": [{"clause": "exact sentence(s)", "severity": "dont-sign-as-written",
             "redLine": "personal-guarantee", "why": "one line"}],
  "outsideReferences": [{"kind": "order-form", "sentence": "..."}],
  "questions": [{"q": "What is the notice period?", "answer": "30 days", "source": "..."},
                {"q": "What is the GST rate?", "answer": null}]
}
```

## CUAD label mapping (recall only)
- Uncapped liability, Cap on liability → Red line 4
- Renewal term, Notice period to terminate renewal, Minimum commitment → Red line 2
- Termination for convenience (counterparty), Non-compete, Exclusivity, IP ownership assignment, Liquidated damages, Anti-assignment, Change of control, Audit rights, Most favoured nation, Covenant not to sue → expected flag at any severity
- The other labels (parties, dates, governing law) → ignored

## Process
1. Score the baseline on G and C before any change.
2. Change one thing at a time (prompt, matching, severity table) and rerun. Keep a change only if no A metric drops and the B metric it targets improves.
3. Release to an API key once every A target and B1–B4 are met on G for two runs in a row. That decision is the product owner's.
