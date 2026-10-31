// Red lines written in the Reviewer's own words, and the clause seeded in own-red-lines-01 for each
// (PRD criterion 5, ticket 15). The Owner is the Supplier. Each Red line is added to the account as
// written here, so it reaches Review with an id like "own-<row id>" and no catches or basis.
//
// The scripted model output (fixtures/model-output/own-red-lines-01.risk-flags.json) names a Red line
// by its wording ("redLineWords"), because an own Red line's id is only known once it is stored. The
// local fake adapter swaps the wording for the id it finds next to that wording in the prompt's list,
// as a model would; wording that is not on the list gives no match.

export const OWN_RED_LINES_DOCUMENT = "fixtures/contracts/own-red-lines-01.txt";

export const OWN_RED_LINE_SEEDS = [
  {
    redLine: "A customer taking more than 30 days to pay an invoice",
    sentences: ["Buyer will pay each invoice within ninety days of receiving it."],
  },
  {
    // Scripted at Negotiate, and cited across two sentences.
    redLine: "Any ban on printing for other customers",
    sentences: [
      "Supplier will not print packaging for any other grocery retailer during the term of this Agreement.",
      "This restriction continues for two years after this Agreement ends.",
    ],
  },
  {
    // Scripted at Know this.
    redLine: "The customer owning our designs or printing plates",
    sentences: ["Every design, artwork file and printing plate Supplier makes under this Agreement belongs to Buyer from the moment it is made."],
  },
  {
    redLine: "Disputes heard anywhere but Pune",
    sentences: ["Any dispute under this Agreement will be decided only by the courts at Bengaluru."],
  },
];
