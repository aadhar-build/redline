# 19: PDFs with text on some pages only

**What to build:** A PDF with a text layer on some pages and only images on others is handled as decided, so no Clean result is given on terms Redline never read.

**Blocked by:** 05 (Upload a text-layer PDF or DOCX file); OQ18 (PRD.md section 3, open question 18)

**Needs approval for:** None

**Status:** ready-for-agent

- [ ] A mixed-page PDF fixture gives the outcome OQ18 decides, with its reason if rejected (PRD criterion 13).
- [ ] The network check still shows only extracted text leaving the browser (PRD criterion 14).
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
