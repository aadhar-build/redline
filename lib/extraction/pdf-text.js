// Turns the text pdf.js finds on each page into the stored text of a PDF. Pure: it takes the items
// pdf.js returns and a page viewport, and never imports pdf.js, so it is unit-tested in Node on real
// pdf.js output (ticket 21).
//
//  - Lines. pdf.js marks a line break with hasEOL; a line's baseline is that of its first item with
//    any text in it (pdf.js puts the empty end-of-line item at the next line's position).
//  - Running headers and page numbers are removed, only from lines whose baseline lies in the top or
//    bottom BAND of the page:
//      (a) a page-number line ("12", "Page 3", "Page 3 of 9", "- 4 -") on every page;
//      (b) a line that, with every digit written "#" and whitespace collapsed, sits in the same
//          band on at least MIN_REPEAT_PAGES pages and at least half of all pages. It is removed
//          wherever it sits in a band.
//    and, at any height, (c) a page-number line whose number counts up with the page at the same
//    height on enough pages (sequentialPageNumbers, below; QUESTIONS.md 20).
//    Every distinct removed string is counted, so an upload can say what was taken out. OCR pages
//    (ADR 0008) go through the same rules once OCR returns line boxes.
//  - Pages are joined with a single "\n" (ticket 22, ruling A). A blank line is a sentence boundary
//    (ADR 0010), so a "\n\n" page join would cut a sentence that runs onto the next page in two.

export const BAND = 0.1;
export const MIN_REPEAT_PAGES = 3;
export const SAME_HEIGHT = 0.02; // rule (c): share of the page height

const PAGE_NUMBER = [/^(page\s+)?\d+(\s+of\s+\d+)?$/i, /^[-–]?\s*\d+\s*[-–]?$/];

const collapse = (s) => s.replace(/\s+/gu, " ").trim();
const repeatKey = (s) => collapse(s.replace(/\d/g, "#"));

/**
 * One page's lines, in reading order, from pdf.js getTextContent() and page.getViewport().
 * @param {{ items: { str?: string, hasEOL?: boolean, transform?: number[] }[] }} textContent
 * @param {{ height: number, convertToViewportPoint: (x: number, y: number) => number[] }} viewport
 * @returns {{ text: string, top: number | null }[]} top is the baseline's distance from the top of
 *   the page as a share of its height (0 to 1), or null for a line with no text
 */
export function pageLines(textContent, viewport) {
  const lines = [];
  let line = { text: "", top: null };
  for (const item of textContent.items) {
    if (typeof item.str !== "string") continue;
    line.text += item.str;
    if (line.top === null && item.str.trim() && Array.isArray(item.transform) && viewport?.height > 0) {
      const [, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      line.top = y / viewport.height;
    }
    if (item.hasEOL) {
      lines.push(line);
      line = { text: "", top: null };
    }
  }
  lines.push(line);
  return lines;
}

// Rule (c): page-number lines that sit outside the bands. A page-number-shaped line is removed at any
// height when lines of the same shape sit within SAME_HEIGHT of it on at least MIN_REPEAT_PAGES pages
// and at least half of all pages, and one of its numbers counts up with the page (on pages i < j it
// differs by exactly j - i). The shape here writes each run of digits as one "#", so "Page 9 of 37"
// and "Page 10 of 37" are one footer; the counting-up test is what keeps body numbers out.
function sequentialPageNumbers(pages) {
  const groups = new Map(); // shape -> [{ line, page, top, numbers }]
  pages.forEach((lines, page) => {
    for (const line of lines) {
      const shown = collapse(line.text);
      if (line.top === null || !PAGE_NUMBER.some((re) => re.test(shown))) continue;
      const shape = shown.replace(/\d+/g, "#");
      if (!groups.has(shape)) groups.set(shape, []);
      groups.get(shape).push({ line, page, top: line.top, numbers: (shown.match(/\d+/g) ?? []).map(Number) });
    }
  });

  const found = new Set();
  const enough = (n) => n >= MIN_REPEAT_PAGES && n >= pages.length / 2;
  for (const members of groups.values()) {
    for (const anchor of members) {
      if (found.has(anchor.line)) continue;
      const near = members.filter((m) => Math.abs(m.top - anchor.top) <= SAME_HEIGHT);
      for (let g = 0; g < anchor.numbers.length; g++) {
        // Lines whose number g minus their page index matches the anchor's count up with the page.
        const offset = anchor.numbers[g] - anchor.page;
        const run = near.filter((m) => m.numbers[g] - m.page === offset);
        if (!enough(new Set(run.map((m) => m.page)).size)) continue;
        for (const m of run) found.add(m.line);
        break;
      }
    }
  }
  return found;
}

const bandOf = (top) => (top === null ? null : top <= BAND ? "top" : top >= 1 - BAND ? "bottom" : null);

/**
 * Builds the stored text from every text page's lines.
 * @param {{ text: string, top: number | null }[][]} pages one array of lines per page, in page order
 * @returns {{ text: string, removed: { text: string, count: number }[] }}
 */
export function assemblePages(pages) {
  // Rule (b): on how many pages each band-and-shape appears.
  const seen = new Map(); // "top|key" -> Set of page indexes
  pages.forEach((lines, i) => {
    for (const line of lines) {
      const band = bandOf(line.top);
      const key = repeatKey(line.text);
      if (!band || !key) continue;
      const id = `${band}|${key}`;
      if (!seen.has(id)) seen.set(id, new Set());
      seen.get(id).add(i);
    }
  });
  const running = new Set();
  for (const [id, onPages] of seen) {
    if (onPages.size >= MIN_REPEAT_PAGES && onPages.size >= pages.length / 2) running.add(id.slice(id.indexOf("|") + 1));
  }

  const pageNumbers = sequentialPageNumbers(pages);

  const removed = new Map();
  const texts = pages.map((lines) => {
    const kept = lines.filter((line) => {
      if (pageNumbers.has(line)) {
        const shown = collapse(line.text);
        removed.set(shown, (removed.get(shown) ?? 0) + 1);
        return false;
      }
      if (!bandOf(line.top)) return true;
      const shown = collapse(line.text);
      if (!shown) return true;
      if (!PAGE_NUMBER.some((re) => re.test(shown)) && !running.has(repeatKey(line.text))) return true;
      removed.set(shown, (removed.get(shown) ?? 0) + 1);
      return false;
    });
    // Trimmed after stripping, so a removed footer leaves no trailing newline before the join.
    return kept.map((line) => line.text).join("\n").trim();
  });

  return {
    text: texts.filter(Boolean).join("\n"),
    removed: Array.from(removed, ([text, count]) => ({ text, count })),
  };
}
