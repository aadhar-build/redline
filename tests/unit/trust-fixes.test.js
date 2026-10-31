// Ticket 22: trust fixes from the first real runs, rulings C, D and E, through the Review seam.
// (Ruling B is tested with the Source sentence check in source-check.test.js; its prompt line here.)
import { describe, expect, it } from "vitest";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { review, ReviewInputError, TEMPLATE_PROMPT_LINE } from "../../lib/review/review.js";
import { reopenReview, toStoredReview, WITHHELD_REASONS } from "../../lib/review/saved.js";
import { documentNumbers, findUnsupportedNumbers, looksLikeTemplate, numberKey } from "../../lib/review/wording.js";

const LEASE = [
  "LEAVE AND LICENCE AGREEMENT",
  "This Agreement is made between the Licensor and the Licensee for the office at Plot 12.",
  "1. The Licensee shall pay a licence fee of Rs. 1,500.00 per month to the Licensor.",
  "2. The licence runs for a period of eleven months from the date of this Agreement.",
  "16.2 The Licensor may terminate this Agreement if the Licensee fails to pay the fee for two months.",
  "17. The Licensee shall indemnify the Licensor against all claims arising from the use of the office.",
].join("\n");

const TEMPLATE = `${LEASE}\nSigned by the Licensor ______________ on the ____ day of ________, 20__.`;

const flag = (over = {}) => ({
  severity: "negotiate",
  title: "Uncapped indemnity",
  says: "The Licensee indemnifies the Licensor against all claims arising from the use of the office.",
  judgment: "No cap on the indemnity appears in the document.",
  sourceSentences: ["The Licensee shall indemnify the Licensor against all claims arising from the use of the office."],
  redLine: null,
  ...over,
});

function adapterFor(reply, prompts = []) {
  return createFakeAdapter({
    responses: [
      (prompt) => {
        prompts.push(prompt);
        return JSON.stringify(reply);
      },
    ],
  });
}

async function run(reply, { documentText = LEASE, ownerParty = null } = {}) {
  const prompts = [];
  const result = await review({ documentText, redLines: [], adapter: adapterFor(reply, prompts), ownerParty });
  return { result, prompt: prompts[0] };
}

const base = (over = {}) => ({
  ownerParty: "the Licensee",
  parties: ["the Licensor", "the Licensee"],
  summary: "The Licensee pays a licence fee of Rs. 1,500.00 per month.",
  riskFlags: [flag()],
  ...over,
});

describe("Ruling B: the prompt asks for the clause number", () => {
  it("tells the model to begin each quote at the clause number or bullet", async () => {
    const { prompt } = await run(base());
    expect(prompt).toContain("Begin each one at the clause number or bullet that opens its line");
  });
});

describe("Ruling C(a): templates", () => {
  it("adds the fixed template line to the prompt and reports a template when the document has blanks", async () => {
    const { result, prompt } = await run(base(), { documentText: TEMPLATE });
    expect(result.template).toBe(true);
    expect(prompt).toContain(TEMPLATE_PROMPT_LINE);
  });

  it("does neither for a document without blanks", async () => {
    const { result, prompt } = await run(base());
    expect(result.template).toBe(false);
    expect(prompt).not.toContain(TEMPLATE_PROMPT_LINE);
  });

  it("tells the model never to call a form signed and to bring in no outside facts", async () => {
    const { prompt } = await run(base());
    expect(prompt).toContain("Never say it is signed, executed or dated.");
    expect(prompt).toContain("Bring in no facts from outside it");
    expect(prompt).toContain("Write every number exactly as the document writes it");
  });

  it.each([
    ["underscores", "Name: ________"],
    ["dots", "dated .................."],
    ["spaced dots", "the sum of Rs. . . . . ."],
    ["ellipsis characters", "Shri …………"],
    ["a black circle placeholder", "unit [●] in the tower"],
    ["a bullet placeholder", "unit [•] in the tower"],
    ["an empty bracket", "Schedule [__]"],
    ["a named placeholder", "[Name of the Licensee]"],
  ])("detects %s", (_, text) => {
    expect(looksLikeTemplate(`The Licensee shall pay. ${text}`)).toBe(true);
  });

  it.each([
    ["ordinary prose", "The Licensee shall pay the fee on 1 May 2027."],
    ["two dots", "See clause 3.. Then pay."],
    ["a defined bracket", "the Premises [as defined in Schedule 1]"],
    ["two underscores", "file_name__x"],
  ])("does not detect %s", (_, text) => {
    expect(looksLikeTemplate(text)).toBe(false);
  });
});

describe("Ruling C(b): numbers", () => {
  it("withholds a flag whose 'says' has a number the document does not contain", async () => {
    const { result } = await run(base({ riskFlags: [flag({ says: "The Licensee indemnifies the Licensor for 30 days." })] }));
    expect(result.riskFlags).toHaveLength(0);
    expect(result.withheld).toEqual([{ reason: "unsupported-number" }]);
    expect(result.withheldCount).toBe(1);
  });

  it("shows a flag whose numbers the document contains, with or without commas and decimals", async () => {
    const says = "The Licensee pays Rs. 1500 a month; clause 16.2 lets the Licensor end it after 2 months.";
    const { result } = await run(base({ riskFlags: [flag({ says })] }));
    expect(result.riskFlags).toHaveLength(1);
  });

  it("does not treat a clause reference as an amount", async () => {
    const { result } = await run(base({ riskFlags: [flag({ says: "Clause 16.2.5 lets the Licensor end the licence." })] }));
    expect(result.withheld).toEqual([{ reason: "unsupported-number" }]);
  });

  it("checks the Source sentences first", async () => {
    const { result } = await run(base({ riskFlags: [flag({ says: "It lasts 99 years.", sourceSentences: ["Not in the document."] })] }));
    expect(result.withheld).toEqual([{ reason: "source-not-found" }]);
  });

  it("marks, but shows, a number in the summary or a judgment that the document does not contain", async () => {
    const { result } = await run(
      base({
        summary: "The Licensee pays Rs. 1,500.00 a month for 11 months.",
        riskFlags: [flag({ judgment: "The Licensee carries the claims for 36 months." })],
      }),
    );
    const at = (s, n) => ({ phrase: n, kind: "number", start: s.indexOf(n), end: s.indexOf(n) + n.length });
    expect(result.summary.marked).toEqual([at(result.summary.text, "11")]);
    expect(result.riskFlags[0].judgment.marked).toEqual([at(result.riskFlags[0].judgment.text, "36")]);
  });

  it("keys numbers by digits, so 1,500.00 and 1500 match and 16.2.5 stays itself", () => {
    expect(numberKey("1,500.00")).toBe(numberKey("1500"));
    expect(numberKey("1,50,000")).toBe("150000");
    expect(numberKey("16.2.5")).toBe("16.2.5");
    expect(findUnsupportedNumbers("Pay $1,500, then 3%.", documentNumbers("1500.00 and 3"))).toEqual([]);
  });
});

describe("Ruling D: no typical or usual claims", () => {
  it("drops a judgment that says what is standard, keeps the flag and counts the drop", async () => {
    const { result } = await run(base({ riskFlags: [flag({ judgment: "A landlord typically caps this indemnity." })] }));
    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0].judgment).toBeNull();
    expect(result.riskFlags[0].sourceSentences).toHaveLength(1);
    expect(result.judgmentsDropped).toBe(1);
  });

  it("keeps a judgment about what the clause does or what is missing", async () => {
    const { result } = await run(base());
    expect(result.riskFlags[0].judgment.text).toBe("No cap on the indemnity appears in the document.");
    expect(result.judgmentsDropped).toBe(0);
  });

  it("no longer asks the model for claims that a clause is unusual", async () => {
    const { prompt } = await run(base());
    expect(prompt).not.toContain("such as that the clause is unusual");
    expect(prompt).toContain("Never say a term is market, standard, customary, usual, typical, common or one-sided.");
  });
});

describe("Ruling E: the Owner's side", () => {
  it("shows the Owner and the parties the model names, when the document uses those terms", async () => {
    const { result, prompt } = await run(base());
    expect(result.ownerParty).toEqual({ term: "the Licensee", fixed: false });
    expect(result.parties).toEqual(["the Licensor", "the Licensee"]);
    expect(prompt).toContain('Give "ownerParty"');
  });

  it("drops an Owner or party the document never names", async () => {
    const { result } = await run(base({ ownerParty: "the Tenant", parties: ["the Landlord", "the Licensee", 7] }));
    expect(result.ownerParty).toBeNull();
    expect(result.parties).toEqual(["the Licensee"]);
  });

  it("fixes the Owner in the prompt when the Reviewer changes it", async () => {
    const { result, prompt } = await run(base({ ownerParty: "the Licensee" }), { ownerParty: "the Licensor" });
    expect(prompt).toContain("The Owner is the Licensor.");
    expect(result.ownerParty).toEqual({ term: "the Licensor", fixed: true });
  });

  it("refuses a fixed Owner the document does not name, before calling the model", async () => {
    const adapter = createFakeAdapter({ responses: [] });
    await expect(review({ documentText: LEASE, redLines: [], adapter, ownerParty: "the Tenant" })).rejects.toMatchObject({
      code: "bad-owner-party",
    });
    await expect(review({ documentText: LEASE, redLines: [], adapter, ownerParty: "x".repeat(200) })).rejects.toBeInstanceOf(
      ReviewInputError,
    );
  });
});

describe("A reply wrapped in a code fence (seen in a ticket 22 real run)", () => {
  const fenced = (body) => createFakeAdapter({ responses: [body] });
  it("reads a reply that is one JSON code fence and nothing else", async () => {
    const body = "```json\n" + JSON.stringify(base()) + "\n```";
    const result = await review({ documentText: LEASE, redLines: [], adapter: fenced(body) });
    expect(result.summary.status).toBe("shown");
    expect(result.riskFlagsStatus).toBe("checked");
  });

  it.each([
    ["text before the fence", "Here is the review:\n```json\n" + JSON.stringify(base()) + "\n```"],
    ["text after the fence", "```json\n" + JSON.stringify(base()) + "\n```\nDone."],
  ])("still treats %s as unreadable", async (_, body) => {
    const result = await review({ documentText: LEASE, redLines: [], adapter: fenced(body) });
    expect(result.summary.status).toBe("withheld");
    expect(result.riskFlagsStatus).toBe("unreadable-output");
  });
});

describe("A saved review reopens with the same checks", () => {
  it("stores unsupported-number as a reason code", async () => {
    expect(WITHHELD_REASONS).toContain("unsupported-number");
    const { result } = await run(base({ riskFlags: [flag(), flag({ says: "It lasts 99 years." })] }));
    expect(toStoredReview(result).withheld).toEqual([{ reason: "unsupported-number" }]);
  });

  it("withholds, marks and drops on reopen as a fresh review does", () => {
    const stored = {
      summary: "The Licensee pays for 11 months.",
      red_lines: [],
      withheld: [],
      withheld_count: 0,
      flags: [
        { severity: "negotiate", title: "A", says: "It lasts 99 years.", judgment: null, source_sentences: [flag().sourceSentences[0]], red_line: null },
        { severity: "negotiate", title: "B", says: flag().says, judgment: "This is a standard term.", source_sentences: [flag().sourceSentences[0]], red_line: null },
      ],
    };
    const reopened = reopenReview({ documentText: LEASE, stored });
    expect(reopened.withheld).toEqual([{ reason: "unsupported-number" }]);
    expect(reopened.riskFlags).toHaveLength(1);
    expect(reopened.riskFlags[0].judgment).toBeNull();
    expect(reopened.summary.marked.map((m) => m.phrase)).toEqual(["11"]);
    expect(reopened.template).toBe(false);
  });
});
