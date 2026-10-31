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
// - the gap holds a single line break and the line before it is a heading line: at most 8 words and
//   80 characters, ending in a letter, digit or ")", with no ";" or ":", and every word starting with
//   a capital, a numbering token ("12.3", "(a)", "(iv)", "I.") or one of a few short words;
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
  let out = "";
  const from = [];
  const to = [];
  let i = 0;
  for (const ch of stored) {
    const at = i;
    i += ch.length;
    if (FORMAT.test(ch)) continue;
    if (SPACE.test(ch)) {
      if (out.length === 0) continue;
      if (out.endsWith(" ")) {
        to[to.length - 1] = i;
        continue;
      }
      out += " ";
      from.push(at);
      to.push(i);
      continue;
    }
    for (const c of fold(ch)) {
      out += c;
      from.push(at);
      to.push(i);
    }
  }
  if (out.endsWith(" ")) {
    out = out.slice(0, -1);
    from.pop();
    to.pop();
  }
  return { stored, text: out, from, to };
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

// The line of stored text that ends at `head`.
function lineEndingAt(stored, head) {
  const start = Math.max(stored.lastIndexOf("\n", head - 1), stored.lastIndexOf("\r", head - 1)) + 1;
  return stored.slice(start, head);
}

// Does the text before `head` end a sentence with ".", "!" or "?" (and any closers), given that the
// text after the gap starts at `next`?
function endsSentence(stored, head, next) {
  let j = head;
  while (j > 0 && CLOSERS.includes(stored[j - 1])) j -= 1;
  if (j === 0 || !TERMINATOR.test(stored[j - 1])) return false;
  const after = stored.slice(next);
  // Addendum, rule 2: never a boundary when the next character is a lowercase letter.
  if (/^\p{Ll}/u.test(after)) return false;
  if (stored[j - 1] !== ".") return true;

  const before = stored.slice(0, j - 1);
  const word = before.match(/[\p{L}.]+$/u)?.[0]?.toLowerCase() ?? "";
  if (ABBREVIATIONS.has(word)) return false;
  // Addendum, rule 4: initials ("S. 27", "A. K. Sharma"). "Schedule A. The" stays a boundary.
  if (LONE_CAPITAL_AT_END.test(before)) {
    if (/^\p{N}/u.test(after)) return false;
    if (/^\p{Lu}\.(?:\s|$)/u.test(after)) return false;
    if (INITIAL_AT_END.test(before.slice(0, -1))) return false;
  }
  return true;
}

// Is the gap between `head` (where the text before it ends) and `next` (where the text after it
// starts) a sentence boundary?
function isBoundary(stored, head, next) {
  if (head === 0 || next === stored.length) return true;
  // Format characters alone are not whitespace: "end.\u200BNext" has no gap.
  const gap = stored.slice(head, next).replace(/\p{Cf}/gu, "").replace(/\r\n?/g, "\n");
  if (gap.length === 0) return false;
  if (PARAGRAPH_BREAK.test(gap)) return true;
  if (gap.includes("\n") && isHeadingLine(lineEndingAt(stored, head))) return true;
  return endsSentence(stored, head, next);
}

function isStartBoundary(stored, start) {
  const gap = stored.slice(0, start).match(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\p{Cf}]*$/u)[0];
  return isBoundary(stored, start - gap.length, start);
}

function isEndBoundary(stored, end) {
  const gap = stored.slice(end).match(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\p{Cf}]*/u)[0];
  return isBoundary(stored, end, end + gap.length);
}

/**
 * Looks for one quoted Source sentence in the stored document text.
 * @param {string} documentText The stored document text.
 * @param {string} quote The sentence or sentences the model says it relied on.
 * @returns {{ found: true, text: string, start: number, end: number } | { found: false, reason: string }}
 *   On success, text is the span cut from the stored text (NFC form), and start and end are its offsets.
 */
export function checkSource(documentText, quote) {
  if (typeof quote !== "string") return { found: false, reason: "not-text" };
  const needle = normalise(quote);
  if (needle.length === 0) return { found: false, reason: "empty" };
  if (ELLIPSIS.test(needle)) return { found: false, reason: "ellipsis" };

  const doc = normaliseWithMap(documentText ?? "");
  // The map has to reproduce normalise() exactly; if it ever does not, nothing is shown.
  if (doc.text !== normalise(documentText ?? "")) return { found: false, reason: "map-mismatch" };

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
  if (!Array.isArray(quotes) || quotes.length === 0) return { found: false };
  const sources = [];
  for (const quote of quotes) {
    const result = checkSource(documentText, quote);
    if (!result.found) return { found: false };
    sources.push({ text: result.text, start: result.start, end: result.end });
  }
  return { found: true, sources };
}

export { normaliseWithMap as _normaliseWithMap };
