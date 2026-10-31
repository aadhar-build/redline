// Outside references through the Review seam (ticket 13, ADR 0007, spec-gaps 12, 13 and 26).
// Redline's own patterns find them in the stored text; each cites the whole sentence it came from,
// checked like any Source sentence. A reference blocks a Clean result until the Reviewer marks it as
// reviewed, and an "as amended from time to time" reference never stops blocking, because it matches
// Default Red line 3. cleanResultOf is called directly: the gate (clean-result-gate.js) still holds
// until ticket 07 lands.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import {
  findOutsideReferences,
  ONE_SIDED_CHANGES_ID,
  outsideReferenceCounterOffer,
  OUTSIDE_REFERENCE_KINDS,
  storedWithMark,
} from "../../lib/review/outside-references.js";
import { sentenceAt } from "../../lib/review/source-check.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { normalise } from "../../lib/review/normalise.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const doc1 = read("fixtures/contracts/outside-references-01.txt");
const doc2 = read("fixtures/contracts/outside-references-02.txt");

const SOW = "1.1 The Supplier will provide the services described in each Statement of Work signed by both parties.";
const WEB = "1.2 The Customer will use the services in line with the Supplier's acceptable use policy at https://brightline.example.com/aup.";
const ORDER = "1.3 The number of user seats is set out in the Order Form.";
const SCHEDULE_B = "1.4 The service levels in Schedule B apply to the services.";
const SOW2 = "1. The Provider will host the Customer's booking website on the plan named in the Statement of Work.";
const AMENDED = "2. The Customer will follow the Provider's hosting rules, as amended from time to time.";

async function noFlags(documentText, redLines = DEFAULT_RED_LINES, extra = {}) {
  const reply = JSON.stringify({ summary: "A summary.", riskFlags: [], ...extra });
  return review({ documentText, redLines, adapter: createFakeAdapter({ responses: [reply] }) });
}

const asRow = (r) => JSON.parse(JSON.stringify(toStoredReview(r)));
const sentences = (r) => r.outsideReferences.map((o) => o.sourceSentences[0].text);

// Marks references reviewed the way the mark route does: on the stored row, then reopen.
function markAndReopen(documentText, row, which, reviewed = true) {
  let current = reopenReview({ documentText, stored: row });
  let stored = row;
  for (const sentence of which) {
    const outside = storedWithMark(current.outsideReferences, sentence, reviewed, "2026-10-31T10:00:00.000Z");
    expect(outside).not.toBeNull();
    stored = { ...stored, outside_references: outside };
    current = reopenReview({ documentText, stored });
  }
  return { reopened: current, stored };
}

describe("finding Outside references", () => {
  it("raises each seeded kind with the whole referencing sentence as its Source sentence", () => {
    const { found, failed } = findOutsideReferences(doc1);
    expect(failed).toBe(0);
    expect(found.map((f) => f.sourceSentences[0].text)).toEqual([SOW, WEB, ORDER, SCHEDULE_B]);
    expect(found.map((f) => f.kinds)).toEqual([["statement-of-work"], ["web-address"], ["order-form"], ["schedule"]]);
    for (const f of found) {
      const s = f.sourceSentences[0];
      expect(doc1.slice(s.start, s.end)).toBe(s.text);
    }
  });

  it("does not raise a schedule the text includes, an email address, or the document naming itself", () => {
    const texts = findOutsideReferences(doc1).found.map((f) => f.sourceSentences[0].text);
    expect(texts.some((t) => t.includes("Schedule A"))).toBe(false);
    expect(texts.some((t) => t.includes("accounts@"))).toBe(false);
    const self = "This Statement of Work is part of the Master Agreement between the parties.\n\nThe work starts on 1 March.";
    expect(findOutsideReferences(self).found).toEqual([]);
  });

  it('finds terms "as amended from time to time", and only that wording', () => {
    expect(findOutsideReferences(doc2).found.map((f) => [f.sourceSentences[0].text, f.kinds])).toEqual([
      [SOW2, ["statement-of-work"]],
      [AMENDED, ["as-amended"]],
    ]);
    expect(findOutsideReferences("The rules apply as updated from time to time.").found).toEqual([]);
  });

  it("finds web addresses with a scheme, www. or a bare domain, but not emails or run-together sentences", () => {
    const kinds = (t) => findOutsideReferences(t).found.map((f) => f.kinds);
    expect(kinds("The terms at www.example.com apply.")).toEqual([["web-address"]]);
    expect(kinds("The terms at example.in/terms apply.")).toEqual([["web-address"]]);
    expect(kinds("Write to legal@example.com about notices.")).toEqual([]);
    expect(kinds("The fee is fixed.In the event of delay the fee stays the same.")).toEqual([]);
  });

  it("makes one reference of a sentence with several kinds, with as amended first", () => {
    const text = "The Customer will follow the Order Form and the rules at www.example.com, as amended from time to time.";
    const { found } = findOutsideReferences(text);
    expect(found).toHaveLength(1);
    expect(found[0].kinds).toEqual(["as-amended", "web-address", "order-form"]);
  });

  it("cites the whole sentence across wrapped lines, starting at its clause number", () => {
    const text = "4. Services\n4.1 The Supplier will deliver the services set out\nin the Statement of Work and nothing else.\n";
    const { found } = findOutsideReferences(text);
    expect(found.map((f) => f.sourceSentences[0].text)).toEqual([
      "4.1 The Supplier will deliver the services set out\nin the Statement of Work and nothing else.",
    ]);
  });

  it("sentenceAt fails closed when no boundary is in reach", () => {
    expect(sentenceAt("abc", 5)).toBeNull();
    const long = `${"word ".repeat(2000)}Order Form ${"word ".repeat(2000)}`;
    expect(sentenceAt(long, long.indexOf("Order"))).toBeNull();
  });

  it("withholds a reference it cannot cite, so it still blocks a Clean result", async () => {
    const filler = "the customer will pay the supplier for the work and ".repeat(150);
    const long = `Start. ${filler}the Order Form ${filler}end.`;
    const { found, failed } = findOutsideReferences(long);
    expect(found).toEqual([]);
    expect(failed).toBe(1);
    const r = await noFlags(long);
    expect(r.withheldCount).toBe(1);
    expect(r.withheld).toEqual([{ reason: "reference-not-citable" }]);
    expect(cleanResultOf(r)).toBe(false);
    // Saved without it, and counted once again on reopen.
    const row = asRow(r);
    expect(row.withheld).toEqual([]);
    expect(row.withheld_count).toBe(0);
    expect(reopenReview({ documentText: long, stored: row }).withheldCount).toBe(1);
  });
});

describe("Outside references in a review", () => {
  it("are Negotiate, with Redline's Counter-offer and no reviewed mark", async () => {
    const r = await noFlags(doc1);
    expect(r.riskFlags).toEqual([]);
    expect(sentences(r)).toEqual([SOW, WEB, ORDER, SCHEDULE_B]);
    for (const o of r.outsideReferences) {
      expect(o.severity).toBe("negotiate");
      expect(o.redLineMatch).toBeNull();
      expect(o.reviewed).toBeNull();
      expect(o.resolved).toBe(false);
      expect(o.counterOffer.text).toMatch(/as a schedule/);
      expect(o.counterOffer.text).toMatch(/written agreement of both parties/);
    }
    expect(r.outsideReferences.map((o) => o.number)).toEqual([1, 2, 3, 4]);
  });

  it('make an "as amended" reference Don\'t sign as written through Default Red line 3', async () => {
    const r = await noFlags(doc2);
    const amended = r.outsideReferences.find((o) => o.kinds.includes("as-amended"));
    expect(amended.severity).toBe("dont-sign-as-written");
    expect(amended.redLineMatch).toEqual({ id: ONE_SIDED_CHANGES_ID, number: 3, name: DEFAULT_RED_LINES[2].name });
    expect(amended.judgment.isJudgment).toBe(true);
  });

  it('leave an "as amended" reference at Negotiate when Red line 3 is not on the list', async () => {
    const r = await noFlags(doc2, DEFAULT_RED_LINES.filter((l) => l.id !== ONE_SIDED_CHANGES_ID));
    const amended = r.outsideReferences.find((o) => o.kinds.includes("as-amended"));
    expect(amended.severity).toBe("negotiate");
    expect(amended.redLineMatch).toBeNull();
  });

  it("use none of the banned hedge or verdict words in Redline's own text or Counter-offers", async () => {
    const all = [...(await noFlags(doc1)).outsideReferences, ...(await noFlags(doc2)).outsideReferences];
    for (const o of all) {
      for (const t of [o.title.text, o.says.text, o.judgment?.text ?? "", o.counterOffer.text]) {
        expect(findBannedWording(t)).toEqual([]);
      }
    }
    for (const kind of OUTSIDE_REFERENCE_KINDS) {
      expect(findBannedWording(outsideReferenceCounterOffer(kind, null))).toEqual([]);
      expect(findBannedWording(outsideReferenceCounterOffer(kind, "Schedule C"))).toEqual([]);
    }
  });

  it("take references the model adds, checked like any flag", async () => {
    const extra = "3.2 Either party can end this Agreement by giving the other thirty days' written notice.";
    const r = await noFlags(doc1, DEFAULT_RED_LINES, {
      outsideReferences: [{ sourceSentences: [extra] }, { sourceSentences: ["An invented sentence about a Master Agreement."] }, {}],
    });
    expect(sentences(r)).toContain(extra);
    expect(r.outsideReferences.find((o) => o.sourceSentences[0].text === extra).kinds).toEqual(["other"]);
    expect(r.withheld.map((w) => w.reason).sort()).toEqual(["no-source", "source-not-found"]);
    // A model reference that repeats one Redline found adds nothing.
    const again = await noFlags(doc1, DEFAULT_RED_LINES, { outsideReferences: [{ sourceSentences: [SOW] }] });
    expect(sentences(again)).toEqual([SOW, WEB, ORDER, SCHEDULE_B]);
  });

  it("leave the fixtures written before them unchanged, except the as amended sentence in vendor-agreement-03", async () => {
    const adapter = () => createLocalFakeAdapter({ root });
    for (const name of ["vendor-agreement-01", "vendor-agreement-02", "commercial-lease-01", "client-agreement-01", "licence-form-01", "clean-agreement-01", "marked-wording-01", "own-red-lines-01"]) {
      const text = read(`fixtures/contracts/${name}.txt`);
      expect(findOutsideReferences(text), name).toEqual({ found: [], failed: 0 });
    }
    const v3 = read("fixtures/contracts/vendor-agreement-03.txt");
    const r = await review({ documentText: v3, redLines: DEFAULT_RED_LINES, adapter: adapter() });
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity])).toEqual([[["as-amended"], "dont-sign-as-written"]]);
  });
});

describe("a no-flags review with Outside references and the Clean result (the gate's proving fixtures)", () => {
  it("is not a Clean result until every Statement of Work, web address and Order Form reference is marked reviewed", async () => {
    const r = await noFlags(doc1);
    expect(cleanResultOf(r)).toBe(false);
    // The gate still holds (ticket 07), so nothing reads as a Clean result yet.
    expect(r.cleanResult).toBeNull();
    expect(r.cleanResultHeld).toBe(false);

    const row = asRow(r);
    expect(row.outside_references.map((o) => o.source_sentence)).toEqual([SOW, WEB, ORDER, SCHEDULE_B]);
    expect(row.outside_references.every((o) => o.reviewed === false && o.reviewed_at === null)).toBe(true);

    // Marking all but one still blocks.
    const partly = markAndReopen(doc1, row, [SOW, WEB, ORDER]);
    expect(cleanResultOf(partly.reopened)).toBe(false);
    expect(partly.reopened.outsideReferences.filter((o) => o.resolved).map((o) => o.sourceSentences[0].text)).toEqual([SOW, WEB, ORDER]);

    const all = markAndReopen(doc1, row, [SOW, WEB, ORDER, SCHEDULE_B]);
    expect(cleanResultOf(all.reopened)).toBe(true);
    // Held back by the gate until ticket 07, and says so.
    expect(all.reopened.cleanResult).toBeNull();
    expect(all.reopened.cleanResultHeld).toBe(true);
    for (const o of all.reopened.outsideReferences) expect(o.reviewed).toEqual({ at: "2026-10-31T10:00:00.000Z" });

    // Taking a mark back blocks again.
    const undone = markAndReopen(doc1, all.stored, [WEB], false);
    expect(cleanResultOf(undone.reopened)).toBe(false);
  });

  it("is never a Clean result while an as amended reference stands, even with every reference marked reviewed", async () => {
    const r = await noFlags(doc2);
    expect(cleanResultOf(r)).toBe(false);
    const { reopened } = markAndReopen(doc2, asRow(r), [SOW2, AMENDED]);
    expect(reopened.outsideReferences.every((o) => o.reviewed !== null)).toBe(true);
    const amended = reopened.outsideReferences.find((o) => o.kinds.includes("as-amended"));
    expect(amended.resolved).toBe(false);
    expect(amended.severity).toBe("dont-sign-as-written");
    expect(cleanResultOf(reopened)).toBe(false);
    expect(reopened.cleanResultHeld).toBe(false);
  });

  it("a review whose resolved entries are of the wrong shape still blocks", () => {
    const base = { riskFlagsStatus: "checked", riskFlags: [], withheldCount: 0, ambiguousClauses: [] };
    expect(cleanResultOf({ ...base, outsideReferences: [{ resolved: "yes" }] })).toBe(false);
    expect(cleanResultOf({ ...base, outsideReferences: [{ reviewed: { at: "x" } }] })).toBe(false);
  });
});

describe("saved Outside references", () => {
  it("are stored as kinds, sentence text and the Reviewer's mark only, and rebuilt on reopen", async () => {
    const r = await noFlags(doc2);
    const row = asRow(r);
    for (const o of row.outside_references) expect(Object.keys(o).sort()).toEqual(["kinds", "reviewed", "reviewed_at", "source_sentence"]);
    const reopened = reopenReview({ documentText: doc2, stored: row });
    expect(reopened.outsideReferences).toEqual(r.outsideReferences);
  });

  it("are found again in a row saved before they were stored", async () => {
    const r = await noFlags(doc1);
    const { outside_references: _dropped, ...older } = asRow(r);
    const reopened = reopenReview({ documentText: doc1, stored: older });
    expect(sentences(reopened)).toEqual([SOW, WEB, ORDER, SCHEDULE_B]);
    expect(cleanResultOf(reopened)).toBe(false);
  });

  it("keep a stored reference the patterns no longer find, checked again, and withhold it if its sentence is gone", async () => {
    const r = await noFlags(doc1);
    const row = asRow(r);
    const extra = "3.1 This Agreement runs for twelve months from the date both parties sign it.";
    const withExtra = { ...row, outside_references: [...row.outside_references, { kinds: ["other"], source_sentence: extra, reviewed: false, reviewed_at: null }] };
    expect(sentences(reopenReview({ documentText: doc1, stored: withExtra }))).toContain(extra);
    const invented = { ...row, outside_references: [...row.outside_references, { kinds: ["other"], source_sentence: "Not in the contract.", reviewed: true, reviewed_at: "2026-10-31T10:00:00.000Z" }] };
    const reopened = reopenReview({ documentText: doc1, stored: invented });
    expect(reopened.withheldCount).toBe(1);
    expect(cleanResultOf(reopened)).toBe(false);
  });

  it("a mark on a sentence the review does not have changes nothing", async () => {
    const r = await noFlags(doc1);
    expect(storedWithMark(r.outsideReferences, "Some other sentence.", true, "2026-10-31T10:00:00.000Z")).toBeNull();
    expect(storedWithMark(r.outsideReferences, SOW, "yes", "2026-10-31T10:00:00.000Z")).toBeNull();
    // The sentence is matched after the ADR 0010 normalisations, so curly quotes still find it.
    expect(storedWithMark(r.outsideReferences, normalise(WEB).replace("'", "’"), true, "t")).not.toBeNull();
  });
});
