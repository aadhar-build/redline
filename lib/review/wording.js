// The hedge-word and verdict-word check (ADR 0005, ADR 0006, PRD section 4 criterion 8).
//
// Redline's own text may not contain these words or phrases, matched whole-word and case-insensitive.
// Text reproduced word for word from the document is excluded: a hit is excused only when the
// quoted span or the sentence that contains it is found in the document text, after the ADR 0010
// normalisations. A bare quoted word is not excused, so quoting "may" on its own still counts.
// Two words are also exempt by context: "fine" next to an amount, and "May" the month (see below).

import { normalise } from "./normalise.js";

export const BANNED_PHRASES = Object.freeze([
  // Hedge words (ADR 0005).
  "may",
  "could potentially",
  "consider consulting a lawyer",
  // Verdict words (ADR 0006).
  "safe",
  "fine",
  "good to sign",
]);

const WORD_CHAR = "[\\p{L}\\p{N}_]";

function phrasePattern(phrase) {
  const words = phrase.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<!${WORD_CHAR})${words.join("\\s+")}(?!${WORD_CHAR})`, "giu");
}

const PATTERNS = BANNED_PHRASES.map((phrase) => ({ phrase, re: phrasePattern(phrase) }));

// Exemptions by context, decided by the product owner on 2026-10-31. Everything else stays banned.
//
// "fine" in the money sense: immediately preceded or followed by an amount ("₹500 fine",
// "a fine of Rs. 5,000", "fine of INR 2,000"). An amount is a currency mark (Rs, Rs., INR, ₹) with a
// number, or a number followed by "rupees" or "INR".
const NUMBER = "\\d[\\d,]*(?:\\.\\d+)?";
const AMOUNT = `(?:(?:Rs\\.?|INR|₹)\\s*${NUMBER}|${NUMBER}\\s*(?:rupees|INR))`;
const AMOUNT_AFTER = new RegExp(`^\\s+(?:of\\s+)?${AMOUNT}(?![\\d])`, "i");
const AMOUNT_BEFORE = new RegExp(`${AMOUNT}\\s+$`, "i");

// "May" the month: capitalised exactly, and next to a day number or a year ("1 May", "1st May",
// "May 1", "May 2026", "May, 2026"). Lowercase "may" is always the hedge word.
const DAY_BEFORE = /(?<![\d])\d{1,2}(?:st|nd|rd|th)?\s+$/;
const DAY_OR_YEAR_AFTER = /^,?\s+(?:\d{1,2}(?:st|nd|rd|th)?|\d{4})(?![\d%.,]?\d|%)/;

function exemptByContext(text, hit) {
  const before = text.slice(0, hit.index);
  const after = text.slice(hit.index + hit.match.length);
  if (hit.phrase === "fine") return AMOUNT_AFTER.test(after) || AMOUNT_BEFORE.test(before);
  if (hit.phrase === "may") {
    return hit.match === "May" && (DAY_BEFORE.test(before) || DAY_OR_YEAR_AFTER.test(after));
  }
  return false;
}

// Spans between paired double quotes, straight or curly.
function quotedSpans(text) {
  const spans = [];
  const re = /\u201C([^\u201D]*)\u201D|"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const inner = m[1] ?? m[2];
    const start = m.index + 1;
    spans.push({ start, end: start + inner.length, text: inner });
  }
  return spans;
}

// Sentence spans. Splitting is deliberately simple: a wrong split only makes an excuse harder to earn.
function sentenceSpans(text) {
  const spans = [];
  const re = /[^.!?]+(?:[.!?]+|$)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!m[0].trim()) continue;
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return spans;
}

function wordCount(s) {
  return (s.match(new RegExp(`${WORD_CHAR}+`, "gu")) || []).length;
}

function excusedBy(span, hit, normalisedDocument) {
  if (hit.index < span.start || hit.index + hit.match.length > span.end) return false;
  // The span has to carry more than the banned phrase itself.
  if (wordCount(span.text) <= wordCount(hit.match)) return false;
  const needle = normalise(span.text);
  return needle.length > 0 && normalisedDocument.includes(needle);
}

/**
 * Finds banned hedge and verdict wording in Redline's own text.
 * @param {string} text Redline's text, such as a summary.
 * @param {{ documentText?: string }} [options] The stored document text, for the word-for-word exclusion.
 * @returns {{ phrase: string, match: string, index: number }[]} Every hit that is not excused, in text order.
 */
export function findBannedWording(text, { documentText = "" } = {}) {
  return findHits(text, PATTERNS, { documentText, exempt: exemptByContext });
}

// Every hit of the patterns in text that is neither exempt by context nor reproduced word for word
// from the document.
function findHits(text, patterns, { documentText = "", exempt = () => false } = {}) {
  const source = String(text ?? "");
  const normalisedDocument = normalise(documentText);
  const quotes = quotedSpans(source);
  const sentences = sentenceSpans(source);

  const hits = [];
  for (const { phrase, re } of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source))) {
      const hit = { phrase, match: m[0], index: m.index };
      const excused =
        exempt(source, hit) ||
        (normalisedDocument.length > 0 &&
          (quotes.some((s) => excusedBy(s, hit, normalisedDocument)) ||
            sentences.some((s) => excusedBy(s, hit, normalisedDocument))));
      if (!excused) hits.push(hit);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

// Wording that compares a clause with Market standard (ADR 0003, ADR 0005). The document cannot prove
// such a claim, so any of Redline's text that uses it carries the label Redline's judgment. Broad on
// purpose: a false hit only adds the label, while a miss would present a judgment as fact.
// "standard" also catches "market standard" and "non-standard".
export const JUDGMENT_PHRASES = Object.freeze([
  "standard",
  "unusual",
  "unusually",
  "usual",
  "usually",
  "typical",
  "typically",
  "atypical",
  "common",
  "commonly",
  "uncommon",
  "normal",
  "normally",
  "customary",
  "one-sided",
  "industry",
]);

const JUDGMENT_PATTERNS = JUDGMENT_PHRASES.map((phrase) => ({ phrase, re: phrasePattern(phrase) }));

/**
 * Finds Market standard and unusualness wording in Redline's own text, outside text reproduced word
 * for word from the document.
 * @param {string} text
 * @param {{ documentText?: string }} [options]
 * @returns {{ phrase: string, match: string, index: number }[]}
 */
export function findJudgmentWording(text, { documentText = "" } = {}) {
  return findHits(text, JUDGMENT_PATTERNS, { documentText });
}

// Numbers (ticket 22, ruling C(b)). A number is a run of digits with any thousands commas and
// decimal parts, so "1,500.00", "1,50,000" and a clause reference such as "16.2.5" are each one
// number; currency signs and "%" around it are not part of it. Two numbers are the same when their
// digits match after the commas are removed; a plain amount also matches the same value written with
// or without decimals ("1500" and "1500.00"), but a clause reference must match exactly.
const NUMBER_RE = /\d+(?:,\d+)*(?:\.\d+)*/g;

export function numberKey(raw) {
  const s = String(raw).replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}

/** Every number in the text, as keys for comparison. */
export function documentNumbers(text) {
  return new Set([...String(text ?? "").matchAll(NUMBER_RE)].map((m) => numberKey(m[0])));
}

/**
 * Numbers in Redline's own text that do not occur in the document.
 * @param {string} text
 * @param {Set<string>} numbersInDocument from documentNumbers(documentText)
 * @returns {{ match: string, index: number }[]}
 */
export function findUnsupportedNumbers(text, numbersInDocument) {
  return [...String(text ?? "").matchAll(NUMBER_RE)]
    .filter((m) => !numbersInDocument.has(numberKey(m[0])))
    .map((m) => ({ match: m[0], index: m.index }));
}

// Blanks and placeholders (ticket 22, ruling C(a), narrowed by ticket 24 ruling 22). Only blanks in
// the body count:
// - a placeholder bracket anywhere: "[●]" or "[•]", "[__]", or a named one such as "[Name of the Party]";
// - a run of 3 or more underscores, or of dots (". . ." and "…" count), only when at least 3 words are
//   left on its line after the runs, punctuation and the label words below are removed. So
//   "Signature: ________" and "Date: ______" never count, while "this ___ day of ____ 2024" does;
// - a dot run followed by an optional space and a page number or roman numeral at the end of its line
//   is a contents leader ("Definitions .......... 3") and never counts.
const PLACEHOLDERS = [
  /\[\s*[●•]\s*\]/,
  /\[\s*_+\s*\]/,
  /\[\s*(?:name|date|address|insert|party|amount|number|signature|designation|details)\b[^\]\n]{0,60}\]/i,
];
const UNDERSCORE_RUN = /_{3,}/g;
const DOT_RUN = /(?:\.[ \t]?){3,}|(?:…[ \t]?){2,}|\.…|…\./g;
const CONTENTS_PAGE = /^[ \t]*(?:\d+|[ivxlcdm]+|[IVXLCDM]+)[ \t]*$/;
const LABEL_WORDS = new Set([
  "name", "date", "signature", "signed", "by", "title", "designation", "witness", "witnesses", "place", "for",
  "authorised", "authorized", "signatory", "seal", "stamp", "and",
]);
const MIN_BODY_WORDS = 3;

// The runs on a line that are blanks, leaving out contents leaders.
function blankRuns(line) {
  const runs = [...line.matchAll(UNDERSCORE_RUN)];
  for (const m of line.matchAll(DOT_RUN)) {
    if (!CONTENTS_PAGE.test(line.slice(m.index + m[0].length))) runs.push(m);
  }
  return runs;
}

function isBodyBlankLine(line) {
  if (blankRuns(line).length === 0) return false;
  const words = line
    .replace(UNDERSCORE_RUN, " ")
    .replace(DOT_RUN, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/u)
    .filter((w) => w.length > 0 && !LABEL_WORDS.has(w.toLowerCase()));
  return words.length >= MIN_BODY_WORDS;
}

/** True when the document has blanks or placeholders in its body (not only in signature or date lines). */
export function looksLikeTemplate(documentText) {
  const text = String(documentText ?? "");
  if (PLACEHOLDERS.some((re) => re.test(text))) return true;
  return text.split(/\r\n?|\n/).some(isBodyBlankLine);
}
