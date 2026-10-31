// Counter-offers (tickets 08 and 17): replacement wording for a flagged clause that the Reviewer can
// send to the Counterparty. Every flag gets one, Know this included (spec-gaps 04).
//
// The rules (product owner, 2026-10-31, spec-gaps 03):
// - A Counter-offer may only restate or tighten terms already in the document; it adds no term the
//   document does not contain. Code cannot check that, so the prompt states it and a person reads the
//   output (PRD criterion 17).
// - The hedge-word and verdict-word ban covers the proposed wording too, so "may" is not allowed
//   ("Customer is entitled to…", not "Customer may…"). Only the two context exemptions apply: "fine"
//   next to an amount and "May" the month. The usual excuse for text reproduced word for word from the
//   document does not apply here, because a Counter-offer is wording the Owner would sign: a "may"
//   copied from the document is still a "may" in the proposed clause. A breach is marked, like the
//   summary, never withheld.
// - A number the document does not contain is marked too (ticket 22's check). It is not withheld,
//   because tightening a term can legitimately change a figure. Whether a changed figure is closer to
//   the Owner's interest depends on the clause (a lower fee helps the Owner, a lower cap on the
//   Counterparty's liability hurts), so code does not judge it (QUESTIONS 24, settled by Fable advisor
//   2026-10-31). Only numbers written in digits are seen; "thirty days" in words is never marked.

// - Ticket 08b (final real run, 12 of 39 Counter-offers added terms): the prompt forbids new duties,
//   notice steps, cure periods, consent standards, return obligations and cross-references, and when
//   the only fix needs a term the document lacks the model sets "needsNewTerm" and names it in
//   "newTermNote". That note is shown as Redline's judgment, never as wording. As a backstop the code
//   marks, never withholds, each content word the document doesn't use (a word of 4+ letters, not a
//   stopword, whose stem is not among the document's stems, case-folded), plus "not unreasonably
//   withheld" and "the amount stated in this Agreement" style cross-references the document lacks.
//   Party names and defined terms come from the document, so they pass the stem test by themselves.

import { normalise } from "./normalise.js";
import { findBannedWording, findUnsupportedNumbers } from "./wording.js";

const STOPWORDS = new Set(
  ("about above after again against also among another any anything because been before being below between both " +
    "but cannot could does doing done down during each either else entitled even ever every from further have having hereby " +
    "herein hereof hereto here however into itself just last least less made make many more most much must neither " +
    "never next none nothing once only onto other others otherwise ours over same shall should since some such than " +
    "that their theirs them themselves then there thereby therefor therefore therein thereof thereto these they this " +
    "those though through thus till together under unless until upon very were what whatever when whenever where " +
    "whereas wherever whether which while whom whose will with within without would your yours")
    .split(" "),
);

const WORD_RE = /\p{L}[\p{L}'’-]*\p{L}|\p{L}/gu;

// A light suffix stemmer, applied the same way to both sides: one suffix off, then a final "e".
// Over-stemming only lowers false marks.
const SUFFIXES = [
  "ations", "ation", "ments", "ment", "ness", "ities", "ity", "ify", "ingly", "edly", "ings", "ing", "ies", "ied",
  "ions", "ion", "ably", "ibly", "able", "ible", "ally", "ly", "ers", "er", "ed", "s", "al",
];
export function stem(word) {
  let w = word.toLowerCase().replace(/['\u2019]s?$/, "");
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, w.length - suf.length) + (suf === "ies" || suf === "ied" ? "y" : "");
      break;
    }
  }
  if (w.endsWith("e") && w.length > 3) w = w.slice(0, -1);
  return w;
}

// A stem passes when the document has it, or a stem of 4+ letters that starts with it or that it
// starts with ("writ" and "written"), which covers most irregular forms.
function known(s, stems) {
  if (stems.set.has(s)) return true;
  if (s.length < 4) return false;
  for (let n = 4; n < s.length; n++) if (stems.set.has(s.slice(0, n))) return true;
  // Binary search for the first document stem at or after s; a match starts with s.
  const arr = stems.sorted;
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo < arr.length && arr[lo].startsWith(s);
}

function wordParts(word) {
  return word.split(/[-'’]/).filter(Boolean);
}

/** Every word stem in the document, for checkCounterOffer. */
export function documentStems(text) {
  const stems = new Set();
  for (const m of String(text ?? "").matchAll(WORD_RE)) {
    stems.add(stem(m[0]));
    for (const p of wordParts(m[0])) stems.add(stem(p));
  }
  return { set: stems, sorted: [...stems].sort() };
}

function isContentWord(word) {
  return word.length >= 4 && !STOPWORDS.has(word.toLowerCase());
}

function unsupportedWord(word, stems) {
  if (!isContentWord(word)) return false;
  if (known(stem(word), stems)) return false;
  const parts = wordParts(word);
  // A hyphenated word passes when each content part is in the document.
  return !(parts.length > 1 && parts.every((p) => !isContentWord(p) || known(stem(p), stems)));
}

// Phrases that add a term even when each word is in the document.
const NEW_TERM_PHRASES = [
  /not\s+(?:to\s+)?(?:be\s+)?unreasonably\s+(?:withheld|delayed|conditioned)(?:\s*(?:,|or|and)\s*(?:withheld|delayed|conditioned))*/giu,
  /(?:the\s+)?(?:amount|sum|fee|fees|price|rate|charges?|deposit|period|date|time)\s+(?:stated|specified|set\s+out|mentioned|provided|agreed|fixed|prescribed)\s+(?:in|under|by)\s+(?:this|the)\s+(?:Agreement|Deed|Contract|Lease|MoU|Memorandum)/giu,
];

/** Content words and new-term phrases in a Counter-offer that the document doesn't contain. */
export function findNewTerms(text, documentText) {
  const doc = String(documentText ?? "");
  if (doc.trim().length === 0) return [];
  const stems = documentStems(doc);
  const foldedDoc = normalise(doc).toLowerCase();
  const spans = [];
  for (const re of NEW_TERM_PHRASES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (!foldedDoc.includes(normalise(m[0]).toLowerCase())) spans.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  const words = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    if (unsupportedWord(m[0], stems)) words.push({ start, end });
  }
  // Neighbouring words with only spaces or hyphens between them form one phrase.
  for (const w of words) {
    const last = spans.length > 0 ? spans[spans.length - 1] : null;
    if (last && last.end <= w.start && /^[\s-]*$/.test(text.slice(last.end, w.start)) && !last.phrase) last.end = w.end;
    else spans.push({ ...w });
  }
  return spans
    .map((s) => ({ phrase: text.slice(s.start, s.end), start: s.start, end: s.end, kind: "new-term" }))
    .sort((a, b) => a.start - b.start);
}

function readNote(needsNewTerm, note) {
  if (needsNewTerm !== true || typeof note !== "string") return null;
  const t = note.trim().replace(/^the\s+(?:document|contract|agreement)\s+has\s+no\s+/i, "").replace(/[.\s]+$/, "");
  if (t.length === 0) return null;
  return { text: t, marked: findBannedWording(t).map((h) => ({ phrase: h.phrase, start: h.index, end: h.index + h.match.length })) };
}

/**
 * Checks a Counter-offer's wording. Returns null when there is none to show.
 * @param {unknown} raw the model's (or the stored) Counter-offer text
 * @param {Set<string>} numbers the document's numbers, from documentNumbers
 * @param {{ documentText?: string, needsNewTerm?: unknown, newTermNote?: unknown }} [options]
 *   documentText: the cited text, for the new-term marks. needsNewTerm and newTermNote: the model's
 *   flag and its note naming the term the document lacks; shown as Redline's judgment.
 * @returns {{ text: string, marked: { phrase: string, start: number, end: number, kind?: "number" | "new-term" }[], newTermNote: { text: string, marked: object[] } | null } | null}
 */
export function checkCounterOffer(raw, numbers, { documentText = "", needsNewTerm = false, newTermNote = null } = {}) {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const text = raw.trim();
  // No documentText for the hedge check: nothing is excused for being in the document (see above).
  const marked = findBannedWording(text).map((h) => ({ phrase: h.phrase, start: h.index, end: h.index + h.match.length }));
  for (const n of findUnsupportedNumbers(text, numbers)) {
    marked.push({ phrase: n.match, kind: "number", start: n.index, end: n.index + n.match.length });
  }
  for (const t of findNewTerms(text, documentText)) {
    if (!marked.some((m) => t.start < m.end && t.end > m.start)) marked.push(t);
  }
  marked.sort((a, b) => a.start - b.start);
  return { text, marked, newTermNote: readNote(needsNewTerm, newTermNote) };
}

/** The prompt lines for the "counterOffer" field. ownerParty: the Owner's term when the Reviewer fixed it. */
export function counterOfferPromptPart(ownerParty = null) {
  const side = ownerParty ? `${ownerParty} (the Owner)` : 'the Owner, the party you give as "ownerParty"';
  return [
    `- "counterOffer": replacement wording for the clause that the Reviewer can send to the Counterparty. Every flag gets one, "know-this" included. It protects ${side}. Write it as the clause the Owner would sign, not as advice and not as a quote of the original clause.`,
    "- A Counter-offer only restates or tightens terms already in the document. Add no term, party, right, duty, amount or period that the document does not contain.",
    "- A Counter-offer is allowed to: delete words from the clause, narrow a right the document gives, cap or shorten an amount, period or scope the document already states, or restate the clause more plainly.",
    '- A Counter-offer never adds: a new duty or obligation on either party, a notice step, a cure period, a consent standard such as "not unreasonably withheld", a refund, return or repayment obligation, a carve-out or exception, an evidence requirement, a cross-reference such as "the amount stated in this Agreement" to anything the document does not actually state, or any other term the document does not contain. Use only words, figures and defined terms that appear in the document wherever you can.',
    '- "needsNewTerm" and "newTermNote": when the only fix that protects the Owner needs a term the document does not contain, the "counterOffer" still restates and tightens the clause as far as the document allows, without that term; set "needsNewTerm" to true and give "newTermNote", a short noun phrase naming the missing term, such as "cure period before termination". Otherwise "needsNewTerm" is false and "newTermNote" is null.',
    '- Never use "may" or any other word from the banned list below in a Counter-offer, even where contracts usually say "may". Write "Customer is entitled to terminate", not "Customer may terminate".',
  ];
}
