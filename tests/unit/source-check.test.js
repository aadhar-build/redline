import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalise } from "../../lib/review/normalise.js";
import { _normaliseWithMap, checkSource, checkSources } from "../../lib/review/source-check.js";

const root = path.resolve(__dirname, "../..");
const vendor = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");

const found = (doc, quote) => checkSource(doc, quote).found;

describe("Source sentence check: the offset map", () => {
  const samples = [
    vendor,
    "  Lead\u00A0in\u200B text.\n\nSecond\u00ADline \u201Cquoted\u201D \u2014 and \uFB01nal\u2026  ",
    "\uFEFF\u2003Tabs\tand\r\nCRLF\u2028lines.\u3000",
    "Cafe\u0301 au lait. Ligature \uFB03 and \uFB06.",
    "",
    "   ",
  ];

  it("reproduces normalise() exactly", () => {
    for (const s of samples) expect(_normaliseWithMap(s).text).toBe(normalise(s));
  });

  it("maps every normalised character back into the stored text", () => {
    for (const s of samples) {
      const m = _normaliseWithMap(s);
      for (let i = 0; i < m.text.length; i++) {
        const original = m.stored.slice(m.from[i], m.to[i]);
        expect(normalise(original) || " ").toContain(m.text[i] === " " ? " " : m.text[i]);
      }
    }
  });
});

describe("Source sentence check: what passes", () => {
  it("finds a whole sentence from the fixture and returns the stored span", () => {
    const quote = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";
    const result = checkSource(vendor, quote);
    expect(result).toMatchObject({ found: true, text: quote });
    expect(vendor.slice(result.start, result.end)).toBe(quote);
  });

  it("finds two whole sentences quoted together", () => {
    const quote =
      "Vendor will send an invoice on the first day of each month. Customer will pay each invoice within seven days of the invoice date.";
    expect(found(vendor, quote)).toBe(true);
  });

  it("finds the first sentence after a heading that has no full stop", () => {
    const doc = "LEASE\n\nThe tenant pays rent on the first day of each month.";
    expect(found(doc, "The tenant pays rent on the first day of each month.")).toBe(true);
  });

  it("shows the stored curly quotes, dashes and line breaks, not the model's straight version", () => {
    const doc = "Intro. The \u201CPremises\u201D means Shop 4\u2014Aundh Road,\nPune. End.";
    const result = checkSource(doc, 'The "Premises" means Shop 4-Aundh Road, Pune.');
    expect(result).toMatchObject({ found: true, text: "The \u201CPremises\u201D means Shop 4\u2014Aundh Road,\nPune." });
  });

  it("ignores no-break spaces, zero-width characters and soft hyphens on either side", () => {
    const doc = "First. Fees\u00A0are\u200B due on\u00ADtime. Last.";
    expect(found(doc, "Fees are due ontime.")).toBe(true);
  });

  it("matches the fi ligature against its letters", () => {
    expect(found("Start. The \uFB01nal invoice is due. End.", "The final invoice is due.")).toBe(true);
  });

  it("accepts a sentence that ends in a closing quote", () => {
    const doc = 'Vendor said "the fee is fixed." Customer agreed.';
    expect(found(doc, 'Vendor said "the fee is fixed."')).toBe(true);
  });
});

describe("Source sentence check: what fails (research 09, section 7)", () => {
  const cases = [
    ["a number changed", "Customer will pay each invoice within seventeen days of the invoice date."],
    ["30 changed to 60 style digit change", "Customer will pay interest at 4% per month on any amount not paid on time."],
    ["shall changed to may", "Vendor may supply its own cleaning materials and equipment."],
    ["not dropped", "Vendor's total liability under this Agreement will exceed one month's fee."],
    ["a defined term's case changed", "customer will pay Vendor Rs. 18,000 per month, plus GST."],
    ["the trailing qualifier dropped", "It renews automatically for further two-year terms"],
    ["the trailing qualifier dropped, with a full stop added", "It renews automatically for further two-year terms."],
    [
      "two clauses spliced with an ellipsis",
      "This Agreement starts on 1 December 2026 ... unless Customer gives written notice at least ninety days before the end of a term.",
    ],
    ["an ellipsis character", "Customer will pay Vendor Rs. 18,000 per month\u2026"],
    ["an invented sentence", "Customer may terminate this Agreement at any time without paying a fee."],
    ["the start of a sentence dropped", "will pay Vendor Rs. 18,000 per month, plus GST."],
    ["a sentence cut after an abbreviation", "18,000 per month, plus GST."],
    ["a quote ending on an abbreviation", "Customer will pay Vendor Rs."],
    ["an empty quote", "   "],
  ];

  for (const [name, quote] of cases) {
    it(`fails: ${name}`, () => {
      expect(checkSource(vendor, quote).found).toBe(false);
    });
  }

  it("fails on a quote that is not text", () => {
    expect(checkSource(vendor, 42)).toEqual({ found: false, reason: "not-text" });
  });

  it("does not treat a single line break as a sentence boundary", () => {
    const doc = "Customer will\nnot pay any fee for leaving early.";
    expect(found(doc, "not pay any fee for leaving early.")).toBe(false);
    expect(found(doc, "Customer will not pay any fee for leaving early.")).toBe(true);
  });
});

describe("checkSources", () => {
  const good = "Customer will pay Vendor Rs. 18,000 per month, plus GST.";

  it("does not treat a full stop after a common contract abbreviation as a boundary", () => {
    const doc = "Start. Interest runs at 18% p.a. Interest is payable w.e.f. 1 April 2027 under Cl. 4 and Sch. 2. End.";
    for (const quote of ["Interest is payable w.e.f.", "1 April 2027 under Cl. 4 and Sch. 2.", "4 and Sch. 2.", "2."]) {
      expect(found(doc, quote)).toBe(false);
    }
  });

  it("returns the stored spans when every quote passes", () => {
    const result = checkSources(vendor, [good]);
    expect(result.found).toBe(true);
    expect(result.sources[0].text).toBe(good);
  });

  it("fails when any one quote fails, or when there are none", () => {
    expect(checkSources(vendor, [good, "An invented sentence."]).found).toBe(false);
    expect(checkSources(vendor, []).found).toBe(false);
    expect(checkSources(vendor, undefined).found).toBe(false);
  });
});
