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
// One relaxation (ticket 22, ruling B): a quote may leave out the clause number or bullet that opens
// its sentence ("The Licensee shall…" after "17.2 "). Then the span shown starts at the number. See
// numberingStart for the exact tokens.
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

// Words that make a line operative text rather than a heading (ticket 24, ruling 21 A). No heading
// line may contain one, case-folded, whatever its punctuation.
const OPERATIVE_WORDS = new Set([
  "shall", "must", "will", "may", "not", "no", "never", "unless", "except", "provided", "subject", "if", "only",
  "without", "means", "includes",
]);

function hasOperativeWord(words) {
  return words.some((w) => OPERATIVE_WORDS.has(w.replace(/[:;,]+$/u, "").toLowerCase()));
}

// Ticket 24, QUESTIONS.md 32: words that make a punctuated line a lead-in rather than a heading
// ("LESSEE AGREES TO:", "Lessee Undertakes That:"). Checked only on the rule A path.
const LEAD_IN_WORDS = new Set(["that", "agree", "agrees", "agreed", "undertake", "undertakes", "covenant", "covenants", "hereby"]);

// QUESTIONS.md 34: a lead-in colon may be written ":" plus one dash (":-", ":\u2013", ":\u2014").
// The DASH class, plus the ASCII hyphen it folds to.
function isLeadInDash(ch) {
  return ch === "-" || DASH.test(ch ?? "");
}

// Strips one trailing dash that follows a ":" (QUESTIONS.md 34).
function stripColonDash(text) {
  return text.length >= 2 && text[text.length - 2] === ":" && isLeadInDash(text[text.length - 1]) ? text.slice(0, -1) : text;
}

function isHeadingWord(w) {
  return /^\p{Lu}/u.test(w) || NUMBERING.test(w) || HEADING_SMALL_WORDS.has(w);
}

// Addendum, rule 1, with ticket 24 ruling 21 A. A heading line is at most 8 words and 80 characters,
// ends in a letter, digit or ")", and every word passes the heading word test; no word is an operative
// word. At a start boundary only (`start`), the line may also end in one ":" or ";" and be split by
// ":" or ";" into segments ("7. COMPENSATION:", "3. LICENCE PERIOD; EFFECTIVE DATE"), each of whose
// words passes the same test. At an end boundary a heading line holds no ":" or ";" at all.
function isHeadingLine(line, { start = false } = {}) {
  let text = line.replace(/\p{Cf}/gu, "").trim();
  if (text.length === 0 || text.length > 80) return false;
  let segments = [text];
  let punctuated = false;
  if (start) {
    text = stripColonDash(text);
    punctuated = /[;:]$/u.test(text);
    text = text.replace(/[;:]$/u, "").trimEnd();
    segments = text.split(/[;:]/u).map((part) => part.trim());
    if (segments.some((part) => part.length === 0)) return false;
  } else if (/[;:]/.test(text)) {
    return false;
  }
  if (!/[\p{L}\p{N})]$/u.test(text)) return false;
  const words = segments.flatMap((part) => part.split(/\s+/u));
  if (words.length > 8) return false;
  if (hasOperativeWord(words)) return false;
  if (punctuated && words.some((w) => LEAD_IN_WORDS.has(w.replace(/[:;,]+$/u, "").toLowerCase()))) return false;
  return words.every(isHeadingWord);
}

// Ticket 24, ruling 21 B: a line ending ":" whose text, upper-cased, ends with one of these formulas
// is a start boundary for the gap after it. A fixed list.
const FORMULA_OPENERS = ["AS FOLLOWS", "AS UNDER", "WITNESSETH", "HEREBY AGREED", "AGREED AND DECLARED", "AGREE AS FOLLOWS", "AGREED THAT", "AGREE THAT"];

function isFormulaOpener(line) {
  const text = stripColonDash(line.replace(/\p{Cf}/gu, "").replace(/\s+/gu, " ").trim());
  if (!text.endsWith(":")) return false;
  const upper = text.slice(0, -1).trimEnd().toUpperCase();
  return FORMULA_OPENERS.some((f) => upper === f || (upper.endsWith(f) && !/[\p{L}\p{N}]/u.test(upper[upper.length - f.length - 1])));
}

// Ticket 24, ruling 21 C: a proviso after an inline ":". Capital P, exactly these words.
const PROVISO = /^Provided(?:\s+(?:further|always))?\s+that(?![\p{L}\p{N}])/u;

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
//
// With `start` (the gap before a quote, or before a line on the walk back from one), ticket 24's
// ruling 21 exceptions also apply: a heading line may carry ":" or ";" (A), a formula opener such as
// "AS FOLLOWS:" ends a line (B), and a proviso starts after an inline ":" (C). They are start-only: an
// end boundary is checked under the rules above alone, and a span never ends at ":" or ";".
function isBoundary(stored, head, next, { start: atStart = false } = {}) {
  const levels = [];
  let result = null;
  for (;;) {
    if (head === 0 || next === stored.length) { result = true; break; }
    // Format characters alone are not whitespace: "end.\u200BNext" has no gap.
    const gap = stored.slice(head, next).replace(/\p{Cf}/gu, "").replace(/\r\n?/g, "\n");
    if (gap.length === 0) { result = false; break; }
    if (PARAGRAPH_BREAK.test(gap)) { result = true; break; }
    if (atStart && (stored[head - 1] === ":" || (isLeadInDash(stored[head - 1]) && stored[head - 2] === ":"))) {
      // Ruling 21 C: "…as provided in the Act: Provided that no fee…".
      if (PROVISO.test(stored.slice(next, next + 40))) { result = true; break; }
      // Ruling 21 B: "…AGREE AS FOLLOWS:\n1. The Licensor…".
      if (gap.includes("\n") && AFTER_HEADING.test(charAt(stored, next))) {
        const openerStart = Math.max(stored.lastIndexOf("\n", head - 1), stored.lastIndexOf("\r", head - 1)) + 1;
        if (isFormulaOpener(stored.slice(openerStart, head))) { result = true; break; }
      }
    }
    const ends = endsSentence(stored, head, next);
    if (ends || !gap.includes("\n") || !AFTER_HEADING.test(charAt(stored, next))) { result = ends; break; }
    const lineStart = Math.max(stored.lastIndexOf("\n", head - 1), stored.lastIndexOf("\r", head - 1)) + 1;
    if (!isHeadingLine(stored.slice(lineStart, head), { start: atStart })) { result = false; break; }
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
  return isBoundary(stored, gapStartBefore(stored, start), start, { start: true });
}

// Ticket 22, ruling B: a quote may leave out the numbering token that opens its sentence.
// The tokens, as written in the stored text (not folded):
// - the NUMBERING forms above, except that a bare integer ("12") counts only at the start of a line;
// - capital forms: "A." "A)" "(A)" "IV." "(IV)";
// - bullets: U+2022 U+25E6 U+25AA U+25CF U+2043 U+2219, "*", "-", "–", "—".
// Not tokens: inline headings ending ":" and words such as "Clause".
const CAPITAL_NUMBERING = /^(?:(?:[A-Z]|[IVXLCDM]+)[.)]|\((?:[A-Z]|[IVXLCDM]+)\))$/;
const BULLET = /^[•◦▪●⁃∙*\-–—]$/u;
const BARE_INTEGER = /^\d+$/;
// What the quote itself must start with on this path: a capital, a digit, "(", "[", an opening quote
// or a currency sign ($, ₹, "Rs").
const OPENS_SENTENCE = /^(?:[\p{Lu}\p{N}(["'‘‚‛“„‟«‹$₹]|Rs)/u;
const MAX_NUMBERING_TOKENS = 3;
const MAX_NUMBERING_LENGTH = 24;

function atLineStart(stored, at) {
  for (let i = at - 1; i >= 0; i -= 1) {
    if (stored[i] === "\n" || stored[i] === "\r") return true;
    if (!SPACE.test(stored[i]) && !FORMAT.test(stored[i])) return false;
  }
  return true;
}

function isNumberingToken(token, stored, at) {
  if (BARE_INTEGER.test(token)) return atLineStart(stored, at);
  return NUMBERING.test(token) || CAPITAL_NUMBERING.test(token) || BULLET.test(token);
}

// Ticket 24, ruling 21 D: an inline all-caps heading may also sit in the left-out prefix
// ("7. COMPENSATION: A. GRANT APPLICATION GDS shall pay…"). A word of it is in capitals with at least
// two letters (digits, "&", "," and "-" allowed), optionally ending ":" or ";", and is not an
// operative word. Title-case inline headings are not skipped.
const CAPS_WORD = /^[\p{Lu}\p{N}&,\-]+[:;]?$/u;
const MAX_CAPS_WORDS = 8;
const MAX_CAPS_LENGTH = 80;

function isCapsHeadingWord(token) {
  if (!CAPS_WORD.test(token)) return false;
  if ((token.match(/\p{Lu}/gu) ?? []).length < 2) return false;
  if (hasOperativeWord([token])) return false;
  // A lead-in word makes the prefix a lead-in, not a heading ("LESSEE AGREES TO:").
  return !LEAD_IN_WORDS.has(token.replace(/[:;,]+$/u, "").toLowerCase());
}

// Where the shown span starts when a quote that begins at `start` (not itself a boundary) left out
// the tokens that open its sentence, or -1 when there is no such start B:
// - ruling B: 1-3 numbering tokens, each followed by whitespace, at most MAX_NUMBERING_LENGTH
//   characters in all, and B a sentence boundary;
// - ruling 21 D: those tokens mixed with up to MAX_CAPS_WORDS all-caps heading words, at most
//   MAX_CAPS_LENGTH characters in all, and B a sentence boundary at the start of a line.
function numberingStart(stored, start) {
  if (!OPENS_SENTENCE.test(stored.slice(start, start + 2))) return -1;
  let pos = start;
  let numbering = 0;
  let caps = 0;
  for (;;) {
    let tokenEnd = pos;
    while (tokenEnd > 0 && (SPACE.test(stored[tokenEnd - 1]) || FORMAT.test(stored[tokenEnd - 1]))) tokenEnd -= 1;
    if (tokenEnd === pos) return -1;
    let tokenStart = tokenEnd;
    while (tokenStart > 0 && !SPACE.test(stored[tokenStart - 1])) tokenStart -= 1;
    const length = start - tokenStart;
    if (length > MAX_CAPS_LENGTH) return -1;
    const token = stored.slice(tokenStart, tokenEnd);
    if (isNumberingToken(token, stored, tokenStart)) numbering += 1;
    else if (isCapsHeadingWord(token)) caps += 1;
    else return -1;
    if (numbering > MAX_NUMBERING_TOKENS || caps > MAX_CAPS_WORDS) return -1;
    if (isStartBoundary(stored, tokenStart)) {
      if (caps === 0) return length <= MAX_NUMBERING_LENGTH ? tokenStart : -1;
      // "7. COMPENSATION:" has a boundary after "7.", so a caps prefix keeps walking back to the line
      // start. Every token on the way must still be numbering or a caps heading word.
      if (atLineStart(stored, tokenStart)) return tokenStart;
    }
    pos = tokenStart;
  }
}

function isEndBoundary(stored, end) {
  let i = end;
  while (i < stored.length) {
    const ch = charAt(stored, i);
    if (!GAP_CHAR.test(ch)) break;
    i += ch.length;
  }
  // Ruling 21: a span never ends at ":" or ";", whatever follows (a lead-in is not a sentence).
  let last = end;
  while (last > 0 && CLOSERS.includes(stored[last - 1])) last -= 1;
  // QUESTIONS.md 34: skip one dash, so ":-" is still a lead-in end.
  if (last > 1 && isLeadInDash(stored[last - 1])) last -= 1;
  if (last > 0 && /[;:]/.test(stored[last - 1])) return false;
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
    if (!isEndBoundary(doc.stored, end)) continue;
    if (isStartBoundary(doc.stored, start)) {
      return { found: true, text: doc.stored.slice(start, end), start, end };
    }
    // Ruling B: the quote left out the clause number or bullet that opens its sentence. What is shown
    // starts at the number, so the Reviewer sees "17.2 The Licensee shall…".
    const numbered = numberingStart(doc.stored, start);
    if (numbered !== -1) {
      return { found: true, text: doc.stored.slice(numbered, end), start: numbered, end };
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

/**
 * A checker bound to one document, prepared once, for callers that check many quotes against it.
 * Each call behaves exactly like checkSources(documentText, quotes).
 */
export function sourceChecker(documentText) {
  let doc = null;
  try {
    doc = prepare(documentText);
  } catch {
    doc = null;
  }
  return (quotes) => {
    if (doc === null || !Array.isArray(quotes) || quotes.length === 0) return { found: false };
    try {
      const sources = [];
      for (const quote of quotes) {
        const result = checkSourceIn(doc, quote);
        if (!result.found) return { found: false };
        sources.push({ text: result.text, start: result.start, end: result.end });
      }
      return { found: true, sources };
    } catch {
      return { found: false };
    }
  };
}

// How far sentenceAt walks from a match to find the sentence's boundaries before it gives up.
const MAX_SENTENCE_WALK = 6000;

/**
 * The whole sentence (under the same boundary rules the check uses) that contains stored[from, to).
 * Used by Redline's own detectors (Outside references, ticket 13), so what they cite is a sentence the
 * check accepts. Offsets are into the NFC form of the stored text. Null when no boundary is found within
 * MAX_SENTENCE_WALK characters either side, or on any failure: the caller then withholds, never guesses.
 * @returns {{ text: string, start: number, end: number } | null}
 */
export function sentenceAt(documentText, from, to = from) {
  try {
    const stored = String(documentText ?? "").normalize("NFC");
    if (!(from >= 0 && to >= from && to <= stored.length)) return null;
    const isGap = (i) => GAP_CHAR.test(charAt(stored, i));
    let start = -1;
    for (let s = from; s >= Math.max(0, from - MAX_SENTENCE_WALK); s -= 1) {
      // A candidate start is a non-gap character at the start of the text or right after a gap.
      if (isGap(s) || (s > 0 && !isGap(s - 1))) continue;
      if (isStartBoundary(stored, s)) {
        start = s;
        break;
      }
    }
    if (start === -1) return null;
    // "1. The Provider…": the "1." reads as a sentence end, so the walk stops after it. The sentence
    // shown starts at its clause number, as a quote that leaves the number out would (ruling B).
    const numbered = numberingStart(stored, start);
    if (numbered !== -1) start = numbered;
    let end = -1;
    for (let e = Math.max(to, start + 1); e <= Math.min(stored.length, to + MAX_SENTENCE_WALK); e += 1) {
      // A candidate end is right after a non-gap character, at the end of the text or before a gap.
      if (isGap(e - 1) || (e < stored.length && !isGap(e))) continue;
      if (isEndBoundary(stored, e)) {
        end = e;
        break;
      }
    }
    if (end === -1) return null;
    return { text: stored.slice(start, end), start, end };
  } catch {
    return null;
  }
}

export { normaliseWithMap as _normaliseWithMap };
