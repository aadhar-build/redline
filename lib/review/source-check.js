// The Source sentence check (ADR 0001, ADR 0010). Redline's code, not the model, decides whether a
// sentence the model quotes is in the stored document text.
//
// A quote is accepted only if, after the ADR 0010 normalisations are applied to it and to the stored
// text, it appears in the stored text as a span that starts and ends on sentence boundaries. What the
// caller shows is the matched span cut from the stored text, never the model's string.
//
// Sentence boundaries are found in the stored text, before whitespace is collapsed:
// - a span may start at the start of the text, after a paragraph break (a blank line), or after
//   ".", "!" or "?" (with any closing quotes or brackets) followed by whitespace;
// - a span may end with ".", "!" or "?" (with any closing quotes or brackets) followed by
//   whitespace or the end of the text, or right before a paragraph break or the end of the text.
// A single line break is not a boundary: wrapped lines would otherwise let a quote drop the start of
// a sentence ("not", "unless"). A full stop after a common abbreviation such as "Rs." or "No." is not
// a boundary either. Both choices err toward withholding.
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
const ABBREVIATIONS = new Set(["rs", "no", "nos", "mr", "mrs", "ms", "dr", "st", "sr", "jr", "pvt", "co", "viz", "vs", "cf", "e.g", "i.e"]);
const PARAGRAPH_BREAK = /\n[^\S\n]*\n/;

// Does the stored text up to `end` finish with a sentence terminator (and any closers)?
function endsWithTerminator(stored, end) {
  let j = end;
  while (j > 0 && CLOSERS.includes(stored[j - 1])) j -= 1;
  if (j === 0 || !TERMINATOR.test(stored[j - 1])) return false;
  if (stored[j - 1] === ".") {
    const word = stored.slice(0, j - 1).match(/[\p{L}.]+$/u)?.[0]?.toLowerCase() ?? "";
    if (ABBREVIATIONS.has(word)) return false;
  }
  return true;
}

function isStartBoundary(stored, start) {
  const before = stored.slice(0, start);
  const gap = before.match(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\p{Cf}]*$/u)[0];
  const head = before.length - gap.length;
  if (head === 0) return true;
  if (gap.length === 0) return false;
  return PARAGRAPH_BREAK.test(gap) || endsWithTerminator(stored, head);
}

function isEndBoundary(stored, end) {
  const after = stored.slice(end);
  const gap = after.match(/^[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\p{Cf}]*/u)[0];
  if (gap.length === after.length) return true;
  if (gap.length === 0) return false;
  return PARAGRAPH_BREAK.test(gap) || endsWithTerminator(stored, end);
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
