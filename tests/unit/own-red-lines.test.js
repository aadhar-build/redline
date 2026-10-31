// Red lines in the Reviewer's own words (ticket 15, PRD criterion 5, OQ16), through the Review seam
// with the local fake adapter. Each Red line goes to the model with the document; each match names the
// Red line it matched and cites its Source sentence, checked like any flag.
// Storage of the same list is covered against local Supabase in tests/isolation/saved-reviews.test.ts.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { review } from "../../lib/review/review.js";
import { forReview, redLineFromRow, sameRedLineList } from "../../lib/library/red-lines.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";
import { RED_LINES_COPY } from "../../app/(app)/red-lines/red-lines-copy.js";
import { OWN_RED_LINE_SEEDS, OWN_RED_LINES_DOCUMENT } from "../../fixtures/contracts/own-red-line-seeds.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const documentText = read(OWN_RED_LINES_DOCUMENT);
const script = JSON.parse(read("fixtures/model-output/own-red-lines-01.risk-flags.json")).riskFlags;

const sameSources = (flag, sentences) =>
  flag.sourceSentences.length === sentences.length && flag.sourceSentences.every((s, i) => s.text === sentences[i]);

// The Reviewer's list as it comes out of storage: the four Default Red lines, then their own.
const rowId = (i) => `00000000-0000-4000-8000-00000000000${i}`;
const ownRows = OWN_RED_LINE_SEEDS.map((s, i) => redLineFromRow({ id: rowId(i), text: s.redLine, default_number: null }));
const defaults = DEFAULT_RED_LINES.map((d, i) => redLineFromRow({ id: rowId(i + 5), text: d.name, default_number: i + 1 }));
const fullList = [...defaults, ...ownRows];

function recordingAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts = [];
  return { prompts, name: inner.name, complete: (p) => (prompts.push(p), inner.complete(p)) };
}

async function run(list) {
  const adapter = recordingAdapter();
  const result = await review({ documentText, redLines: forReview(list), adapter });
  return { result, instructions: adapter.prompts[0].split("<document>")[0], prompt: adapter.prompts[0] };
}

describe("Review seam: Red lines in the Reviewer's own words", () => {
  it("seeds each clause in the fixture, word for word", () => {
    for (const seed of OWN_RED_LINE_SEEDS) for (const s of seed.sentences) expect(documentText).toContain(s);
  });

  it("sends every own Red line to the model in the Reviewer's words, with the document", async () => {
    const { instructions, prompt } = await run(fullList);
    for (const r of ownRows) expect(instructions).toContain(`id "${r.id}": ${r.name}.`);
    expect(prompt).toContain(documentText.trim());
  });

  it("flags every seeded clause Don't sign as written, naming the Red line it matched, with the seeded sentences", async () => {
    const { result } = await run(fullList);
    expect(result.riskFlagsStatus).toBe("checked");
    OWN_RED_LINE_SEEDS.forEach((seed, i) => {
      const flag = result.riskFlags.find((f) => sameSources(f, seed.sentences));
      expect(flag, seed.redLine).toBeDefined();
      expect(flag.severity).toBe("dont-sign-as-written");
      // The match is the Reviewer's own entry, numbered by its place in the list: after the four defaults.
      expect(flag.redLineMatch).toEqual({ id: ownRows[i].id, number: 5 + i, name: seed.redLine });
      for (const s of flag.sourceSentences) expect(documentText.slice(s.start, s.end)).toBe(s.text);
    });
    expect(result.redLinesChecked.map((r) => r.id)).toEqual(fullList.map((r) => r.id));
  });

  it("raises an own-words match the script put at a lower Severity to Don't sign as written", async () => {
    const lowered = script.filter((f) => f.redLineWords && f.severity !== "dont-sign-as-written" && !f._misbehaves);
    expect(lowered.length).toBeGreaterThanOrEqual(2);
    const { result } = await run(fullList);
    for (const raw of lowered) {
      const flag = result.riskFlags.find((f) => sameSources(f, raw.sourceSentences));
      expect(flag.severity).toBe("dont-sign-as-written");
      expect(flag.redLineMatch.name).toBe(raw.redLineWords);
    }
  });

  it("withholds an own-words match whose Source sentence is not in the document, like any flag", async () => {
    const { result } = await run(fullList);
    expect(result.withheld).toEqual([{ reason: "source-not-found" }]);
    expect(result.withheldCount).toBe(1);
    const invented = script.find((f) => f._misbehaves).sourceSentences[0];
    expect(documentText).not.toContain(invented);
    expect(result.riskFlags.some((f) => f.sourceSentences.some((s) => s.text === invented))).toBe(false);
  });

  it("keeps the scripted Severity of a flag that matches no Red line", async () => {
    const { result } = await run(fullList);
    const raw = script.find((f) => f.redLine === null);
    const flag = result.riskFlags.find((f) => sameSources(f, raw.sourceSentences));
    expect(flag).toMatchObject({ severity: raw.severity, redLineMatch: null });
  });

  it.each(OWN_RED_LINE_SEEDS.map((s, i) => [s.redLine, i]))("with \"%s\" left out, its clause is no longer a Red line match", async (_, i) => {
    const list = fullList.filter((r) => r.id !== ownRows[i].id);
    const { result, instructions } = await run(list);
    expect(instructions).not.toContain(ownRows[i].id);
    expect(instructions).not.toContain(OWN_RED_LINE_SEEDS[i].redLine);
    const seed = OWN_RED_LINE_SEEDS[i];
    const flag = result.riskFlags.find((f) => sameSources(f, seed.sentences));
    const raw = script.find((f) => f.redLineWords === seed.redLine && !f._misbehaves);
    expect(flag).toMatchObject({ severity: raw.severity, redLineMatch: null });
    // The others still match.
    OWN_RED_LINE_SEEDS.forEach((other, j) => {
      if (j === i) return;
      const f = result.riskFlags.find((x) => sameSources(x, other.sentences));
      expect(f.redLineMatch?.id).toBe(ownRows[j].id);
    });
  });

  it("checked against the Default Red lines only, none of these clauses is a Red line match", async () => {
    const { result } = await run(defaults);
    expect(result.riskFlags.every((f) => f.redLineMatch === null)).toBe(true);
  });
});

describe("whether a saved review was checked against the current list (OQ17)", () => {
  const now = forReview(fullList);

  it("is the same list when the stored list is what Review checked, basis aside", async () => {
    const { result } = await run(fullList);
    expect(sameRedLineList(result.redLinesChecked, now)).toBe(true);
    // The basis is shown, never sent to the model, so it does not make a list older.
    expect(sameRedLineList(result.redLinesChecked.map((r) => ({ ...r, basis: null })), now)).toBe(true);
  });

  it("is an older list after any addition, removal, rewording, change to what a Red line catches, or reordering", async () => {
    const { result } = await run(fullList);
    const stored = result.redLinesChecked;
    const changed = [
      [...now, { id: "own-new", name: "A new one", catches: null }],
      now.slice(1),
      now.map((r, i) => (i === 4 ? { ...r, name: `${r.name}, or 45` } : r)),
      now.map((r, i) => (i === 0 ? { ...r, catches: "Something else." } : r)),
      [now[1], now[0], ...now.slice(2)],
    ];
    for (const list of changed) expect(sameRedLineList(stored, list)).toBe(false);
  });

  it("is an older list, without throwing, for a stored list of any other shape", () => {
    for (const stored of [null, undefined, "x", {}, [], [null], [{ text: "Old", default_number: 1 }], [{ id: 3, name: "x" }]]) {
      expect(sameRedLineList(stored, now)).toBe(false);
    }
    expect(sameRedLineList([], [])).toBe(true);
  });
});

describe("copy for saved reviews and re-runs", () => {
  it("uses no hedge or verdict words", () => {
    const { library, saved } = LIBRARY_COPY;
    const strings = [library.lede, library.olderList, saved.olderList, saved.rerun, saved.rerunBusy, saved.rerunOff, ...Object.values(saved.rerunErrors), RED_LINES_COPY.lede];
    for (const s of strings) expect(findBannedWording(s), s).toEqual([]);
  });
});
