# 19: PDFs with text on some pages only

**What to build:** A PDF with a text layer on some pages and only images on others is handled as decided, so no Clean result is given on terms Redline never read.

**Blocked by:** 05 (Upload a text-layer PDF or DOCX file); OCR engine choice (../../spec-gaps/issues/24-which-ocr-engine.md)

**Decisions (2026-10-31):** OQ18 / ADR 0008: accept mixed PDFs; OCR the pages without real text, including scans with a hidden OCR layer; no special marking.

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] A mixed-page PDF fixture gives the outcome OQ18 decides, with its reason if rejected (PRD criterion 13).
- [ ] The network check still shows only extracted text leaving the browser (PRD criterion 14).
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
