// The Fable advisor's rulings on Outside references (QUESTIONS.md 27 to 31, settled 2026-10-31).
// 27: a statute "as amended" is no reference. 28: other wordings of "as amended". 29: Default Red line 3
// matches only in its original wording. 30: one reference per referenced document. 31: a model flag that
// only repeats a Red line 3 reference is merged into it.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { forReview, redLineFromRow } from "../../lib/library/red-lines.js";
import { reopenReview, toStoredReview } from "../../lib/review/saved.js";
import {
  buildOutsideReference,
  findOutsideReferences,
  mergeIntoOutsideReferences,
  ONE_SIDED_CHANGES_ID,
  storedWithMark,
  webAddressKey,
} from "../../lib/review/outside-references.js";
import { findBannedWording } from "../../lib/review/wording.js";

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const AT = "2026-10-31T10:00:00.000Z";
const own = (text, opts = {}) => ({ text, marked: [], isJudgment: Boolean(opts.alwaysJudgment) });
const asRow = (r) => JSON.parse(JSON.stringify(toStoredReview(r)));
const RL3 = DEFAULT_RED_LINES[2];
const numbered = (lines) => lines.map((r, i) => ({ ...r, number: i + 1 }));

async function withFlags(documentText, riskFlags = [], redLines = DEFAULT_RED_LINES) {
  const reply = JSON.stringify({ summary: "A summary.", riskFlags });
  return review({ documentText, redLines, adapter: createFakeAdapter({ responses: [reply] }) });
}

// Marks a reference reviewed the way the mark route does: on the stored row, then reopen.
function mark(documentText, row, sentence) {
  const current = reopenReview({ documentText, stored: row });
  const outside = storedWithMark(current.outsideReferences, sentence, true, AT);
  expect(outside).not.toBeNull();
  const stored = { ...row, outside_references: outside };
  return { stored, reopened: reopenReview({ documentText, stored }) };
}

const kindsOf = (text) => findOutsideReferences(text).found.map((f) => f.kinds);

describe("29: Default Red line 3 matches only in its original wording", () => {
  const AMENDED = "2. The Customer will follow the Provider's hosting rules, as amended from time to time.";
  const found = { kinds: ["as-amended"], sourceSentences: [{ text: AMENDED, start: 0, end: AMENDED.length }] };

  it("with its catches: Don't sign as written, and still unresolved after marking", async () => {
    const ref = buildOutsideReference(found, numbered(DEFAULT_RED_LINES), { at: AT }, own);
    expect(ref.severity).toBe("dont-sign-as-written");
    expect(ref.redLineMatch).toMatchObject({ id: ONE_SIDED_CHANGES_ID, number: 3 });
    expect(ref.resolved).toBe(false);

    const r = await withFlags(AMENDED);
    const { reopened } = mark(AMENDED, asRow(r), AMENDED);
    expect(reopened.outsideReferences[0].resolved).toBe(false);
    expect(cleanResultOf(reopened)).toBe(false);
  });

  it("reworded (catches null) or removed: Negotiate, no Red line match, and marking resolves it", async () => {
    const reworded = DEFAULT_RED_LINES.map((r) => (r.id === ONE_SIDED_CHANGES_ID ? { ...r, name: "No price rises in year one", catches: null } : r));
    const removed = DEFAULT_RED_LINES.filter((r) => r.id !== ONE_SIDED_CHANGES_ID);
    for (const lines of [reworded, removed]) {
      const ref = buildOutsideReference(found, numbered(lines), null, own);
      expect(ref.severity).toBe("negotiate");
      expect(ref.redLineMatch).toBeNull();
      const r = await withFlags(AMENDED, [], lines);
      expect(r.outsideReferences[0].redLineMatch).toBeNull();
      const { reopened } = mark(AMENDED, asRow(r), AMENDED);
      expect(reopened.outsideReferences[0].resolved).toBe(true);
    }
  });

  it("a trailing full stop on the name is no rewording, through forReview", async () => {
    const row = { id: "row-3", default_number: 3, text: `${RL3.name}.` };
    const lines = forReview([redLineFromRow(row)]);
    expect(lines[0].catches).toBe(RL3.catches);
    const r = await withFlags(AMENDED, [], lines);
    expect(r.outsideReferences[0].severity).toBe("dont-sign-as-written");
    expect(r.outsideReferences[0].redLineMatch).toMatchObject({ id: ONE_SIDED_CHANGES_ID });
  });

  it("cleanResultOf: no flags and one as amended sentence with Red line 3 reworded is Clean once marked", async () => {
    const reworded = forReview([redLineFromRow({ id: "row-3", default_number: 3, text: "No price rises in year one" })]);
    expect(reworded[0].catches).toBeNull();
    const r = await withFlags(AMENDED, [], reworded);
    expect(cleanResultOf(r)).toBe(false);
    const { reopened } = mark(AMENDED, asRow(r), AMENDED);
    expect(cleanResultOf(reopened)).toBe(true);
  });

  it("the review prompt names Red line 3's statute and merge rules only when it is on the list", async () => {
    const prompts = [];
    const adapter = { complete: async (p) => (prompts.push(p), JSON.stringify({ summary: "A summary.", riskFlags: [] })) };
    await review({ documentText: AMENDED, redLines: DEFAULT_RED_LINES, adapter });
    await review({ documentText: AMENDED, redLines: DEFAULT_RED_LINES.filter((r) => r.id !== ONE_SIDED_CHANGES_ID), adapter });
    expect(prompts[0]).toMatch(/Redline raises Outside references itself/);
    expect(prompts[0]).toMatch(/Parliament/);
    expect(prompts[1]).not.toMatch(/Parliament/);
  });
});

describe("27: a statute as amended is not a reference", () => {
  it.each([
    "1. The Licensee will vacate under the Public Premises (Eviction of Unauthorised Occupants) Act 1971, as amended from time to time.",
    "2. This Agreement is governed by the Indian Contract Act, 1872 (as amended from time to time).",
    "3. Each party will follow the Information Technology Rules, 2011, as amended from time to time.",
    '4. The Arbitration and Conciliation Act, 1996 (the "Act"), as amended from time to time, applies.',
    "5. The Shops and Establishments Act of 1948, as amended from time to time, applies.",
  ])("excludes %s", (text) => {
    expect(findOutsideReferences(text)).toEqual({ found: [], failed: 0 });
  });

  it.each([
    "1. The Customer will follow the Provider's Rules, as amended from time to time.",
    "2. The Customer will follow the Act and the Provider's policies, as amended from time to time.",
    "3. The Customer will comply with the Shops Act, as amended from time to time.",
  ])("still flags %s", (text) => {
    expect(kindsOf(text)).toEqual([["as-amended"]]);
  });

  it("a sentence with a statute and a non-statute as amended gives one reference", () => {
    const text = "1. The Customer will follow the Companies Act, 2013, as amended from time to time, and the Provider's rules, as amended from time to time.";
    const { found } = findOutsideReferences(text);
    expect(found).toHaveLength(1);
    expect(found[0].kinds).toEqual(["as-amended"]);
  });
});

describe("28: other wordings of as amended", () => {
  it.each([
    ["The Customer will follow the Provider's rules, as updated from time to time.", "as updated from time to time"],
    ["The Customer will follow the Provider's rules, as may be amended or replaced from time to time.", "as may be amended or replaced from time to time"],
    ["The Customer will follow the Provider's rules as in force from time to time.", "as in force from time to time"],
    ["The Customer will follow the rules as published by the Provider from time to time.", "as published by the Provider from time to time"],
    ["The Customer will follow the Provider's then-current terms.", "then-current"],
    ["The current version of the Provider's policy applies.", "current version"],
  ])("finds %s", (text, phrase) => {
    const { found } = findOutsideReferences(text);
    expect(found.map((f) => f.kinds)).toEqual([["as-amended"]]);
    expect(found[0].labels).toEqual([phrase]);
  });

  it.each([
    "The Provider will review the rules from time to time.",
    "The parties will meet from time to time.",
    "The current version of this Agreement replaces the last one.",
    "The Provider will publish the rules, as it sees fit, from time to time.",
    "The Customer will follow the Provider's then current practice.",
    "The rules are amended from time to time.",
  ])("does not find %s", (text) => {
    expect(findOutsideReferences(text).found).toEqual([]);
  });

  it("then-current terms at a web address is both kinds, at Don't sign as written", async () => {
    const text = "1. The Customer will follow the then-current terms at www.example.com.";
    expect(kindsOf(text)).toEqual([["as-amended", "web-address"]]);
    const r = await withFlags(text);
    expect(r.outsideReferences.map((o) => [o.kinds, o.severity])).toEqual([[["as-amended", "web-address"], "dont-sign-as-written"]]);
  });

  it("quotes the matched words in its copy, with no banned words of its own", async () => {
    const text = "1. The Customer will follow the Provider's rules, as may be amended from time to time.";
    const r = await withFlags(text);
    const ref = r.outsideReferences[0];
    expect(ref.title.text).toBe('Terms "as may be amended from time to time"');
    expect(ref.says.text).toContain('"as may be amended from time to time"');
    // The only hedge word is inside the quoted document wording.
    const outsideQuote = (t) => t.replace(/"[^"]*"/g, '""');
    for (const t of [ref.title.text, ref.says.text, ref.counterOffer.text]) expect(findBannedWording(outsideQuote(t))).toEqual([]);
  });

  it("the statute exclusion covers every form", () => {
    expect(findOutsideReferences("1. The Companies Act, 2013, as updated from time to time, applies.").found).toEqual([]);
    expect(findOutsideReferences("1. The Companies Act, 2013 as in force from time to time applies.").found).toEqual([]);
  });
});

describe("30: one reference per referenced document", () => {
  it("five Statement of Work sentences are one reference with five sentences, in order", async () => {
    const lines = [1, 2, 3, 4, 5].map((i) => `${i}.1 The Supplier will deliver item ${i} as set out in the Statement of Work.`);
    const text = lines.join("\n");
    const { found } = findOutsideReferences(text);
    expect(found).toHaveLength(1);
    expect(found[0].sourceSentences.map((s) => s.text)).toEqual(lines);
    const r = await withFlags(text);
    expect(r.outsideReferences).toHaveLength(1);
    expect(r.outsideReferences[0].title.text).toBe("Terms in a Statement of Work (5 sentences)");
    expect(r.outsideReferences[0].says.text).toMatch(/^These sentences bring/);
  });

  it("www.example.com/terms and https://example.com/terms are one; /terms and /privacy are two", () => {
    expect(webAddressKey("https://Example.com/terms/")).toBe("example.com/terms");
    const one = "1. The terms at www.example.com/terms apply.\n2. Refunds follow https://example.com/terms.";
    expect(findOutsideReferences(one).found.map((f) => f.sourceSentences.length)).toEqual([2]);
    const two = "1. The terms at www.example.com/terms apply.\n2. Data is handled under www.example.com/privacy.";
    expect(findOutsideReferences(two).found.map((f) => f.label)).toEqual(["www.example.com/terms", "www.example.com/privacy"]);
  });

  it("an Order Form, an Order Form as amended and a plain Order Form are one reference at Don't sign as written", async () => {
    const text = [
      "1. The seats are listed in the Order Form.",
      "2. The fees are in the Order Form, as amended from time to time.",
      "3. The term starts on the date in the Order Form.",
    ].join("\n");
    const r = await withFlags(text);
    expect(r.outsideReferences).toHaveLength(1);
    const ref = r.outsideReferences[0];
    expect(ref.kinds).toEqual(["as-amended", "order-form"]);
    expect(ref.severity).toBe("dont-sign-as-written");
    expect(ref.sourceSentences).toHaveLength(3);
    expect(ref.title.text).toBe("Terms in an Order Form (3 sentences)");
    expect(ref.says.text).toContain('One of these sentences applies terms "as amended from time to time"');
  });

  it("as amended in a sentence naming no document is its own reference, one per sentence", () => {
    const text = "1. The rules apply as amended from time to time.\n2. The fees apply as revised from time to time.";
    expect(findOutsideReferences(text).found.map((f) => f.sourceSentences.length)).toEqual([1, 1]);
  });

  it("marking resolves all of a group's sentences, and the mark is stored once per group", async () => {
    const lines = [1, 2, 3].map((i) => `${i}.1 The Supplier will deliver item ${i} as set out in the Statement of Work.`);
    const text = lines.join("\n");
    const r = await withFlags(text);
    const row = asRow(r);
    expect(row.outside_references).toEqual([
      { kinds: ["statement-of-work"], label: "Statement of Work", source_sentences: lines, reviewed: false, reviewed_at: null },
    ]);
    // Any one of its sentences names the group.
    const { reopened, stored } = mark(text, row, lines[2]);
    expect(stored.outside_references).toHaveLength(1);
    expect(stored.outside_references[0].reviewed).toBe(true);
    expect(reopened.outsideReferences[0].resolved).toBe(true);
    expect(cleanResultOf(reopened)).toBe(true);
  });

  it("a key tells apart two references that share a sentence", async () => {
    const text = "1. The Customer will follow the Order Form and the rules at www.example.com.";
    const r = await withFlags(text);
    expect(r.outsideReferences.map((o) => o.key)).toEqual(["order-form", "web-address:example.com"]);
    const outside = storedWithMark(r.outsideReferences, text, true, AT, "web-address:example.com");
    expect(outside.map((o) => o.reviewed)).toEqual([false, true]);
  });

  it("on reopen a group keeps its mark while one sentence passes, and lists only the ones that pass", () => {
    const text = "1. The seats are listed in the Order Form.";
    const stored = {
      summary: "A summary.",
      flags: [],
      withheld: [],
      withheld_count: 0,
      red_lines: [],
      outside_references: [
        { kinds: ["order-form"], label: "Order Form", source_sentences: [text, "2. Gone from the contract, in the Order Form."], reviewed: true, reviewed_at: AT },
      ],
    };
    const reopened = reopenReview({ documentText: text, stored });
    expect(reopened.outsideReferences).toHaveLength(1);
    expect(reopened.outsideReferences[0].sourceSentences.map((s) => s.text)).toEqual([text]);
    expect(reopened.outsideReferences[0].reviewed).toEqual({ at: AT });

    // A stored group the patterns no longer find keeps only its passing sentences too.
    const other = "3. Fees follow the price list held by the Supplier.";
    const kept = reopenReview({
      documentText: other,
      stored: { ...stored, outside_references: [{ kinds: ["other"], label: null, source_sentences: [other, "Invented."], reviewed: true, reviewed_at: AT }] },
    });
    expect(kept.outsideReferences[0].sourceSentences.map((s) => s.text)).toEqual([other]);
    expect(kept.outsideReferences[0].reviewed).toEqual({ at: AT });
  });
});

describe("31: a model flag that only repeats an Outside reference is merged", () => {
  const v3 = read("fixtures/contracts/vendor-agreement-03.txt");
  const CHARGES = "Merchant will pay a fee of 1.8% of each card sale and a machine rental of Rs. 450 a month, both as amended from time to time by Provider.";

  it("vendor-agreement-03 shows the as amended sentence once, with mergedCount 1", async () => {
    const r = await review({ documentText: v3, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    expect(r.mergedCount).toBe(1);
    expect(r.withheldCount).toBe(0);
    const cites = (f) => f.sourceSentences.some((s) => s.text.includes(CHARGES));
    expect(r.riskFlags.filter(cites)).toEqual([]);
    expect(r.outsideReferences.filter(cites)).toHaveLength(1);
    expect(r.riskFlags.map((f) => f.number)).toEqual(r.riskFlags.map((_, i) => i + 1));
    // Not stored, and the reopened review shows it once too.
    const row = asRow(r);
    expect(row.flags.some((f) => f.source_sentences.some((t) => t.includes(CHARGES)))).toBe(false);
    const reopened = reopenReview({ documentText: v3, stored: row });
    expect(reopened.riskFlags.filter(cites)).toEqual([]);
    expect(reopened.outsideReferences.filter(cites)).toHaveLength(1);
  });

  it("re-applies the merge on reopen of a row that stored the flag", async () => {
    const r = await review({ documentText: v3, redLines: DEFAULT_RED_LINES, adapter: createLocalFakeAdapter({ root }) });
    const row = asRow(r);
    const older = {
      ...row,
      flags: [...row.flags, { severity: "dont-sign-as-written", title: "Charges", says: "The charges change.", judgment: null, source_sentences: [CHARGES], red_line: ONE_SIDED_CHANGES_ID, counter_offer: null, readings: null }],
    };
    const reopened = reopenReview({ documentText: v3, stored: older });
    expect(reopened.mergedCount).toBe(1);
    expect(reopened.riskFlags).toHaveLength(r.riskFlags.length);
  });

  const AMENDED = "2. The Customer will follow the Provider's hosting rules, as amended from time to time.";
  const OTHER = "3. The Provider can end the service on one day's notice.";
  const WEB = "4. The Customer will follow the terms at www.example.com.";
  const text = ["1. The Provider hosts the Customer's website.", AMENDED, OTHER, WEB].join("\n");
  const flag = (over) => ({ severity: "dont-sign-as-written", title: "Changes", says: "The rules change.", judgment: null, sourceSentences: [AMENDED], redLine: ONE_SIDED_CHANGES_ID, counterOffer: null, ...over });

  it("merges a flag on the same Red line citing only the reference's sentences", async () => {
    const r = await withFlags(text, [flag()]);
    expect(r.mergedCount).toBe(1);
    expect(r.riskFlags).toEqual([]);
    expect(r.withheldCount).toBe(0);
  });

  it("keeps a flag citing one extra sentence", async () => {
    const r = await withFlags(text, [flag({ sourceSentences: [AMENDED, OTHER] })]);
    expect(r.mergedCount).toBe(0);
    expect(r.riskFlags).toHaveLength(1);
  });

  it("keeps a flag matching a different Red line", async () => {
    const r = await withFlags(text, [flag({ redLine: "default-uncapped-liability" })]);
    expect(r.mergedCount).toBe(0);
    expect(r.riskFlags).toHaveLength(1);
  });

  it("keeps a Know this flag on a web-address sentence", async () => {
    const r = await withFlags(text, [flag({ severity: "know-this", sourceSentences: [WEB], redLine: null })]);
    expect(r.mergedCount).toBe(0);
    expect(r.riskFlags).toHaveLength(1);
  });

  it("never turns a non-Clean result into Clean", async () => {
    const r = await withFlags(text, [flag()]);
    expect(cleanResultOf(r)).toBe(false);
    let row = asRow(r);
    for (const o of r.outsideReferences) row = mark(text, row, o.sourceSentences[0].text).stored;
    expect(cleanResultOf(reopenReview({ documentText: text, stored: row }))).toBe(false);
    // Directly: a reference without a Red line match merges nothing.
    const unmatched = r.outsideReferences.map((o) => ({ ...o, redLineMatch: null }));
    const kept = mergeIntoOutsideReferences([{ redLineMatch: { id: ONE_SIDED_CHANGES_ID }, sourceSentences: [{ text: AMENDED }] }], unmatched);
    expect(kept.mergedCount).toBe(0);
  });
});
