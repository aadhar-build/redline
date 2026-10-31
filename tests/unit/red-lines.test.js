import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { review, ReviewInputError } from "../../lib/review/review.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { RED_LINE_SEEDS } from "../../fixtures/contracts/red-line-seeds.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const scriptFor = (document) =>
  JSON.parse(read(document.replace("contracts/", "model-output/").replace(/\.txt$/, ".risk-flags.json"))).riskFlags;

const sameSources = (flag, sentences) =>
  flag.sourceSentences.length === sentences.length && flag.sourceSentences.every((s, i) => s.text === sentences[i]);

// A local fake adapter that also records each prompt it was sent.
function recordingAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts = [];
  return { prompts, name: inner.name, complete: (p) => (prompts.push(p), inner.complete(p)) };
}

describe("Default Red lines", () => {
  it("are the four from ADR 0004, each with a stable id, a name, what it catches and a basis", () => {
    expect(DEFAULT_RED_LINES.map((r) => r.id)).toEqual([
      "default-personal-guarantee",
      "default-auto-renewal-or-long-term",
      "default-one-sided-changes",
      "default-uncapped-liability",
    ]);
    expect(DEFAULT_RED_LINES.map((r) => r.name)).toEqual([
      "Personal guarantee",
      "Auto-renewal with an exit fee, or a minimum term over 12 months",
      "Counterparty can change terms or prices without the Owner's consent",
      "Uncapped indemnity or liability carried by the Owner",
    ]);
    for (const r of DEFAULT_RED_LINES) {
      expect(r.catches).toBeTruthy();
      expect(r.basis.label).toBeTruthy();
      expect(r.basis.note).toBeTruthy();
    }
  });

  it("label Red line 4 as the product owner's judgment with no evidence", () => {
    const four = DEFAULT_RED_LINES[3];
    expect(four.basis.kind).toBe("owner-judgment");
    expect(four.basis.label).toMatch(/no evidence/i);
    expect(four.basis.label).toMatch(/product owner's judgment/);
    // None of the other three is labelled as having no evidence.
    for (const r of DEFAULT_RED_LINES.slice(0, 3)) expect(r.basis.label).not.toMatch(/no evidence/i);
  });

  it("keep ADR 0004's qualifiers: Red line 2's threshold is a judgment, Red line 3's basis is weak", () => {
    const [, two, three] = DEFAULT_RED_LINES;
    expect(two.basis.note).toMatch(/12-month threshold is the product owner's judgment/);
    expect(two.basis.note).toContain("$495");
    expect(three.basis.kind).toBe("weak-research");
    expect(three.basis.label).toMatch(/weak/i);
    // Red line 3 covers terms "as amended from time to time" and written-in escalators (spec-gaps 12).
    expect(three.catches).toContain("as amended from time to time");
    expect(three.catches).toMatch(/fee increases already written into the contract/);
  });

  it("use no hedge or verdict words", () => {
    for (const r of DEFAULT_RED_LINES) {
      for (const text of [r.name, r.catches, r.basis.label, r.basis.note]) {
        expect(findBannedWording(text)).toEqual([]);
      }
    }
  });

  it("cannot be changed by a caller", () => {
    expect(Object.isFrozen(DEFAULT_RED_LINES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RED_LINES[0])).toBe(true);
    expect(Object.isFrozen(DEFAULT_RED_LINES[0].basis)).toBe(true);
  });
});

describe.each(RED_LINE_SEEDS)("Review seam: Default Red lines in $document ($contractType)", ({ document, seeds }) => {
  const documentText = read(document);
  const run = () => review({ documentText, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });

  it("flags every seeded clause Don't sign as written, naming the Red line, with the seeded sentences as its Source sentences", async () => {
    const result = await run();
    expect(result.riskFlagsStatus).toBe("checked");
    expect(result.withheldCount).toBe(0);
    for (const seed of seeds) {
      for (const s of seed.sentences) expect(documentText).toContain(s);
      const flag = result.riskFlags.find((f) => sameSources(f, seed.sentences));
      expect(flag, `${seed.redLine}: ${seed.sentences[0]}`).toBeDefined();
      expect(flag.severity).toBe("dont-sign-as-written");
      expect(flag.redLineMatch).toMatchObject({ id: seed.redLine });
      // Each shown Source sentence is a span of the stored text.
      for (const s of flag.sourceSentences) expect(documentText.slice(s.start, s.end)).toBe(s.text);
    }
    // Every Default Red line is seeded in this fixture.
    expect(new Set(seeds.map((s) => s.redLine))).toEqual(new Set(DEFAULT_RED_LINES.map((r) => r.id)));
  });

  it("raises a Red line match the script put at a lower Severity to Don't sign as written", async () => {
    const script = scriptFor(document);
    const lowered = script.filter((f) => f.redLine && f.severity !== "dont-sign-as-written");
    expect(lowered.length).toBeGreaterThan(0);
    const result = await run();
    for (const raw of lowered) {
      const flag = result.riskFlags.find((f) => sameSources(f, raw.sourceSentences));
      expect(flag.severity).toBe("dont-sign-as-written");
      expect(flag.redLineMatch.id).toBe(raw.redLine);
    }
  });

  it("keeps the scripted Severity of a flag that matches no Red line", async () => {
    const result = await run();
    for (const raw of scriptFor(document).filter((f) => !f.redLine)) {
      const flag = result.riskFlags.find((f) => sameSources(f, raw.sourceSentences));
      expect(flag.severity).toBe(raw.severity);
      expect(flag.redLineMatch).toBeNull();
    }
  });

  it("shows Red line 4 with the statement that no cap appears, labelled Redline's judgment", async () => {
    const result = await run();
    const four = result.riskFlags.find((f) => f.redLineMatch?.id === "default-uncapped-liability");
    expect(four.sourceSentences).toHaveLength(2);
    expect(four.judgment).toMatchObject({ text: "No cap appears in the document.", isJudgment: true });
  });

  it.each(DEFAULT_RED_LINES.map((r) => [r.id]))("with %s left out, its clauses are no longer a Red line match", async (id) => {
    const adapter = recordingAdapter();
    const redLines = DEFAULT_RED_LINES.filter((r) => r.id !== id);
    const result = await review({ documentText, redLines, adapter });
    const left = DEFAULT_RED_LINES.find((r) => r.id === id);

    // The Red line is not sent to the model, and not listed as checked.
    const instructions = adapter.prompts[0].split("<document>")[0];
    expect(instructions).not.toContain(`"${id}"`);
    expect(instructions).not.toContain(left.catches);
    expect(result.redLinesChecked.map((r) => r.id)).not.toContain(id);
    // The clause is still flagged, but not as a match: it keeps the Severity the script gave it.
    for (const seed of seeds.filter((s) => s.redLine === id)) {
      const flag = result.riskFlags.find((f) => sameSources(f, seed.sentences));
      const raw = scriptFor(document).find((f) => f.sourceSentences.join(" ") === seed.sentences.join(" "));
      expect(flag.redLineMatch).toBeNull();
      expect(flag.severity).toBe(raw.severity);
    }
    // The other Red lines still match.
    for (const seed of seeds.filter((s) => s.redLine !== id)) {
      const flag = result.riskFlags.find((f) => sameSources(f, seed.sentences));
      expect(flag.redLineMatch.id).toBe(seed.redLine);
      expect(flag.severity).toBe("dont-sign-as-written");
    }
  });
});

describe("Review seam: Red line input and output", () => {
  const text = read("fixtures/contracts/vendor-agreement-02.txt");
  const sentence = "Processor can change any fee, or add a new fee, at any time by sending Merchant an email.";
  const flag = (extra) => ({
    severity: "know-this",
    title: "A clause",
    says: "The clause says this.",
    judgment: null,
    sourceSentences: [sentence],
    ...extra,
  });
  const runWith = (riskFlags, redLines = DEFAULT_RED_LINES) => {
    const prompts = [];
    const reply = JSON.stringify({ summary: "A summary.", riskFlags });
    const adapter = createFakeAdapter({ responses: [(p) => (prompts.push(p), reply)] });
    return review({ documentText: text, redLines, adapter }).then((result) => ({ result, prompt: prompts[0] }));
  };

  it("sends every Red line's id, name and what it catches to the model", async () => {
    const { prompt } = await runWith([]);
    for (const r of DEFAULT_RED_LINES) {
      expect(prompt).toContain(`"${r.id}"`);
      expect(prompt).toContain(r.name);
      expect(prompt).toContain(r.catches);
    }
  });

  it("lists the Red lines checked, in order, with their basis", async () => {
    const { result } = await runWith([]);
    expect(result.redLinesChecked).toEqual(
      DEFAULT_RED_LINES.map((r, i) => ({ id: r.id, number: i + 1, name: r.name, catches: r.catches, basis: { ...r.basis } })),
    );
  });

  it("lists no Red line as checked when the Risk flags could not be read", async () => {
    const adapter = createFakeAdapter({ responses: [JSON.stringify({ summary: "A summary." })] });
    const result = await review({ documentText: text, redLines: DEFAULT_RED_LINES, adapter });
    expect(result.riskFlagsStatus).toBe("unreadable-output");
    expect(result.redLinesChecked).toEqual([]);
  });

  it("names the matched Red line from the input, numbered by its place in the list", async () => {
    const { result } = await runWith([flag({ redLine: "default-one-sided-changes" })]);
    expect(result.riskFlags[0].redLineMatch).toEqual({
      id: "default-one-sided-changes",
      number: 3,
      name: "Counterparty can change terms or prices without the Owner's consent",
    });
  });

  it("ignores a Red line id that is not on the list, keeping the model's Severity", async () => {
    const { result } = await runWith([flag({ redLine: "made-up-red-line" })]);
    expect(result.riskFlags[0]).toMatchObject({ severity: "know-this", redLineMatch: null });
  });

  it("never marks a match when the Review input has no Red lines", async () => {
    const { result, prompt } = await runWith([flag({ redLine: "default-one-sided-changes" })], []);
    expect(result.riskFlags[0]).toMatchObject({ severity: "know-this", redLineMatch: null });
    expect(result.redLinesChecked).toEqual([]);
    for (const r of DEFAULT_RED_LINES) expect(prompt.split("<document>")[0]).not.toContain(r.catches);
  });

  it("withholds a flag whose redLine is not a string or null", async () => {
    const { result } = await runWith([flag({ redLine: 3 })]);
    expect(result.riskFlags).toEqual([]);
    expect(result.withheld).toEqual([{ reason: "unreadable" }]);
  });

  it("withholds a Red line match whose Source sentence fails the check, like any flag", async () => {
    const { result } = await runWith([
      flag({ redLine: "default-uncapped-liability", sourceSentences: [sentence, "Merchant's liability has no limit."] }),
    ]);
    expect(result.riskFlags).toEqual([]);
    expect(result.withheld).toEqual([{ reason: "source-not-found" }]);
  });

  it("rejects Red lines without an id or name, or with a repeated id, before calling the model", async () => {
    const adapter = createFakeAdapter({ responses: [] });
    for (const redLines of [null, [{ name: "No id" }], [{ id: "x" }], [{ id: "x", name: "A" }, { id: "x", name: "B" }], ["text"]]) {
      await expect(review({ documentText: text, redLines, adapter })).rejects.toMatchObject({ code: "bad-red-lines" });
      await expect(review({ documentText: text, redLines, adapter })).rejects.toBeInstanceOf(ReviewInputError);
    }
  });
});
