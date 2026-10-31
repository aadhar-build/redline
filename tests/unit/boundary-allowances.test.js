// Ticket 14c: the three boundary allowances from research 32 (ADR 0010 addendum, 2026-10-31).
// Made-up strings only.
import { describe, expect, it } from "vitest";
import { checkSource, sentenceAt } from "../../lib/review/source-check.js";

const found = (text, quote) => checkSource(text, quote);

describe("Allowance (i): lowercase roman list markers", () => {
  const text = "The Lessee agrees to the terms below.\nii The Lessee shall pay rent monthly.\nvi. The Lessor shall repair the roof.\nxiv) The deposit is refundable.";

  it("accepts a quote that starts at a bare marker, and shows the marker", () => {
    const r = found(text, "ii The Lessee shall pay rent monthly.");
    expect(r.found).toBe(true);
    expect(r.text).toBe("ii The Lessee shall pay rent monthly.");
  });

  it("accepts markers with a full stop or a bracket", () => {
    expect(found(text, "vi. The Lessor shall repair the roof.").found).toBe(true);
    expect(found(text, "xiv) The deposit is refundable.").found).toBe(true);
  });

  it("accepts a quote that leaves the marker out, and shows it", () => {
    const r = found(text, "The Lessee shall pay rent monthly.");
    expect(r.found).toBe(true);
    expect(r.text).toBe("ii The Lessee shall pay rent monthly.");
    // "vi." ends in a full stop, so the gap after it is already a boundary (as after "I.").
    expect(found(text, "The Lessor shall repair the roof.").found).toBe(true);
    expect(found(text, "The deposit is refundable.").text).toBe("xiv) The deposit is refundable.");
  });

  it("sentenceAt finds the sentence from its marker", () => {
    const at = text.indexOf("pay rent");
    expect(sentenceAt(text, at, at + 3)?.text).toBe("ii The Lessee shall pay rent monthly.");
  });

  it("rejects a lowercase word wrapping onto a new line", () => {
    const wrap = "The Lessee shall pay the deposit.\nin the event of default The Lessor may keep it.";
    expect(found(wrap, "in the event of default The Lessor may keep it.").found).toBe(false);
    const wrap2 = "The Lessor shall refund the deposit\nin the event the Lessee leaves.";
    expect(found(wrap2, "in the event the Lessee leaves.").found).toBe(false);
  });

  it("rejects a numeral outside i to xx", () => {
    expect(found("Terms follow.\nxxi The Lessee shall pay.", "xxi The Lessee shall pay.").found).toBe(false);
    expect(found("Terms follow.\nil The Lessee shall pay.", "il The Lessee shall pay.").found).toBe(false);
  });

  it("rejects a marker not at a line start", () => {
    expect(found("Terms follow. ii The Lessee shall pay.", "ii The Lessee shall pay.").found).toBe(false);
  });

  it("rejects a marker followed by a lowercase word, two spaces or no space", () => {
    expect(found("Terms follow.\nii the Lessee shall pay.", "ii the Lessee shall pay.").found).toBe(false);
    expect(found("Terms follow.\nii  The Lessee shall pay.", "ii The Lessee shall pay.").found).toBe(false);
    expect(found("Terms follow.\niiThe Lessee shall pay.", "iiThe Lessee shall pay.").found).toBe(false);
  });

  it("rejects a marker whose line does not start on a boundary", () => {
    // After a lead-in ending ":" the sub-item still cannot be cited alone.
    expect(found("The Lessee shall not:\nii Sublet the premises.", "ii Sublet the premises.").found).toBe(false);
    // After a wrapped, unfinished sentence.
    expect(found("The Lessee shall pay\nii The Lessor shall.", "ii The Lessor shall.").found).toBe(false);
  });

  it("accepted cost: a case-citation wrap after a heading-shaped line starts a sentence (ADR 0010)", () => {
    const text = "The court ruled.\nUnion of India\nv. State of Punjab held the fee lawful.";
    expect(found(text, "v. State of Punjab held the fee lawful.").found).toBe(true);
    // Not when the line before is ordinary text.
    expect(found("In the case of Union of India\nv. State of Punjab held it.", "v. State of Punjab held it.").found).toBe(false);
  });

  it("does not let a quote end before a marker in the middle of a sentence", () => {
    expect(found("The Lessee shall pay\nii The Lessor shall.", "The Lessee shall pay").found).toBe(false);
  });
});

describe("Allowance (ii): page-footer lines", () => {
  it("looks past a footer line before a heading", () => {
    for (const footer of ["4IPage", "4|Page", "4 | Page", "Page 4", "page 4 of 9", "PAGE 4"]) {
      const text = `The rent is due monthly.\n${footer}\n4. AMENDMENT\nThe Licensor shall not change these terms.`;
      const r = found(text, "The Licensor shall not change these terms.");
      expect(r.found, footer).toBe(true);
      expect(r.text).toBe("The Licensor shall not change these terms.");
    }
  });

  it("leaves the stored text as it is when the footer sits inside a quote span", () => {
    const text = "The rent is due monthly.\n4IPage\nThe deposit is refundable.";
    const r = found(text, "The rent is due monthly. 4IPage The deposit is refundable.");
    expect(r.found).toBe(true);
    expect(r.text).toBe(text);
  });

  it("still rejects a quote that starts mid-sentence across a footer", () => {
    const text = "The Lessee shall not\n4IPage\nSublet the premises.";
    expect(found(text, "Sublet the premises.").found).toBe(false);
  });

  // Lines that already pass the older heading test ("Page 4 of", "4 Page") are not near-misses here.
  it("still rejects near-miss footer shapes", () => {
    for (const line of ["Page four", "page 4 of", "4IPage 5", "4IPage;", "4IPage of", "4xPage"]) {
      const text = `The rent is due monthly.\n${line}\n4. AMENDMENT\nThe Licensor shall not change these terms.`;
      expect(found(text, "The Licensor shall not change these terms.").found, line).toBe(false);
    }
  });
});

describe("Allowance (iii): '&' in heading lines", () => {
  it("accepts the first sentence under a heading with '&'", () => {
    const text = "The rent is due monthly.\n9. TERM & TERMINATION\nEither party may end this agreement.";
    expect(found(text, "Either party may end this agreement.").found).toBe(true);
  });

  it("still rejects a '&' line that is not a heading", () => {
    const text = "The rent is due monthly.\nRent & deposit shall be paid\nEither party may end this agreement.";
    expect(found(text, "Either party may end this agreement.").found).toBe(false);
  });
});
