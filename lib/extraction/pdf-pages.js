// Decides, page by page, whether a PDF page has a real text layer. Pure: it works on the operator
// list pdf.js returns (fnArray, argsArray) and the OPS table, so it is unit-tested without a browser.
//
// A page needs OCR (ADR 0008) when either holds:
//  - it is a scan: an image covers at least SCAN_IMAGE_COVERAGE of the page and fewer than
//    MIN_VISIBLE_CHARS visible characters are drawn on it (a stamped page number does not count as
//    a text layer, but a page of typed text over a letterhead image does);
//  - it is a scan with a hidden OCR layer: it paints an image and draws at least as many invisible
//    characters (text render mode 3 or 7, the mode scanners use for searchable scans) as visible ones.
// A page with no image and little or no text (a blank page, a short signature page) has a text layer.

export const SCAN_IMAGE_COVERAGE = 0.5;
export const MIN_VISIBLE_CHARS = 50;

const IDENTITY = [1, 0, 0, 1, 0, 0];

function multiply(m, n) {
  // m then n, in PDF's row-vector convention: the result maps a point through m, then through n.
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const isGlyph = (g) => g && typeof g === "object" && typeof g.unicode === "string";
const countChars = (glyphs) =>
  glyphs.filter(isGlyph).reduce((n, g) => n + g.unicode.replace(/\s/gu, "").length, 0);

/**
 * Summarises what one page draws.
 * @returns {{ visibleChars: number, invisibleChars: number, imageCount: number, imageCoverage: number }}
 */
export function summariseOperators({ fnArray, argsArray }, OPS, pageArea) {
  const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const imageOps = new Set(
    [
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
      OPS.paintImageXObjectRepeat,
      OPS.paintImageMaskXObjectRepeat,
      OPS.paintImageMaskXObjectGroup,
      OPS.paintInlineImageXObjectGroup,
    ].filter((op) => op !== undefined),
  );

  let state = { ctm: IDENTITY, mode: 0 };
  const stack = [];
  let visibleChars = 0;
  let invisibleChars = 0;
  let imageCount = 0;
  let imageArea = 0;

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];
    if (fn === OPS.save) stack.push(state);
    else if (fn === OPS.restore) state = stack.pop() ?? state;
    else if (fn === OPS.transform) state = { ...state, ctm: multiply(args, state.ctm) };
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(state);
      if (Array.isArray(args[0]) && args[0].length === 6) state = { ...state, ctm: multiply(args[0], state.ctm) };
    } else if (fn === OPS.paintFormXObjectEnd) state = stack.pop() ?? state;
    else if (fn === OPS.setTextRenderingMode) state = { ...state, mode: Number(args[0]) || 0 };
    else if (textOps.has(fn)) {
      const chars = args.filter(Array.isArray).reduce((n, a) => n + countChars(a), 0);
      // Modes 3 (invisible) and 7 (clip only) draw nothing on the page.
      if ((state.mode & 3) === 3) invisibleChars += chars;
      else visibleChars += chars;
    } else if (imageOps.has(fn)) {
      imageCount += 1;
      // An image fills the unit square, mapped onto the page by the current transform.
      const [a, b, c, d] = state.ctm;
      imageArea += Math.abs(a * d - b * c);
    }
  }

  const imageCoverage = pageArea > 0 ? Math.min(1, imageArea / pageArea) : 0;
  return { visibleChars, invisibleChars, imageCount, imageCoverage };
}

export function pageNeedsOcr({ visibleChars, invisibleChars, imageCount, imageCoverage }) {
  if (imageCount === 0) return false;
  const scan = imageCoverage >= SCAN_IMAGE_COVERAGE && visibleChars < MIN_VISIBLE_CHARS;
  const hiddenOcrLayer = invisibleChars > 0 && invisibleChars >= visibleChars;
  return scan || hiddenOcrLayer;
}
