// Turns what the OCR engine (ocr-engine.js) returns for one page into the line shape pdf-text.js
// builds from a text layer, so OCR pages go through the same running-header and page-number rules and
// the same single-newline page join (ticket 21). Pure: no imports, unit-tested in Node.
//
// The engine returns lines in reading order, each a list of recognised boxes, left to right. A line's text is
// its boxes' text joined with one space; its top is the bottom edge of its lowest box (the baseline,
// near enough), as a share of the page image's height, which is what pdf-text.js's bands use.

/**
 * @param {{ lines?: { text?: string, box?: { y?: number, height?: number } }[][] }} result the engine's
 *   recognize() result for one page image (ocr-engine.js)
 * @param {number} height the page image's height in pixels
 * @returns {{ text: string, top: number | null }[]}
 */
// Coordinator ruling, 2026-10-31 (ADR 0008): a box with no Latin letter, digit or ₹ is dropped. PP-OCRv6
// small's dictionary holds CJK, and on blank or noisy areas it returns boxes like "一". Redline reads
// English contracts only, so such a box is noise, not text.
const KEEPS_BOX = /[\p{Script=Latin}\p{Nd}₹]/u;

// Below this many Latin letters, an OCR'd page holds no readable text (same ruling): stray "1"s on a
// blank page are not a document, and the page is treated as empty, so a scan with nothing on it gets
// the "no text" result instead of "not English".
export const MIN_OCR_LATIN_LETTERS = 20;

/** @param {{ text: string }[]} lines ocrPageLines() output for one page */
export function ocrPageReadable(lines) {
  let n = 0;
  for (const line of lines) n += (line.text.match(/\p{Script=Latin}/gu) ?? []).length;
  return n >= MIN_OCR_LATIN_LETTERS;
}

export function ocrPageLines(result, height) {
  const out = [];
  for (const boxes of Array.isArray(result?.lines) ? result.lines : []) {
    if (!Array.isArray(boxes)) continue;
    const words = boxes.filter((b) => typeof b?.text === "string" && KEEPS_BOX.test(b.text));
    if (words.length === 0) continue;
    const text = words.map((b) => b.text.trim().replace(/\s+/gu, " ")).join(" ");
    const bottoms = words
      .map((b) => Number(b.box?.y) + Number(b.box?.height))
      .filter((v) => Number.isFinite(v));
    const top = height > 0 && bottoms.length > 0 ? Math.min(1, Math.max(0, Math.max(...bottoms) / height)) : null;
    out.push({ text, top });
  }
  return out;
}
