// The Default Red lines Redline ships with (ADR 0004, PRD.md section 5). Review takes the Reviewer's
// Red lines as an input; until the Reviewer can edit and store them (ticket 12), callers pass this list.
//
// Each Red line has a stable id, so a match never depends on its wording, which the Reviewer will be
// able to change. name and catches are what the model reads and what the Reviewer reads. basis says
// how much evidence stands behind the Red line, and is shown with it. Red line 3 covers terms that
// apply "as amended from time to time" and fee increases written into the contract
// (.scratch/spec-gaps/issues/12).
//
// Every string here is copy the Reviewer reads: run it through the humanizer skill before commit
// (CLAUDE.md), and keep it faithful to ADR 0004. Text only, with no server imports, so it is safe
// anywhere.

const deepFreeze = (list) => Object.freeze(list.map((r) => Object.freeze({ ...r, basis: Object.freeze({ ...r.basis }) })));

export const DEFAULT_RED_LINES = deepFreeze([
  {
    id: "default-personal-guarantee",
    name: "Personal guarantee",
    catches: "A clause that makes the Owner personally liable for the business's obligations.",
    basis: {
      kind: "research",
      label: "Research, qualitative only",
      note: "One law firm that handles commercial leases writes, in a blog post, that owners sign personal guarantees without fully understanding them. The research saw only a search excerpt of the post, and found no counts or percentages.",
    },
  },
  {
    id: "default-auto-renewal-or-long-term",
    name: "Auto-renewal with an exit fee, or a minimum term over 12 months",
    catches:
      "A contract that renews itself and charges the Owner to leave, or that locks the Owner in for longer than 12 months.",
    basis: {
      kind: "research",
      label: "Research",
      note: "This Red line rests on FTC complaint numbers about auto-renewal, which count consumers rather than small businesses, and on the FTC's case against First American, whose standard agreement had a three-year term and a $495 cancellation fee. The 12-month threshold is the product owner's judgment: the only term length in the research is First American's three years.",
    },
  },
  {
    id: "default-one-sided-changes",
    name: "Counterparty can change terms or prices without the Owner's consent",
    catches:
      'A clause that lets the Counterparty change the deal on its own. This includes terms that apply "as amended from time to time" and fee increases already written into the contract.',
    basis: {
      kind: "weak-research",
      label: "Research, weak",
      note: "The only figure is a statistic about consumers accepting terms of service without reading them. The research saw it secondhand, in a search excerpt, and never opened the original survey. It has no evidence that small businesses were harmed by terms changed later.",
    },
  },
  {
    id: "default-uncapped-liability",
    name: "Uncapped indemnity or liability carried by the Owner",
    catches: "A clause that makes the Owner answerable for losses with no upper limit.",
    basis: {
      kind: "owner-judgment",
      label: "No evidence: the product owner's judgment",
      note: "The research found no complaint data on indemnity or liability caps.",
    },
  },
]);
