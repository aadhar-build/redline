// Which pages of a document Redline read with OCR (ADR 0008; QUESTIONS 18, decided by the product
// owner on 2026-10-31: OCR text is marked per document). Extraction records the pages; the browser
// posts them with the text; the documents table stores them (never the scan). A review, fresh or
// reopened, carries scanned: { pages, pageCount } so the interface can say how much came from a scan.
// Pure: no imports.

/**
 * Checks posted or stored OCR pages: ascending, distinct, positive integers, none over pageCount.
 * pageCount is a positive integer or null (unknown). Missing pages read as none.
 * @returns {{ pages: number[], pageCount: number | null } | null} null when the value is not that shape
 */
export function readScannedPages(pages, pageCount) {
  const count = pageCount == null ? null : pageCount;
  if (count !== null && !(Number.isInteger(count) && count > 0)) return null;
  if (pages == null) return { pages: [], pageCount: count };
  if (!Array.isArray(pages)) return null;
  let last = 0;
  for (const p of pages) {
    if (!Number.isInteger(p) || p <= last || (count !== null && p > count)) return null;
    last = p;
  }
  return { pages: [...pages], pageCount: count };
}

/**
 * What a review says about scanned pages: null when none were read by OCR. When OCR ranges exist but no
 * page list does (an older row), the note still shows, with the page count unknown, erring toward
 * telling the Reviewer.
 * @param {{ pages: number[], pageCount: number | null }} checked readScannedPages output
 * @param {[number, number][]} ocrRanges checked OCR ranges
 * @returns {{ pages: number | null, pageCount: number | null } | null}
 */
export function scannedNote(checked, ocrRanges = []) {
  const n = checked?.pages?.length ?? 0;
  if (n > 0) return { pages: n, pageCount: checked.pageCount ?? null };
  if (Array.isArray(ocrRanges) && ocrRanges.length > 0) return { pages: null, pageCount: null };
  return null;
}
