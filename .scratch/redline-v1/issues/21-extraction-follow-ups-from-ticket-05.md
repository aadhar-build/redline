# 21: Extraction follow-ups from ticket 05's open decisions

**What to build:** the five extraction rulings below, settled by a Fable advisor on 2026-10-31 under the product owner's question rule.

**Blocked by:** 05 (Upload a text-layer PDF or DOCX file)

**Status:** ready-for-agent

1. **DOCX footnotes and endnotes are read** (high). Append after the body under one plain line each, "Footnotes" then "Endnotes", one note per paragraph with a blank line between, in document order. DOCX headers and footers stay skipped (medium): they sit outside the body, so skipping never splits a sentence.
2. **Hidden Word text** (run-level w:vanish) stays out of the stored text, but is counted (medium). When at least one hidden run contains a word, the upload shows a one-line notice that the file has text Word hides and Redline didn't read it. Copy through the humanizer. Style-inherited hiding is out of scope.
3. **File-size cap 100 MB** (high), checked on the File object before parsing; the rejection states the limit.
4. **Scan detection thresholds confirmed** (medium on numbers): image covers at least 50% of the page and fewer than 50 visible characters, or invisible text at least equal to visible text. Keep all 13 real samples as local regression checks (never committed). **English check** (high on approach): judge the whole document by the share of Latin-script letters and common-word hits, never by the presence of other scripts, so Hindi stamp-paper headers, Devanagari seals and ₹ don't reject an English contract; run it on the final text, after OCR.
5. **PDF running headers and page numbers are stripped at extraction** (high on a, medium on b), only for lines whose baseline is in the top or bottom 10% of the page: (a) a page-number line (`/^(page\s+)?\d+(\s+of\s+\d+)?$/i` or `/^[-–]?\s*\d+\s*[-–]?$/`) is removed on every page; (b) a line that, with digits replaced by "#" and whitespace collapsed, appears in the same band on at least 3 pages and at least half the pages is removed wherever it appears. Record the distinct removed strings and counts per upload. Applies to OCR pages once line boxes are wired.

- [ ] Each ruling has a test; fixture: a PDF with a sentence crossing a "Page 2 of 3" footer, whose quote passes after stripping.
- [ ] The 13 real samples still classify correctly (run locally, results summarised in the ticket, no document text committed).
- [ ] New copy through the humanizer.
