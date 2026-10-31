// The unreadable-amount rule (spec-gaps 24, validation ruling of 2026-10-31). Redline's code decides it,
// not the model, and it applies only to text that came from OCR (ADR 0008).
//
// Why: the OCR engine does not read the rupee sign. On the validation scans every "₹" came back as a
// lone letter or digit ("Z. 14,57,00,000/-", "2. 17,19,26,000/-"), and zeros inside an amount came
// back as the letter o ("17,19,26,0oo/-"). Such a sentence passes the Source sentence check, because
// the check compares the quote with the OCR output, not the paper. A glyph is never repaired into "₹":
// "2. 17,19,26,000" cannot be told apart from a real "2." in front of an amount.
//
// With PP-OCRv6 small (research 31) the glyph is mostly left out instead: ". 14,57,00,000/-". That
// shape, and damaged clause numbers, are caught by the post-check rules (c) to (e) below. A clause
// number misread is a silent citation error, so it is withheld under the same reason.
//
// So, on OCR text, an amount is unreadable when any of (a) to (c) holds:
//  (a) a lone glyph stands right before an amount written in digit groups ("14,57,00,000",
//      "1,00,000", also "1,000,000"): a single letter, digit or stray symbol (~ ^ * = + | \ / < > # @ &)
//      with whitespace, "(" or "[" (or the start of the text) before it, then a full stop and/or
//      spaces, or for a non-digit glyph nothing at all, then the amount. A real currency sign (₹, $,
//      £, € and the rest of Unicode Sc) is not a lone glyph, and neither is ordinary punctuation, nor
//      the words "a", "A" and "I" followed by a space;
//  (b) the letter o or O sits inside a digit group ("0oo", "1o,000"): a comma-grouped token made of
//      digits and o/O with at least one of each;
//  (c) a bare full stop stands where the currency sign was ("of . 14,57,00,000", "of .1,00,000"):
//      whitespace, "(" or "[" (or the start) before the full stop, then optional spaces, the amount.
// And a clause or section number is damaged when either holds:
//  (d) a roman-numeral marker is broken: "()", "( )", "(ii )", "( ii)";
//  (e) a line starts with Article, Clause or Section and then only a full stop or colon, no number
//      ("ARTICLE : The ..."). Only at the start of a line: "as set out in this Clause. The" is prose.
// The post-check only finds; it never repairs the text.
// The ruling names the letter o; O is included and Western grouping is accepted too, both erring
// toward withholding, as the Source sentence check does. A Risk flag whose cited sentence holds an
// unreadable amount inside an OCR range is withheld with reason "unreadable-amount" and counted.
//
// Pure and browser-safe: no imports. Offsets are UTF-16 code units, like every JS string offset.

export const UNREADABLE_AMOUNT = "unreadable-amount";

const AMOUNT = String.raw`\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?(?!\d)`;
const BEFORE = String.raw`(?<=^|[\s(\[])`;
const SYMBOL = String.raw`[~^*=+|\\/<>#@&]`;
const LONE_GLYPH = new RegExp(
  [
    // A letter or stray symbol: then a full stop, spaces, both, or nothing. The one-letter English
    // words "a", "A" and "I" followed by a space are words, not glyphs ("pay a 1,00,000 deposit").
    String.raw`${BEFORE}(?:(?![aAI]\s)\p{L}|${SYMBOL})(?:\.\s*|\s+)?${AMOUNT}`,
    // A digit: then a full stop and/or spaces, never nothing (that is just a longer number).
    String.raw`${BEFORE}\d(?:\.\s*|\s+)${AMOUNT}`,
  ].join("|"),
  "gu",
);
const MISSING_SIGN = new RegExp(String.raw`${BEFORE}\.\s*${AMOUNT}`, "gu");
const BROKEN_ROMAN = /\(\s*\)|\([ivx]+\s+\)|\(\s+[ivx]+\)/gu;
const HEADING_NO_NUMBER = /^[ \t]*(?:ARTICLE|Article|CLAUSE|Clause|SECTION|Section)[ \t]*[.:](?=\s|$)/gmu;
const O_IN_GROUP = /(?<![\p{L}\p{N}])[\doO]{1,3}(?:,[\doO]{2,3})+(?![\p{L}\p{N}])/gu;

/**
 * Every unreadable amount and damaged clause number in a piece of text.
 * @param {string} text
 * @returns {{ index: number, match: string }[]} in text order
 */
export function findUnreadableAmounts(text) {
  const s = String(text ?? "");
  const found = [];
  // "Rs. 1,00,000" and "No. 1,00,000" never match: the glyph must have whitespace or a bracket before it.
  for (const m of s.matchAll(LONE_GLYPH)) found.push({ index: m.index, match: m[0] });
  for (const re of [MISSING_SIGN, BROKEN_ROMAN, HEADING_NO_NUMBER]) {
    for (const m of s.matchAll(re)) found.push({ index: m.index, match: m[0] });
  }
  for (const m of s.matchAll(O_IN_GROUP)) {
    if (/[oO]/.test(m[0]) && /\d/.test(m[0])) found.push({ index: m.index, match: m[0] });
  }
  return found.sort((a, b) => a.index - b.index);
}

/**
 * The OCR ranges of a document, checked: a list of [start, end] integer pairs, 0 <= start < end <=
 * textLength, in order and not touching. Null when the value is not that shape.
 * @returns {[number, number][] | null}
 */
export function readOcrRanges(value, textLength) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const out = [];
  let last = -1;
  for (const r of value) {
    if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isInteger)) return null;
    const [start, end] = r;
    if (start <= last || start < 0 || end <= start || end > textLength) return null;
    out.push([start, end]);
    last = end;
  }
  return out;
}

// The Source sentence check reports offsets into the NFC form of the stored text; OCR ranges are
// offsets into the stored text as extracted. Map them across when the two differ.
function toNfcRanges(documentText, ranges) {
  const text = String(documentText ?? "");
  const nfc = text.normalize("NFC");
  if (nfc === text) return ranges;
  const at = (i) => text.slice(0, i).normalize("NFC").length;
  return ranges.map(([s, e]) => [at(s), at(e)]);
}

const overlaps = (s, e, ranges) => ranges.some(([rs, re]) => s < re && e > rs);

/**
 * True when any cited span holds an unreadable amount that lies in an OCR range.
 * @param {string} documentText the stored text
 * @param {{ text: string, start: number, end: number }[]} sources checkSources() output (NFC offsets)
 * @param {[number, number][]} ocrRanges checked by readOcrRanges
 */
export function citesUnreadableAmount(documentText, sources, ocrRanges) {
  if (!Array.isArray(ocrRanges) || ocrRanges.length === 0) return false;
  const ranges = toNfcRanges(documentText, ocrRanges);
  return sources.some(
    (src) =>
      overlaps(src.start, src.end, ranges) &&
      findUnreadableAmounts(src.text).some((m) => overlaps(src.start + m.index, src.start + m.index + m.match.length, ranges)),
  );
}
