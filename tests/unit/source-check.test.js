import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalise } from "../../lib/review/normalise.js";
import { _normaliseWithMap, checkSource, checkSources } from "../../lib/review/source-check.js";
import {
  DOCX_SHAPED_01,
  DOCX_SHAPED_01_FOUND,
  DOCX_SHAPED_01_WITHHELD,
  PDF_SHAPED_01,
  PDF_SHAPED_01_FOUND,
  PDF_SHAPED_01_WITHHELD,
} from "../../fixtures/contracts/extracted-shapes-01.js";
import {
  PASTED_LEASE_01,
  PASTED_LEASE_01_ALTERED,
  PASTED_LEASE_01_FOUND,
} from "../../fixtures/contracts/pasted-lease-01.js";

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

describe("Source sentence check: sentence boundaries (ADR 0010 addendum, ticket 14)", () => {
  const notice = "Either party may terminate this Agreement on 30 days' notice.";
  const cases = [
    ["1, a single line break after a numbered heading", `12.3 Termination\n${notice}`, notice, true],
    ["2, a single line break after a capitals heading", `TERMINATION AND RENEWAL\n${notice}`, notice, true],
    [
      "3, a wrapped line that ends mid-sentence",
      "The Consultant shall not, without the prior written consent of the\nCompany, engage any subcontractor.",
      "Company, engage any subcontractor.",
      false,
    ],
    [
      "4, a sub-item cut from its lead-in",
      "The Consultant shall:\n(a) deliver the reports; and\n(b) keep the Company's information confidential.",
      "(b) keep the Company's information confidential.",
      false,
    ],
    [
      "5, a qualifier cut off by a line break",
      "Payments are due within 30 days unless the Company\ndisputes the invoice in writing.",
      "disputes the invoice in writing.",
      false,
    ],
    [
      "6, a title-case line passes as a heading (accepted cost)",
      "Sharma Infrastructure Private\nLimited shall pay the fee.",
      "Limited shall pay the fee.",
      true,
    ],
    [
      "7, Pvt. and Ltd.",
      "ABC Pvt. Ltd. shall indemnify the Company against all claims.",
      "shall indemnify the Company against all claims.",
      false,
    ],
    ["8, etc.", "The Consultant shall deliver reports, invoices, etc. within 7 days.", "within 7 days.", false],
    [
      "9, an initial before a number",
      "This Agreement is governed by S. 27 of the Indian Contract Act, 1872.",
      "27 of the Indian Contract Act, 1872.",
      false,
    ],
    [
      "10, after the second of two initials",
      "Notices shall be sent to A. K. Sharma at the registered office.",
      "Sharma at the registered office.",
      false,
    ],
    [
      "10, after the first of two initials",
      "Notices shall be sent to A. K. Sharma at the registered office.",
      "K. Sharma at the registered office.",
      false,
    ],
    [
      "11, a capital letter that ends a sentence",
      "The fee is set out in Schedule A. The Company shall pay within 30 days.",
      "The Company shall pay within 30 days.",
      true,
    ],
    ["12, after a decimal point", "The Consultant shall be paid Rs. 1,50,000.00 on signing.", "00 on signing.", false],
    [
      "12, the whole sentence",
      "The Consultant shall be paid Rs. 1,50,000.00 on signing.",
      "The Consultant shall be paid Rs. 1,50,000.00 on signing.",
      true,
    ],
  ];

  for (const [name, doc, quote, expected] of cases) {
    it(`case ${name}: ${expected ? "found" : "not found"}`, () => {
      expect(found(doc, quote)).toBe(expected);
    });
  }

  describe("heading lines must start on a boundary and be followed by a capital (QUESTIONS 11)", () => {
    const headingCases = [
      [
        "1, a title-case line inside a wrapped sentence cannot end a quote",
        "The Supplier shall be liable to\nKestrel Analytics Private\nLimited unless the claim is fraudulent.",
        "The Supplier shall be liable to Kestrel Analytics Private",
        false,
      ],
      [
        "1, the full sentence",
        "The Supplier shall be liable to\nKestrel Analytics Private\nLimited unless the claim is fraudulent.",
        "The Supplier shall be liable to Kestrel Analytics Private Limited unless the claim is fraudulent.",
        true,
      ],
      [
        "2, a page footer inside a sentence",
        "The Supplier shall notify the Customer within\nPage 2 of 6\nthree months before the claim.",
        "three months before the claim.",
        false,
      ],
      [
        "3, a page footer between sentences",
        "The Supplier shall indemnify the Customer.\nPage 2 of 6\nThe Customer shall pay within 30 days.",
        "The Customer shall pay within 30 days.",
        true,
      ],
      [
        "4, a heading after a number line",
        "Services were performed.\n\n12.\nLimitation of Liability\nThe Supplier's liability is capped at the fees paid.",
        "The Supplier's liability is capped at the fees paid.",
        true,
      ],
      [
        "5, a lowercase line after a heading",
        "Fees are payable monthly.\n\nTermination\nfor convenience requires 30 days' notice.",
        "for convenience requires 30 days' notice.",
        false,
      ],
      [
        "5, the heading and the line together",
        "Fees are payable monthly.\n\nTermination\nfor convenience requires 30 days' notice.",
        "Termination for convenience requires 30 days' notice.",
        true,
      ],
      [
        "6, a title-case line after a blank line (accepted cost)",
        "Fees are payable monthly.\n\nKestrel Analytics Private\nLimited may terminate without notice.",
        "Limited may terminate without notice.",
        true,
      ],
    ];
    for (const [name, doc, quote, expected] of headingCases) {
      it(`case ${name}: ${expected ? "found" : "not found"}`, () => {
        expect(found(doc, quote)).toBe(expected);
      });
    }
  });

  it("does not read an ordinary lowercase word as a numbering token in a heading", () => {
    const doc = "Notice To Mumbai Civil Court did\nnot reach the Company.";
    expect(found(doc, "not reach the Company.")).toBe(false);
  });

  it("accepts bracketed lowercase numbering in a heading line", () => {
    const doc = "(iv) Confidential Information\nThe Consultant shall keep it secret.";
    expect(found(doc, "The Consultant shall keep it secret.")).toBe(true);
  });

  it("does not read a line with a colon or a semicolon as a heading", () => {
    expect(found("Fees:\nThe Company shall pay.", "The Company shall pay.")).toBe(false);
    expect(found("Fees; Taxes\nThe Company shall pay.", "The Company shall pay.")).toBe(false);
  });

  it("does not read a line of more than eight words as a heading", () => {
    const doc = "One Two Three Four Five Six Seven Eight Nine\nThe Company shall pay.";
    expect(found(doc, "The Company shall pay.")).toBe(false);
  });

  it("does not treat a terminator as a boundary when a lowercase letter follows", () => {
    expect(found("The fee is Rs. 500 p.m. payable monthly. End.", "payable monthly.")).toBe(false);
    expect(found("Is it due? yes, on the first day. End.", "yes, on the first day.")).toBe(false);
  });

  it("treats the new abbreviations as never ending a sentence", () => {
    for (const abbreviation of ["Inc.", "LLP.", "Govt.", "Dept.", "Rd.", "Ref.", "Encl.", "Annex.", "Exh."]) {
      expect(found(`The notice goes to ${abbreviation} The Company shall pay.`, "The Company shall pay.")).toBe(false);
    }
  });

  it("does not count format characters alone as the whitespace after a full stop", () => {
    expect(found("The fee is due.​The Company shall pay.", "The Company shall pay.")).toBe(false);
    expect(found("The fee is due.​ The Company shall pay.", "The Company shall pay.")).toBe(true);
  });

  it("treats a Windows line ending like any other line break", () => {
    expect(found(`12.3 Termination\r\n${notice}`, notice)).toBe(true);
    expect(found("Customer will\r\nnot pay any fee.", "not pay any fee.")).toBe(false);
  });
});

describe("Source sentence check: extraction-shaped fixtures (research 09, section 7)", () => {
  const sets = [
    ["PDF", PDF_SHAPED_01, PDF_SHAPED_01_FOUND, PDF_SHAPED_01_WITHHELD],
    ["DOCX", DOCX_SHAPED_01, DOCX_SHAPED_01_FOUND, DOCX_SHAPED_01_WITHHELD],
    ["pasted", PASTED_LEASE_01, Object.fromEntries(PASTED_LEASE_01_FOUND.map((q) => [q, q])), PASTED_LEASE_01_ALTERED],
  ];

  for (const [kind, doc, foundSet, withheldSet] of sets) {
    for (const [name, quote] of Object.entries(foundSet)) {
      it(`${kind}: finds ${name}, and returns the stored span`, () => {
        const result = checkSource(doc, quote);
        expect(result.found).toBe(true);
        expect(doc.normalize("NFC").slice(result.start, result.end)).toBe(result.text);
        expect(normalise(result.text)).toBe(normalise(quote));
      });
    }
    for (const [name, quote] of Object.entries(withheldSet)) {
      it(`${kind}: does not find ${name}`, () => {
        expect(checkSource(doc, quote).found).toBe(false);
      });
    }
  }
});

describe("boundary walk on hostile input", () => {
  it("stays fast and fails closed on a very long run of heading lines", () => {
    const headings = Array.from({ length: 50000 }, (_, i) => `Clause ${i + 1}`).join("\n");
    const text = `Intro text here.\n${headings}\nThe Supplier shall pay the fee.`;
    const started = Date.now();
    const result = checkSource(text, "The Supplier shall pay the fee.");
    expect(Date.now() - started).toBeLessThan(2000);
    // The heading chain is longer than the walk follows, so the quote is withheld.
    expect(result.found).toBe(false);
  });

  it("still accepts a short heading chain", () => {
    const text = "Intro text here.\n\n12.\nLimitation of Liability\nThe Supplier's liability is capped at the fees paid.";
    expect(checkSource(text, "The Supplier's liability is capped at the fees paid.").found).toBe(true);
  });

  it("checkSources withholds instead of throwing", () => {
    expect(checkSources({ toString() { throw new Error("boom"); } }, ["x."]).found).toBe(false);
  });
});

describe("astral format characters in a gap", () => {
  it("treats U+E0001 between sentences like any other format character", () => {
    const tag = String.fromCodePoint(0xe0001);
    const text = `The Supplier shall pay the fee. ${tag} The Customer shall sign.`;
    expect(checkSource(text, "The Customer shall sign.").found).toBe(true);
    expect(checkSource(text, "The Supplier shall pay the fee.").found).toBe(true);
  });
});

describe("Ticket 22 ruling B: a quote may leave out the numbering that opens its sentence", () => {
  const shown = (doc, quote) => {
    const r = checkSource(doc, quote);
    return r.found ? r.text : null;
  };

  it.each([
    ["an inline clause number", "This Agreement ends on the date above. 17.2 The Licensee shall not surrender the Licence.", "The Licensee shall not surrender the Licence.", "17.2 The Licensee shall not surrender the Licence."],
    ["a bullet after a full stop", "The City pays the fee in parts.\n• $1,500.00 shall be due upon completion of the survey.", "$1,500.00 shall be due upon completion of the survey.", "• $1,500.00 shall be due upon completion of the survey."],
    ["a lettered item", "The Promoter agrees as follows.\n(a) The Promoter shall hand over possession.", "The Promoter shall hand over possession.", "(a) The Promoter shall hand over possession."],
    ["a roman numeral", "Time is of the essence. (ii) The Promoter assures possession.", "The Promoter assures possession.", "(ii) The Promoter assures possession."],
    // "B. If" is already a boundary under ADR 0010 (a full stop after an initial, then a capital), so
    // the bracket form is the one that needs ruling B.
    ["a capital letter item", "Payment terms follow.\nB) If the Agreement is terminated, no fee is due.", "If the Agreement is terminated, no fee is due.", "B) If the Agreement is terminated, no fee is due."],
    ["a capital roman numeral", "Payment terms follow. (IV) If the Agreement ends, no fee is due.", "If the Agreement ends, no fee is due.", "(IV) If the Agreement ends, no fee is due."],
    ["two tokens", "The parties agree.\n3 (a) The Licensee shall pay the fee.", "The Licensee shall pay the fee.", "3 (a) The Licensee shall pay the fee."],
    ["a bare integer at the start of a line", "Recitals end here.\n12 The Licensee shall pay the fee.", "The Licensee shall pay the fee.", "12 The Licensee shall pay the fee."],
    ["an opening quote", "Definitions follow. 1.1 “Fee” means the monthly fee.", "“Fee” means the monthly fee.", "1.1 “Fee” means the monthly fee."],
    ["a rupee amount", "Charges are below.\n- Rs. 500 is payable on signing.", "Rs. 500 is payable on signing.", "- Rs. 500 is payable on signing."],
  ])("shows %s, starting the span at the number", (_, doc, quote, expected) => {
    expect(shown(doc, quote)).toBe(expected);
  });

  it.each([
    ["a lowercase word after a bare number", "The term is set out below.\n12 months are allowed for the works.", "months are allowed for the works."],
    ["a lowercase word after a decimal", "Interest is charged. 17.2 percent is added to late sums.", "percent is added to late sums."],
    ["a quote starting mid-sentence after a word", "Notice is given. The Licensee shall pay the fee.", "Licensee shall pay the fee."],
    ["an inline heading ending in a colon", "The commission is due later. C. GRANT COMMISSION: If the Application fails, nothing is due.", "If the Application fails, nothing is due."],
    ["a word such as Clause", "Read this. Clause 4 The Licensee shall pay.", "The Licensee shall pay."],
    ["a bare integer inside a line", "The rent is due on day 12 The Licensee shall pay.", "The Licensee shall pay."],
    ["a bullet whose line follows a lead-in", "The fee is paid in parts:\n• $1,500.00 shall be due upon completion.", "$1,500.00 shall be due upon completion."],
    ["a sub-item after its lead-in", "The Licensor may:\n(i) seal the premises; and\n(ii) The Licensor may recover the dues.", "The Licensor may recover the dues."],
    ["more than three tokens", "Intro ends. • • • • The Licensee shall pay.", "The Licensee shall pay."],
    ["tokens longer than 24 characters", "Intro ends. 12.12.12.12.12 (iiiiiiiiiiiii) The Licensee shall pay.", "The Licensee shall pay."],
  ])("withholds %s", (_, doc, quote) => {
    expect(found(doc, quote)).toBe(false);
  });

  it("still shows a quote that includes its own number", () => {
    const doc = "This Agreement ends. 17.2 The Licensee shall not surrender the Licence.";
    expect(shown(doc, "17.2 The Licensee shall not surrender the Licence.")).toBe("17.2 The Licensee shall not surrender the Licence.");
  });
});
