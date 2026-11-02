// Copy all as text (ticket 20): the text builder, one section at a time, and that nothing the screen
// does not show is copied. Reviews come from the scripted fixtures through the real Review seam.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { review } from "../../lib/review/review.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import { COPY } from "../../app/(app)/review/copy.js";
import { bracketMarks, reviewAsText } from "../../app/(app)/review/review-text.js";

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const run = (name, redLines = DEFAULT_RED_LINES) =>
  review({ documentText: read(`fixtures/contracts/${name}.txt`), redLines, adapter: createLocalFakeAdapter({ root }) });

describe("reviewAsText", () => {
  it("brackets a Counter-offer's new-term marks, adds their note, and copies the needsNewTerm note as Redline's judgment (ticket 08b)", async () => {
    const r = await run("counter-offers-01");
    const f = r.riskFlags.find((x) => x.counterOffer?.marked.some((m) => m.kind === "new-term"));
    expect(f).toBeTruthy();
    const withNote = { ...r, riskFlags: r.riskFlags.map((x) => (x === f ? { ...x, counterOffer: { ...x.counterOffer, newTermNote: { text: "cure period", marked: [] } } } : x)) };
    const text = reviewAsText(withNote);
    expect(text).toContain(bracketMarks(f.counterOffer.text, f.counterOffer.marked));
    expect(text).toContain(COPY.counterOffer.newTermNote);
    expect(text).toContain(`${COPY.counterOffer.needsNewTerm.lead}cure period${COPY.counterOffer.needsNewTerm.tail}`);
    expect(COPY.counterOffer.needsNewTerm.lead.startsWith(COPY.flags.judgmentLabel)).toBe(true);
  });

  it("summary: caption, summary text, the note, in screen order", async () => {
    const r = await run("vendor-agreement-01");
    const text = reviewAsText(r);
    const i = [COPY.summaryCaption, r.summary.text, COPY.summaryNote].map((s) => text.indexOf(s));
    expect(i.every((n) => n >= 0)).toBe(true);
    expect([...i].sort((a, b) => a - b)).toEqual(i);
  });

  it("template note and Owner line when present", async () => {
    const r = await run("licence-form-01");
    const text = reviewAsText({ ...r, template: true, ownerParty: { term: "the Licensee", fixed: false } });
    expect(text).toContain(COPY.templateNote);
    expect(text).toContain(`${COPY.owner.label} the Licensee`);
    expect(reviewAsText({ ...r, template: false, ownerParty: null })).not.toContain(COPY.owner.unknown);
    expect(reviewAsText({ ...r, ownerParty: null }, { ownerUnknownShown: true })).toContain(COPY.owner.unknown);
  });

  it("flags: grouped by Severity, each with its Source sentence word for word and its Counter-offer", async () => {
    const r = await run("vendor-agreement-01");
    const text = reviewAsText(r);
    for (const f of r.riskFlags) {
      const at = text.indexOf(`${f.number}. `);
      expect(at).toBeGreaterThan(-1);
      for (const s of f.sourceSentences) expect(text).toContain(`"${s.text}"`);
      if (f.counterOffer) expect(text).toContain(bracketMarks(f.counterOffer.text, f.counterOffer.marked));
    }
    const groups = ["Don't sign as written (", "Negotiate (", "Know this ("].map((g) => text.indexOf(g));
    expect([...groups].sort((a, b) => a - b)).toEqual(groups);
  });

  it("Red line match and Redline's judgment labels", async () => {
    const r = await run("commercial-lease-01");
    const text = reviewAsText(r);
    const matched = r.riskFlags.find((f) => f.redLineMatch);
    expect(text).toContain(`${COPY.flags.redLineMatchLabel}: ${COPY.flags.redLineMatched(matched.redLineMatch.number, matched.redLineMatch.name)}`);
    const judged = r.riskFlags.find((f) => f.judgment);
    expect(text).toContain(`${COPY.flags.judgmentLabel}: ${judged.judgment.text}`);
    expect(matched && judged).toBeTruthy();
  });

  it("Ambiguous clause: each reading in order, after what the clause says, before the Counter-offer", async () => {
    const r = await run("ambiguous-clauses-01");
    const flag = r.riskFlags.find((f) => f.readings);
    const text = reviewAsText(r);
    const block = text.slice(text.indexOf(`${flag.number}. `));
    const says = block.indexOf(flag.says.text);
    const readings = flag.readings.map((x, i) => block.indexOf(`${COPY.ambiguous.readingCaption(i + 1, flag.readings.length)}: ${x.text}`));
    const counter = block.indexOf(COPY.counterOffer.caption);
    expect(says).toBeGreaterThan(-1);
    expect([says, ...readings, counter]).toEqual([says, ...readings, counter].slice().sort((a, b) => a - b));
  });

  it("marked words and numbers stay visible in square brackets, with the key line", () => {
    expect(bracketMarks("You may pay 40 days.", [{ start: 4, end: 7 }, { start: 12, end: 14, kind: "number" }])).toBe("You [may] pay [40] days.");
    const r = { summary: { text: "You may sign.", marked: [{ start: 4, end: 7 }] }, riskFlagsStatus: "checked", riskFlags: [], withheldCount: 0 };
    const text = reviewAsText(r);
    expect(text.startsWith(COPY.copyAll.bracketKey)).toBe(true);
    expect(text).toContain("You [may] sign.");
    expect(text).toContain(COPY.markedNote);
  });

  it("withheld count, without the withheld flags", async () => {
    const r = await run("vendor-agreement-01");
    expect(r.withheldCount).toBeGreaterThan(0);
    const text = reviewAsText(r);
    expect(text).toContain(COPY.flags.withheldTitle(r.withheldCount));
    const scripted = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags;
    for (const s of scripted.slice(6)) expect(text).not.toContain(s.counterOffer);
  });

  it("Outside references with their reviewed state", async () => {
    const r = await run("outside-references-01");
    expect(r.outsideReferences.length).toBeGreaterThan(0);
    const text = reviewAsText(r);
    expect(text).toContain(`${COPY.outside.title} (${r.outsideReferences.length})`);
    expect(text).toContain(COPY.outside.notReviewedTag);
    const marked = { ...r, outsideReferences: r.outsideReferences.map((x) => ({ ...x, reviewed: { at: "2026-10-31T10:00:00Z" } })) };
    expect(reviewAsText(marked)).toContain(COPY.outside.reviewedTag);
  });

  it("Clean result: the plain statement and every Red line checked", async () => {
    const r = await run("clean-agreement-01");
    expect(r.cleanResult).toBe(true);
    const text = reviewAsText(r);
    expect(text).toContain(COPY.clean.statement);
    for (const l of r.redLinesChecked) expect(text).toContain(`${l.number}. ${l.name}`);
  });

  it("an unreadable review copies only the message the screen shows", () => {
    const text = reviewAsText({ summary: { text: "S." }, riskFlagsStatus: "unreadable", riskFlags: [{ secret: "x" }] });
    expect(text).toContain(COPY.flags.unreadable);
    expect(text).not.toContain(COPY.flags.severityNote);
  });

  it("copies nothing that is not displayed: no raw model fields, no stored text beyond the sentences", async () => {
    const r = await run("vendor-agreement-01");
    const planted = {
      ...r,
      documentText: "PLANTED-DOCUMENT",
      withheld: (r.withheld ?? []).map((w) => ({ ...w, counterOffer: "PLANTED-WITHHELD", title: "PLANTED-WITHHELD" })),
      riskFlags: r.riskFlags.map((f) => ({ ...f, rawQuote: "PLANTED-RAW", modelSeverity: "PLANTED-SEV", sourceSentences: f.sourceSentences.map((s) => ({ ...s, modelText: "PLANTED-RAW" })) })),
    };
    expect(reviewAsText(planted)).not.toMatch(/PLANTED/);
  });

  it("a reopened saved review copies the same text as the fresh one", async () => {
    const documentText = read("fixtures/contracts/vendor-agreement-01.txt");
    const r = await run("vendor-agreement-01");
    const reopened = reopenReview({ documentText, stored: toStoredReview(r) });
    const strip = (x) => ({ ...x, ownerParty: null });
    expect(reviewAsText(strip(reopened.review ?? reopened))).toBe(reviewAsText(strip(r)));
  });
});

describe("Copy all: the scanned-pages note (ticket 23)", () => {
  const base = { summary: { status: "shown", text: "A short summary.", marked: [] }, riskFlagsStatus: "checked", riskFlags: [], outsideReferences: [], withheld: [], withheldCount: 0 };

  it("copies the note exactly as the screen shows it, before the summary", () => {
    const scanned = { pages: [2, 3], pageCount: 12 };
    const text = reviewAsText({ ...base, scanned });
    const note = COPY.scannedNote(scanned);
    expect(text).toContain(note);
    expect(text.indexOf(note)).toBeLessThan(text.indexOf("A short summary."));
  });

  it("copies no note when no page came from a scan", () => {
    expect(reviewAsText({ ...base, scanned: null })).not.toContain(COPY.scannedNote({ pages: [1], pageCount: 1 }).split(" ")[0] + " read");
  });
});
