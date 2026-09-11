# 05: Upload a text-layer PDF or DOCX file

**What to build:** The file is parsed in the browser and only extracted text is sent; an image-only PDF is rejected with a reason.

**Blocked by:** 01 (Pasted text gets a plain-English summary); OQ21 (PRD.md section 3, open question 21)

**Needs approval for:** PDF parser, DOCX parser, browser test tooling.

**Status:** ready-for-agent

- [ ] Extraction seam test in the browser extracts text from a text-layer PDF and a DOCX file.
- [ ] An image-only PDF is rejected with its reason; no request is sent, no analysis runs, nothing is stored (PRD criterion 13).
- [ ] A network check while uploading a PDF and a DOCX shows only extracted text in requests, no file bytes (PRD criterion 14).
- [ ] Fixtures include no PDFs with text on only some pages; those are ticket 19.
- [ ] All copy the Reviewer reads in this ticket has been run through the humanizer skill before commit (CLAUDE.md).
