// The Reviewer's stored Red lines as Review takes them (ticket 12). The storage itself is covered
// against the local Supabase stack in tests/isolation/red-lines.test.ts.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COPY } from "../../app/(app)/review/copy.js";
import { RED_LINES_COPY } from "../../app/(app)/red-lines/red-lines-copy.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { review } from "../../lib/review/review.js";
import { findBannedWording } from "../../lib/review/wording.js";
import {
  cleanRedLineText,
  forReview,
  MAX_RED_LINE_LENGTH,
  redLineFromRow,
} from "../../lib/library/red-lines.js";

const root = path.resolve(__dirname, "../..");
const text = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-02.txt"), "utf8");
const ROW = "0b8f4a52-6a7e-4c38-9b8e-3f2a1d6c7e90";

describe("a stored Red line row", () => {
  it("an unedited Default Red line keeps its stable id, what it catches and its basis", () => {
    DEFAULT_RED_LINES.forEach((d, i) => {
      const r = redLineFromRow({ id: ROW, text: d.name, default_number: i + 1 });
      expect(r).toEqual({
        id: d.id,
        rowId: ROW,
        defaultNumber: i + 1,
        edited: false,
        name: d.name,
        catches: d.catches,
        basis: { ...d.basis },
      });
    });
  });

  it("a reworded Default Red line keeps its id but carries only the Reviewer's words", () => {
    const r = redLineFromRow({ id: ROW, text: "Any personal guarantee from Henry", default_number: 1 });
    expect(r).toMatchObject({ id: "default-personal-guarantee", defaultNumber: 1, edited: true, catches: null, basis: null });
    expect(r.name).toBe("Any personal guarantee from Henry");
  });

  it("a Red line the Reviewer added gets an id of its own", () => {
    const r = redLineFromRow({ id: ROW, text: "Payment later than 30 days", default_number: null });
    expect(r).toEqual({
      id: `own-${ROW}`,
      rowId: ROW,
      defaultNumber: null,
      edited: false,
      name: "Payment later than 30 days",
      catches: null,
      basis: null,
    });
  });

  it("goes to Review with only the fields Review reads", () => {
    const list = [redLineFromRow({ id: ROW, text: DEFAULT_RED_LINES[0].name, default_number: 1 })];
    expect(forReview(list)).toEqual([
      { id: DEFAULT_RED_LINES[0].id, name: DEFAULT_RED_LINES[0].name, catches: DEFAULT_RED_LINES[0].catches, basis: { ...DEFAULT_RED_LINES[0].basis } },
    ]);
  });
});

describe("the Reviewer's wording", () => {
  it("is kept to one line without a trailing full stop", () => {
    expect(cleanRedLineText("  Payment terms\nlonger than   60 days.  ")).toBe("Payment terms longer than 60 days");
  });

  it("is refused when empty or too long", () => {
    for (const bad of ["", "   ", ".", null, undefined]) {
      expect(() => cleanRedLineText(bad)).toThrow(expect.objectContaining({ code: "empty-red-line" }));
    }
    expect(() => cleanRedLineText("x".repeat(MAX_RED_LINE_LENGTH + 1))).toThrow(expect.objectContaining({ code: "red-line-too-long" }));
    expect(cleanRedLineText("x".repeat(MAX_RED_LINE_LENGTH))).toHaveLength(MAX_RED_LINE_LENGTH);
  });
});

describe("Review seam: a Red line in the Reviewer's own words", () => {
  const own = redLineFromRow({ id: ROW, text: "The Processor can change fees by email", default_number: null });
  const sentence = "Processor can change any fee, or add a new fee, at any time by sending Merchant an email.";

  it("is sent to the model with the document, and a match names it", async () => {
    const prompts = [];
    const adapter = createFakeAdapter({
      responses: [
        (p) => {
          prompts.push(p);
          return JSON.stringify({
            summary: "A summary.",
            riskFlags: [
              { severity: "negotiate", title: "Fees by email", says: "Fees change by email.", judgment: null, sourceSentences: [sentence], redLine: own.id },
            ],
          });
        },
      ],
    });
    const result = await review({ documentText: text, redLines: forReview([own]), adapter });
    const instructions = prompts[0].split("<document>")[0];
    expect(instructions).toContain(`id "${own.id}": The Processor can change fees by email.`);
    expect(prompts[0]).toContain(text);
    expect(result.riskFlags[0]).toMatchObject({
      severity: "dont-sign-as-written",
      redLineMatch: { id: own.id, number: 1, name: "The Processor can change fees by email" },
    });
    expect(result.redLinesChecked).toEqual([{ id: own.id, number: 1, name: own.name, catches: null, basis: null }]);
  });
});

describe("copy", () => {
  it("has a message for Red lines Review could not read", () => {
    expect(COPY.errors["bad-red-lines"]).toBeTruthy();
    expect(COPY.errors["red-lines-failed"]).toBeTruthy();
  });

  it("says plainly that removing a Default Red line removes its protection", () => {
    const line = RED_LINES_COPY.removed(2, DEFAULT_RED_LINES[1].name);
    expect(line).toContain("Default Red line 2");
    expect(line).toContain(DEFAULT_RED_LINES[1].name);
    expect(line).toMatch(/no longer checks/);
    expect(line).toMatch(/no longer marked Don't sign as written/);
  });

  it("uses no hedge or verdict words on the Red lines screen", () => {
    const strings = [];
    const walk = (v) => {
      if (typeof v === "string") strings.push(v);
      else if (typeof v === "function") strings.push(String(v(1, "Name")));
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(RED_LINES_COPY);
    for (const s of strings) expect(findBannedWording(s), s).toEqual([]);
  });
});
