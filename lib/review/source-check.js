// The Source sentence check (ADR 0001, ADR 0010). Redline's code, not the model, decides whether a
// sentence the model quotes is in the stored document text.
//
// A quote is accepted only if, after the ADR 0010 normalisations are applied to it and to the stored
// text, it appears in the stored text as a span that starts and ends on sentence boundaries: one whole
// sentence or a run of consecutive whole sentences, never part of one. What the caller shows is the
// matched span cut from the stored text, never the model's string.
//
// Sentence boundaries (ADR 0010 and its addendum) are found in the stored text, before whitespace is
// collapsed. A boundary is the gap between two pieces of text, and it counts when:
// - it is the start or the end of the text;
// - the gap holds a blank line (a paragraph break);
// - the gap holds a single line break, and all three of these hold:
//   - the line before it is a heading line: at most 8 words and 80 characters, ending in a letter,
//     digit or ")", with no ";" or ":", and every word starting with a capital, a numbering token
//     ("12.3", "(a)", "(iv)", "I.") or one of a few short words;
//   - that heading line itself starts on a boundary under these same rules (so a title-case line in
//     the middle of a wrapped sentence, or a "Page 2 of 6" footer inside one, is not a heading);
//   - the text after the line break starts with a capital, a digit, "(", "[" or an opening quote;
// - the text before the gap ends with ".", "!" or "?" (with any closing quotes or brackets), the gap
//   holds whitespace, and none of these apply:
//   - the next character is a lowercase letter;
//   - the full stop follows a listed abbreviation ("Rs.", "Pvt.", "Ltd.", "etc.");
//   - the full stop follows a lone capital (an initial) and the next word is a number ("S. 27") or
//     another initial ("A. K."), or the word before it is an initial ("K." in "A. K. Sharma").
// Any other single line break is not a boundary: wrapped lines would otherwise let a quote drop the
// start of a sentence ("not", "unless"), and a list item ending in ";" cannot be cited without its
// lead-in. Each of these choices errs toward withholding.
//
// This module is shared by every part of Review that shows Source sentences.

import { normalise } from "./normalise.js";

const LIGATURES = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};

// The same character classes normalise() uses, one code point at a time.
const FORMAT = /^\p{Cf}$/u;
const SPACE = /^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]$/u;
const SINGLE_QUOTE = /^[\u2018\u2019\u201A\u201B]$/;
const DOUBLE_QUOTE = /^[\u201C\u201D\u201E\u201F]$/;
const DASH = /^[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]$/;

function fold(ch) {
  if (SINGLE_QUOTE.test(ch)) return "'";
  if (DOUBLE_QUOTE.test(ch)) return '"';
  if (DASH.test(ch)) return "-";
  return LIGATURES[ch] ?? ch;
}

// normalise(), plus a map from each output character back to the stored text it came from.
// from[i] and to[i] are offsets into the NFC form of the stored text.
function normaliseWithMap(text) {
  const stored = String(text).normalize("NFC");
  // Built as an array and joined once: appending to a string and calling endsWith() on it each
  // character makes V8 flatten the string every time, which is quadratic on long documents.
  const parts = [];
  let lastIsSpace = false;
  const from = [];
  const to = [];
  let i = 0;
  for (const ch of stored) {
    const at = i;
    i += ch.length;
    if (FORMAT.test(ch)) continue;
    if (SPACE.test(ch)) {
      if (parts.length === 0) continue;
      if (lastIsSpace) {
        to[to.length - 1] = i;
        continue;
      }
      parts.push(" ");
      lastIsSpace = true;
      from.push(at);
      to.push(i);
      continue;
    }
    for (const c of fold(ch)) {
      parts.push(c);
      lastIsSpace = false;
      from.push(at);
      to.push(i);
    }
  }
  if (lastIsSpace) {
    parts.pop();
    from.pop();
    to.pop();
  }
  return { stored, text: parts.join(""), from, to };
}

const ELLIPSIS = /\.\.\.|\u2026/;
const CLOSERS = "\"'\u2019\u201D)]";
const TERMINATOR = /[.!?]/;
// Words whose full stop does not end a sentence.
const ABBREVIATIONS = new Set([
  "rs", "no", "nos", "mr", "mrs", "ms", "dr", "st", "sr", "jr", "pvt", "co", "viz", "vs", "cf", "e.g", "i.e",
  "cl", "sec", "sch", "art", "para", "p.a", "w.e.f", "approx",
  // ADR 0010 addendum, rule 3.
  "ltd", "inc", "llp", "govt", "dept", "rd", "ref", "encl", "annex", "exh", "etc",
]);
const PARAGRAPH_BREAK = /\n[^\S\n]*\n/;
// The words a heading line may hold besides capitalised words and numbering tokens (addendum, rule 1).
const HEADING_SMALL_WORDS = new Set(["a", "an", "and", "the", "of", "for", "to", "in", "on", "by", "or", "with"]);
// Clause numbering: "12", "12.3", "12.3.", "(12)", "(a)", "a)", "(iv)", "iv)". Lowercase letters and
// roman numerals count only with a bracket, so a word like "did" or "civil" is never numbering.
// Capital forms ("I.", "A.") already pass the heading test as words that start with a capital.
const NUMBERING = /^(?:\(?\d+(?:\.\d+)*\)?\.?|\(?(?:[a-z]|[ivxlcdm]+)\))$/;
// A lone capital letter (an initial) at the end of the text, as in "A" or "S" before a full stop.
const LONE_CAPITAL_AT_END = /(?:^|[^\p{L}\p{N}.])\p{Lu}$/u;
// The same initial with its full stop and the whitespace after it.
const INITIAL_AT_END = /(?:^|[^\p{L}\p{N}.])\p{Lu}\.\s+$/u;

// Addendum, rule 1.
function isHeadingLine(line) {
  const text = line.replace(/\p{Cf}/gu, "").trim();
  if (text.length === 0 || text.length > 80) return false;
  if (/[;:]/.test(text)) return false;
  if (!/[\p{L}\p{N})]$/u.test(text)) return false;
  const words = text.split(/\s+/u);
  if (words.length > 8) return false;
  return words.every((w) => /^\p{Lu}/u.test(w) || NUMBERING.test(w) || HEADING_SMALL_WORDS.has(w));
}

// What may follow a heading line's line break: a capital, a digit, "(", "[" or an opening quote mark.
const AFTER_HEADING = /^[\p{Lu}\p{N}(["'‘‚‛“„‟«‹]/u;
const GAP_CHAR = /^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\p{Cf}]$/u;
// How far back endsSentence looks for an abbreviation or an initial. Far longer than any of them.
const LOOK_BACK = 200;
// How many heading lines in a row the boundary walk follows before failing closed (withholding).
const MAX_HEADING_CHAIN = 500;

// The single character (code point) at `at`, or "" at the end of the text.
function charAt(stored, at) {
  const cp = stored.codePointAt(at);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}

// Does the text before `head` end a sentence with ".", "!" or "?" (and any closers), given that the
// text after the gap starts at `next`?
function endsSentence(stored, head, next) {
  let j = head;
  while (j > 0 && CLOSERS.includes(stored[j - 1])) j -= 1;
  if (j === 0 || !TERMINATOR.test(stored[j - 1])) return false;
  // Addendum, rule 2: never a boundary when the next character is a lowercase letter.
  if (/^\p{Ll}/u.test(charAt(stored, next))) return false;
  if (stored[j - 1] !== ".") return true;

  const before = stored.slice(Math.max(0, j - 1 - LOOK_BACK), j - 1);
  const word = before.match(/[\p{L}.]+$/u)?.[0]?.toLowerCase() ?? "";
  if (ABBREVIATIONS.has(word)) return false;
  // Addendum, rule 4: initials ("S. 27", "A. K. Sharma"). "Schedule A. The" stays a boundary.
  if (LONE_CAPITAL_AT_END.test(before)) {
    const after = stored.slice(next, next + 4);
    if (/^\p{N}/u.test(after)) return false;
    if (/^\p{Lu}\.(?:\s|$)/u.test(after)) return false;
    if (INITIAL_AT_END.test(before.slice(0, -1))) return false;
  }
  return true;
}

// Where the run of gap characters ending at `at` starts.
// Steps back one code point at a time, so astral format characters (e.g. U+E0001) count as gap.
function gapStartBefore(stored, at) {
  let i = at;
  while (i > 0) {
    const low = stored.charCodeAt(i - 1);
    const width = i > 1 && low >= 0xdc00 && low <= 0xdfff && (stored.charCodeAt(i - 2) & 0xfc00) === 0xd800 ? 2 : 1;
    if (!GAP_CHAR.test(stored.slice(i - width, i))) break;
    i -= width;
  }
  return i;
}

// Is the gap between `head` (where the text before it ends) and `next` (where the text after it
// starts) a sentence boundary?
//
// Addendum, rule 1 (as settled 2026-10-31): a single line break is a boundary when the line ending at
// `head` is a heading line, that line itself starts on a boundary, and the text after the gap starts
// with a character from AFTER_HEADING. "Starts on a boundary" can chain back through several heading
// lines, so this walks back iteratively (no recursion) and fails closed past MAX_HEADING_CHAIN lines.
// Each level is: (heading break whose own start is a boundary) OR (ends a sentence).
function isBoundary(stored, head, next) {
  const levels = [];
  let result = null;
  for (;;) {
    if (head === 0 || next === stored.length) { result = true; break; }
    // Format characters alone are not whitespace: "end.\u200BNext" has no gap.
    const gap = stored.slice(head, next).replace(/\p{Cf}/gu, "").replace(/\r\n?/g, "\n");
    if (gap.length === 0) { result = false; break; }
    if (PARAGRAPH_BREAK.test(gap)) { result = true; break; }
    const ends = endsSentence(stored, head, next);
    if (ends || !gap.includes("\n") || !AFTER_HEADING.test(charAt(stored, next))) { result = ends; break; }
    const lineStart = Math.max(stored.lastIndexOf("\n", head - 1), stored.lastIndexOf("\r", head - 1)) + 1;
    if (!isHeadingLine(stored.slice(lineStart, head))) { result = false; break; }
    if (levels.length >= MAX_HEADING_CHAIN) { result = false; break; }
    levels.push(ends);
    // Next level: does the heading line itself start on a boundary?
    let start = lineStart;
    while (start < head && (SPACE.test(stored[start]) || FORMAT.test(stored[start]))) start += 1;
    next = start;
    head = gapStartBefore(stored, start);
  }
  // Every pushed level had ends === false, so each level's answer is the deeper level's answer.
  return result;
}

function isStartBoundary(stored, start) {
  return isBoundary(stored, gapStartBefore(stored, start), start);
}

function isEndBoundary(stored, end) {
  let i = end;
  while (i < stored.length) {
    const ch = charAt(stored, i);
    if (!GAP_CHAR.test(ch)) break;
    i += ch.length;
  }
  return isBoundary(stored, end, i);
}

/**
 * Looks for one quoted Source sentence in the stored document text.
 * @param {string} documentText The stored document text.
 * @param {string} quote The sentence or sentences the model says it relied on.
 * @returns {{ found: true, text: string, start: number, end: number } | { found: false, reason: string }}
 *   On success, text is the span cut from the stored text (NFC form), and start and end are its offsets.
 */
export function checkSource(documentText, quote) {
  return checkSourceIn(prepare(documentText), quote);
}

// The stored text with its normalised form and offset map, built once per document.
function prepare(documentText) {
  const doc = normaliseWithMap(documentText ?? "");
  // The map has to reproduce normalise() exactly; if it ever does not, nothing is shown.
  doc.mismatch = doc.text !== normalise(documentText ?? "");
  return doc;
}

function checkSourceIn(doc, quote) {
  if (typeof quote !== "string") return { found: false, reason: "not-text" };
  const needle = normalise(quote);
  if (needle.length === 0) return { found: false, reason: "empty" };
  if (ELLIPSIS.test(needle)) return { found: false, reason: "ellipsis" };
  if (doc.mismatch) return { found: false, reason: "map-mismatch" };

  for (let at = doc.text.indexOf(needle); at !== -1; at = doc.text.indexOf(needle, at + 1)) {
    const start = doc.from[at];
    const end = doc.to[at + needle.length - 1];
    if (isStartBoundary(doc.stored, start) && isEndBoundary(doc.stored, end)) {
      return { found: true, text: doc.stored.slice(start, end), start, end };
    }
  }
  return { found: false, reason: "not-found" };
}

/**
 * Checks every quote. Fails if there are none or if any one fails (ADR 0010, spec-gaps 11).
 * @returns {{ found: true, sources: { text: string, start: number, end: number }[] } | { found: false }}
 */
export function checkSources(documentText, quotes) {
  try {
    return checkAll(documentText, quotes);
  } catch {
    // Any failure in the check withholds; it never shows an unchecked source.
    return { found: false };
  }
}

function checkAll(documentText, quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return { found: false };
  const doc = prepare(documentText);
  const sources = [];
  for (const quote of quotes) {
    const result = checkSourceIn(doc, quote);
    if (!result.found) return { found: false };
    sources.push({ text: result.text, start: result.start, end: result.end });
  }
  return { found: true, sources };
}

export { normaliseWithMap as _normaliseWithMap };
