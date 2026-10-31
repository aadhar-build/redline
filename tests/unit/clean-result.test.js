// The Clean result through the Review seam (ticket 11, ADR 0006, ADR 0007, spec-gaps 15 and 16).
// Redline's code decides it from the finished review; the model never does. Reopening a saved review
// decides it again with the same rule.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { CLEAN_RESULT_READY, gateCleanResult } from "../../lib/review/clean-result-gate.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cleanText = read("fixtures/contracts/clean-agreement-01.txt");
const cleanFlags = JSON.parse(read("fixtures/model-output/clean-agreement-01.risk-flags.json")).riskFlags;
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");

const lateSentence = "Client will pay interest of 1% per month on any invoice not paid within thirty days.";
const flag = (extra = {}) => ({
  severity: "know-this",
  title: "Interest on late invoices",
  says: "Late invoices carry interest of 1% a month.",
  judgment: null,
  sourceSentences: [lateSentence],
  redLine: null,
  ...extra,
});

async function run(riskFlags, redLines = DEFAULT_RED_LINES) {
  const reply = JSON.stringify({ summary: "A summary.", riskFlags });
  return review({ documentText: cleanText, redLines, adapter: createFakeAdapter({ responses: [reply] }) });
}

const asRow = (r) => JSON.parse(JSON.stringify(toStoredReview(r)));

// What the rule decides for a review, and that the review shows exactly that: the gate is lifted
// (tickets 13 and 07 landed), so cleanResult is the rule's decision and nothing is held back.
function expectDecided(r, decided) {
  expect(cleanResultOf(r)).toBe(decided);
  expect(r.cleanResult).toBe(decided);
  expect(r.cleanResultHeld).toBe(false);
}

describe("Clean result content (PRD criterion 7)", () => {
  it("gives a Clean result for the clean fixture, with every Red line checked and its Know this flags", async () => {
    const result = await review({ documentText: cleanText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    expect(result.riskFlagsStatus).toBe("checked");
    expect(result.withheldCount).toBe(0);
    expect(result.ambiguousClauses).toEqual([]);
    expect(result.outsideReferences).toEqual([]);
    expectDecided(result, true);
    // Every Red line in the Review input, in order.
    expect(result.redLinesChecked.map((r) => r.id)).toEqual(DEFAULT_RED_LINES.map((r) => r.id));
    expect(result.riskFlags).toHaveLength(cleanFlags.length);
    expect(result.riskFlags.every((f) => f.severity === "know-this")).toBe(true);
    for (const f of result.riskFlags) {
      for (const s of f.sourceSentences) expect(cleanText.slice(s.start, s.end)).toBe(s.text);
    }
  });

  it("gives a Clean result when no flags come back at all", async () => {
    const result = await run([]);
    expectDecided(result, true);
    expect(result.riskFlags).toEqual([]);
  });

  it("lists the Reviewer's own Red line list as given, even an empty one", async () => {
    const own = [{ id: "own-1", name: "No exclusivity" }];
    expect((await run([flag()], own)).redLinesChecked.map((r) => r.id)).toEqual(["own-1"]);
    const none = await run([flag()], []);
    expectDecided(none, true);
    expect(none.redLinesChecked).toEqual([]);
  });
});

describe("what blocks a Clean result", () => {
  it("any Don't sign as written or Negotiate flag", async () => {
    expectDecided(await run([flag(), flag({ severity: "negotiate" })]), false);
    expectDecided(await run([flag({ severity: "dont-sign-as-written" })]), false);
  });

  it("a Know this flag the model tied to a Red line, because Review raises it to Don't sign as written", async () => {
    const result = await run([flag({ redLine: "default-one-sided-changes" })]);
    expect(result.riskFlags[0].severity).toBe("dont-sign-as-written");
    expectDecided(result, false);
  });

  it("any withheld flag, whatever its reason or Severity", async () => {
    for (const bad of [
      flag({ sourceSentences: ["Client will pay interest of 2% per month on any invoice."] }),
      flag({ sourceSentences: [] }),
      { severity: "know-this" },
    ]) {
      const result = await run([flag(), bad]);
      expect(result.withheldCount).toBe(1);
      expectDecided(result, false);
    }
  });

  it("Risk flags that could not be read: nothing was checked, so it is neither clean nor not", async () => {
    const result = await review({ documentText: cleanText, adapter: createFakeAdapter({ responses: ['{"summary": "A summary."}'] }) });
    expectDecided(result, null);
  });

  it("the vendor agreement fixture, which has flags at every level and withheld flags", async () => {
    const result = await review({ documentText: vendorText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    expectDecided(result, false);
  });
});

describe("the gate on the Clean result", () => {
  it("is lifted now that tickets 13 and 07 have landed", () => {
    expect(CLEAN_RESULT_READY).toBe(true);
    for (const v of [true, false, null]) expect(gateCleanResult(v)).toEqual({ cleanResult: v, cleanResultHeld: false });
  });

  it("would hold a Clean result back if shut again", () => {
    expect(gateCleanResult(true, false)).toEqual({ cleanResult: null, cleanResultHeld: true });
    expect(gateCleanResult(false, false)).toEqual({ cleanResult: null, cleanResultHeld: false });
    expect(gateCleanResult(null, false)).toEqual({ cleanResult: null, cleanResultHeld: false });
  });

  it("passes the rule's decision through once lifted", () => {
    for (const v of [true, false, null]) expect(gateCleanResult(v, true)).toEqual({ cleanResult: v, cleanResultHeld: false });
  });
});

describe("the rule, ready for Ambiguous clauses and Outside references", () => {
  const base = { riskFlagsStatus: "checked", riskFlags: [], withheld: [], withheldCount: 0, ambiguousClauses: [], outsideReferences: [] };

  it("is true only when nothing stands in the way", () => {
    expect(cleanResultOf(base)).toBe(true);
    expect(cleanResultOf({ ...base, riskFlags: [{ severity: "know-this" }] })).toBe(true);
  });

  it("is blocked by any Ambiguous clause (spec-gaps 15)", () => {
    expect(cleanResultOf({ ...base, ambiguousClauses: [{ readings: ["one", "two"] }] })).toBe(false);
  });

  it("is blocked by any unresolved Outside reference, and not by a resolved one (ADR 0007)", () => {
    expect(cleanResultOf({ ...base, outsideReferences: [{ resolved: false }] })).toBe(false);
    expect(cleanResultOf({ ...base, outsideReferences: [{}] })).toBe(false);
    expect(cleanResultOf({ ...base, outsideReferences: [{ resolved: true }, { resolved: false }] })).toBe(false);
    expect(cleanResultOf({ ...base, outsideReferences: [{ resolved: true }] })).toBe(true);
  });

  it("fails closed on a missing or malformed part", () => {
    expect(cleanResultOf(null)).toBeNull();
    expect(cleanResultOf({ ...base, withheldCount: undefined })).toBe(false);
    expect(cleanResultOf({ ...base, withheldCount: 2 })).toBe(false);
    expect(cleanResultOf({ ...base, riskFlags: undefined })).toBe(false);
    expect(cleanResultOf({ ...base, ambiguousClauses: undefined })).toBe(false);
    expect(cleanResultOf({ ...base, outsideReferences: undefined })).toBe(false);
    expect(cleanResultOf({ ...base, riskFlags: [{ severity: "Know this" }] })).toBe(false);
  });
});

describe("a reopened saved review", () => {
  it("decides the Clean result again, the same way as when it was made", async () => {
    const result = await review({ documentText: cleanText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    const reopened = reopenReview({ documentText: cleanText, stored: asRow(result) });
    expectDecided(reopened, true);
    expect(reopened.redLinesChecked).toEqual(result.redLinesChecked);
    expect(reopened.riskFlags).toEqual(result.riskFlags);
  });

  it("loses the Clean result when a stored sentence no longer passes the Source sentence check", async () => {
    const result = await review({ documentText: cleanText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    const row = asRow(result);
    row.flags[0].source_sentences = [row.flags[0].source_sentences[0].replace("1%", "10%")];
    const reopened = reopenReview({ documentText: cleanText, stored: row });
    expect(reopened.withheldCount).toBe(1);
    expectDecided(reopened, false);
  });
});

describe("the verdict-word check on Clean result text (PRD criterion 8)", () => {
  it("finds no banned word in the Clean result copy", () => {
    for (const text of Object.values(COPY.clean)) expect(findBannedWording(text)).toEqual([]);
    expect(findBannedWording(COPY.redLines.title)).toEqual([]);
  });

  it("finds no banned word in the Default Red lines a Clean result lists", () => {
    for (const r of DEFAULT_RED_LINES) {
      for (const text of [r.name, r.catches, r.basis.label, r.basis.note]) expect(findBannedWording(text)).toEqual([]);
    }
  });

  it("finds no banned word in the clean fixture's own text", async () => {
    const result = await review({ documentText: cleanText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    expect(result.summary.marked).toEqual([]);
    for (const f of result.riskFlags) for (const part of [f.title, f.says]) expect(part.marked).toEqual([]);
  });
});
