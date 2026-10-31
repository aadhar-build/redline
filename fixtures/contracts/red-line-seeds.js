// The clause seeded in each fixture for each Default Red line (PRD criterion 3, ticket 06), as the
// exact sentences a matching Risk flag must show as its Source sentences. One fixture per contract
// type, plus a second vendor agreement: vendor-agreement-02 is modelled on First American's three-year
// term and $495 exit fee, and vendor-agreement-03 is an Indian-style version with the fee in rupees.
// Red lines 2 and 4 are seeded across two sentences (.scratch/spec-gaps/issues/11). Red line 3 is
// seeded as a one-sided change, terms "as amended from time to time" and a written-in escalator
// (.scratch/spec-gaps/issues/12).

export const RED_LINE_SEEDS = [
  {
    contractType: "vendor agreement",
    document: "fixtures/contracts/vendor-agreement-02.txt",
    seeds: [
      {
        redLine: "default-personal-guarantee",
        sentences: ["Henry Alvarez, who owns Merchant, personally guarantees every obligation of Merchant under this Agreement."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: ["This Agreement runs for an initial term of three years from the date Merchant signs it."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: [
          "At the end of each term, this Agreement renews automatically for a further one-year term unless Merchant gives written notice at least ninety days before the renewal date.",
          "If Merchant ends this Agreement before the end of a term for any reason, Merchant will pay Processor an early termination fee of $495.",
        ],
      },
      {
        redLine: "default-one-sided-changes",
        sentences: ["Processor can change any fee, or add a new fee, at any time by sending Merchant an email."],
      },
      {
        redLine: "default-uncapped-liability",
        sentences: [
          "Merchant will indemnify Processor against all losses, chargebacks and costs arising from Merchant's card transactions.",
          "This indemnity covers direct and indirect losses and continues after this Agreement ends.",
        ],
      },
    ],
  },
  {
    contractType: "vendor agreement",
    document: "fixtures/contracts/vendor-agreement-03.txt",
    seeds: [
      {
        redLine: "default-personal-guarantee",
        sentences: ["Meera Kulkarni, a partner of Merchant, personally guarantees the payment of every amount Merchant owes under this Agreement."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: ["The minimum term of this Agreement is three years from the date the card machine is installed."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: [
          "After the minimum term, this Agreement renews automatically for successive periods of one year unless Merchant gives written notice at least sixty days before a renewal date.",
          "If Merchant ends this Agreement before the end of the minimum term or of any renewal period, Merchant will pay Provider an exit fee of Rs. 42,000.",
        ],
      },
      {
        redLine: "default-one-sided-changes",
        sentences: ["Merchant will pay a fee of 1.8% of each card sale and a machine rental of Rs. 450 a month, both as amended from time to time by Provider."],
      },
      {
        redLine: "default-uncapped-liability",
        sentences: [
          "Merchant will indemnify Provider against all claims, penalties and losses arising from any card transaction at Merchant's shop.",
          "Merchant's liability under this clause is not limited to the charges paid under this Agreement.",
        ],
      },
    ],
  },
  {
    contractType: "commercial lease",
    document: "fixtures/contracts/commercial-lease-01.txt",
    seeds: [
      {
        redLine: "default-personal-guarantee",
        sentences: ["Anil Joshi, the managing director of Tenant, personally guarantees the payment of rent and every other obligation of Tenant under this Lease."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: [
          "This Lease runs for three years from 1 December 2026 and then renews automatically for further terms of three years unless Tenant gives written notice at least six months before the end of a term.",
          "If Tenant vacates the Premises before the end of a term, Tenant will pay Landlord an exit fee equal to six months' rent.",
        ],
      },
      {
        redLine: "default-one-sided-changes",
        sentences: ["The rent increases by 15% on each anniversary of the start date."],
      },
      {
        redLine: "default-uncapped-liability",
        sentences: [
          "Tenant will indemnify Landlord against all claims, losses and costs arising from Tenant's use of the Premises.",
          "This indemnity applies whether or not the loss was foreseeable and continues after this Lease ends.",
        ],
      },
    ],
  },
  {
    contractType: "client agreement",
    document: "fixtures/contracts/client-agreement-01.txt",
    seeds: [
      {
        redLine: "default-personal-guarantee",
        sentences: ["Dana Whitfield, the sole member of Agency, personally guarantees the performance of every obligation of Agency under this Agreement."],
      },
      {
        redLine: "default-auto-renewal-or-long-term",
        sentences: [
          "This Agreement runs for twenty-four months from December 1, 2026 and renews automatically for further twelve-month terms unless Agency gives written notice at least ninety days before the end of a term.",
          "If Agency ends this Agreement before the end of a term, Agency will pay Client a termination fee of $10,000.",
        ],
      },
      {
        redLine: "default-one-sided-changes",
        sentences: ["Client can change the scope of the services, the fees or any other term of this Agreement by sending Agency written notice, and the change takes effect fifteen days after the notice."],
      },
      {
        redLine: "default-uncapped-liability",
        sentences: [
          "Agency will indemnify Client against all losses, damages and costs arising from the services or from any claim connected with them.",
          "Agency's obligation under this clause includes lost profits and indirect losses.",
        ],
      },
    ],
  },
];
