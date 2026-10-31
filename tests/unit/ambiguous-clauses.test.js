// Ambiguous clauses with their readings (ticket 07) and what they and withheld flags do to a Clean
// result (ticket 16, spec-gaps 15). An Ambiguous clause is a Negotiate flag that lists every reading
// and picks none; it blocks a Clean result, as does any withheld flag.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { gateCleanResult } from "../../lib/review/clean-result-gate.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const twoText = read("fixtures/contracts/ambiguous-clauses-01.txt");
const onlyText = read("fixtures/contracts/ambiguous-clause-only-01.txt");
const twoScript = JSON.parse(read("fixtures/model-output/ambiguous-clauses-01.risk-flags.json")).riskFlags;
const asRow = (r) => JSON.parse(JSON.stringify(toStoredReview(r)));
const local = (documentText, redLines = []) => review({ documentText, redLines, adapter: createLocalFakeAdapter({ root }) });
const scripted = (documentText, riskFlags) =>
  review({ documentText, redLines: [], adapter: createFakeAdapter({ responses: [JSON.stringify({ summary: "A summary.", riskFlags })] }) });

const ambiguousSource = "4. Ending early. Either party can end this Agreement by giving the other party fifteen days' written notice after the first three months.";
const ambiguous = (extra = {}) => ({
  severity: "negotiate",
  title: "When notice can be given",
  says: "Either party can end the Agreement with fifteen days' written notice after the first three months.",
  judgment: null,
  sourceSentences: [ambiguousSource],
  redLine: null,
  readings: ["Notice can be given only after three months.", "Notice can be given at any time."],
  counterOffer: null,
  ...extra,
});

// The decision with the gate both shut (as shipped) and lifted.
function expectNotClean(r) {
  expect(cleanResultOf(r)).toBe(false);
  expect(gateCleanResult(cleanResultOf(r), false)).toEqual({ cleanResult: null, cleanResultHeld: false });
  expect(gateCleanResult(cleanResultOf(r), true)).toEqual({ cleanResult: false, cleanResultHeld: false });
  expect(r.cleanResult).toBeNull();
  expect(r.cleanResultHeld).toBe(false);
}

describe("Ambiguous clauses shown with their readings (PRD criterion 11)", () => {
  it("shows every two-reading fixture clause with both readings, in order, and no chosen reading", async () => {
    const r = await local(twoText);
    const scriptedAmbiguous = twoScript.filter((f) => f.readings);
    expect(r.ambiguousClauses).toHaveLength(scriptedAmbiguous.length);
    for (const [i, clause] of r.ambiguousClauses.entries()) {
      expect(clause.readings.map((x) => x.text)).toEqual(scriptedAmbiguous[i].readings);
      expect(clause.chosenReading).toBeUndefined();
      expect(clause.sourceSentences[0].text).toBe(scriptedAmbiguous[i].sourceSentences[0]);
    }
    // The ordinary flag carries no readings.
    expect(r.riskFlags.filter((f) => f.readings === null)).toHaveLength(1);
  });

  it("shows an Ambiguous clause at Negotiate, whatever Severity the model gave it", async () => {
    const r = await local(twoText);
    expect(r.ambiguousClauses.every((f) => f.severity === "negotiate")).toBe(true);
    const k = await scripted(onlyText, [ambiguous({ severity: "know-this" })]);
    expect(k.riskFlags[0].severity).toBe("negotiate");
  });

  it("raises an Ambiguous clause that matches a Red line to Don't sign as written", async () => {
    const r = await review({
      documentText: onlyText,
      redLines: DEFAULT_RED_LINES,
      adapter: createFakeAdapter({ responses: [JSON.stringify({ summary: "S.", riskFlags: [ambiguous({ redLine: DEFAULT_RED_LINES[0].id })] })] }),
    });
    expect(r.riskFlags[0].severity).toBe("dont-sign-as-written");
    expect(r.ambiguousClauses).toHaveLength(1);
  });

  it("marks hedge words in a reading (PRD criterion 8), and the fixture readings have none", async () => {
    const r = await local(twoText);
    for (const c of r.ambiguousClauses) for (const x of c.readings) expect(x.marked).toEqual([]);
    const m = await scripted(onlyText, [ambiguous({ readings: ["Notice may be given only after three months.", "Notice can be given at any time."] })]);
    expect(m.riskFlags[0].readings[0].marked.length).toBeGreaterThan(0);
  });

  it("withholds a flag whose readings cannot be used: one reading, duplicates, or not text", async () => {
    for (const readings of [["Only one."], ["Same.", "same."], "two readings", [1, 2]]) {
      const r = await scripted(onlyText, [ambiguous({ readings })]);
      expect(r.riskFlags).toEqual([]);
      expect(r.withheldCount).toBe(1);
    }
  });

  it("withholds a reading that gives a number the document does not contain", async () => {
    const r = await scripted(onlyText, [ambiguous({ readings: ["Notice can be given after 90 days.", "Notice can be given at any time."] })]);
    expect(r.withheld).toEqual([{ reason: "unsupported-number" }]);
  });

  it("keeps the readings in the review copy free of banned wording", () => {
    for (const s of [COPY.ambiguous.label, COPY.ambiguous.lede, COPY.ambiguous.readingCaption(1, 2)]) expect(findBannedWording(s)).toEqual([]);
  });
});

describe("against a Clean result (ticket 16, PRD criteria 7 and 11)", () => {
  it("does not give a Clean result to a no-flags-otherwise fixture with one Ambiguous clause, gate shut or lifted", async () => {
    const r = await local(onlyText);
    expect(r.withheldCount).toBe(0);
    expect(r.ambiguousClauses).toHaveLength(1);
    expectNotClean(r);
  });

  it("does not give a Clean result when the only problem is one withheld flag, gate shut or lifted", async () => {
    const r = await scripted(onlyText, [ambiguous({ sourceSentences: ["This sentence is not in the document."] })]);
    expect(r.riskFlags).toEqual([]);
    expect(r.withheldCount).toBe(1);
    expectNotClean(r);
  });

  it("would give a Clean result to the same contract with no flags (the gate holds it back)", async () => {
    const r = await scripted(onlyText, []);
    expect(cleanResultOf(r)).toBe(true);
    expect(gateCleanResult(true, true)).toEqual({ cleanResult: true, cleanResultHeld: false });
    expect(r.cleanResultHeld).toBe(true);
  });
});

describe("a saved Ambiguous clause", () => {
  it("stores the readings as text only, and reopens with the same readings, Severity and blocked Clean result", async () => {
    const r = await local(twoText);
    const row = asRow(r);
    const stored = row.flags.filter((f) => f.readings);
    expect(stored.map((f) => f.readings)).toEqual(twoScript.filter((f) => f.readings).map((f) => f.readings));
    const reopened = reopenReview({ documentText: twoText, stored: row });
    expect(reopened.riskFlags).toEqual(r.riskFlags);
    expect(reopened.ambiguousClauses).toEqual(r.ambiguousClauses);
    const only = await local(onlyText);
    expectNotClean(reopenReview({ documentText: onlyText, stored: asRow(only) }));
  });

  it("reopens a row saved before ticket 07, with no readings field, as an ordinary flag", async () => {
    const row = asRow(await local(twoText));
    for (const f of row.flags) delete f.readings;
    const reopened = reopenReview({ documentText: twoText, stored: row });
    expect(reopened.ambiguousClauses).toEqual([]);
    expect(reopened.riskFlags.every((f) => f.readings === null)).toBe(true);
  });

  it("puts the Severity rule back on reopen, even if a stored row says otherwise", async () => {
    const row = asRow(await local(onlyText));
    row.flags[0].severity = "know-this";
    const reopened = reopenReview({ documentText: onlyText, stored: row });
    expect(reopened.riskFlags[0].severity).toBe("negotiate");
    expectNotClean(reopened);
  });
});
