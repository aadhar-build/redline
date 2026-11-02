# Redline

## Read first
- research/summary.md holds the user research. Read it before deciding what the product should do.
- The brief lives in PRD.md once it exists. Read it before building; if it is missing, ask before building.
- CONTEXT.md is the glossary. Here the Reviewer is the person using Redline, the Owner is the small-business owner who signs the contract, and the product owner is the person who owns Redline.
- Spec decisions made after PRD.md was written live in docs/adr/ and the wayfinder map at .scratch/spec-gaps/map.md.

## Scope
Build these capabilities and stop there:
1. Plain-English summary of the uploaded document
2. Clauses that could hurt the Owner, grouped by severity (not ranked within a level, ADR 0003), each showing its exact source sentence
3. A drafted counter-offer for each flagged clause, Know this flags included
4. A question box that answers only from the document, citing its checked source sentences
5. An editable list of the Reviewer's own red lines that drives the analysis
6. A saved library of the Reviewer's past documents
7. A Clean result when there is one (ADR 0006)
8. The Outside reference flow (ADR 0007)
9. Copy all as text

- When something looks like the obvious next step and is not on this list, ask first.
- Excluded on purpose: payments and billing, sharing a document between accounts. This version exists to prove the analysis can be trusted, and neither makes it more trustworthy.

## Settled decisions (not open for reinterpretation)
- Next.js, Supabase for auth and database, deployed on Vercel.
- The uploaded file is parsed in the browser. Only the extracted text is sent and stored; the original file never leaves the browser.
- Accept PDF, DOCX and pasted text. PDF pages with a real text layer use their embedded text; image-only pages and scans with a hidden OCR layer are read by in-browser OCR, and that text is treated like any other (ADR 0008). OCR engine: ppu-paddle-ocr with self-hosted PP-OCRv6 small models (ADR 0008).
- Parsers: pdfjs-dist for PDF, JSZip with our own document.xml reader for DOCX.
- English-language Indian small-business contracts. Other languages are rejected with a clear message. Market standard comes from a curated, dated table (ADR 0009).
- For now, analysis runs only on the product owner's machine: server-side code calls the unmodified Claude Code CLI, signed in to the product owner's own Claude subscription, for the product owner's own testing. Never from the browser.
- Nothing deployed calls Claude. Anthropic's terms forbid routing a product's or other people's requests through a Pro/Max plan (code.claude.com/docs/en/legal-and-compliance). Before anyone but the product owner uses Redline, or before analysis runs on Vercel, stop and ask: that needs an API key.
- Never collect, store or pass around Claude account credentials or session tokens.
- The model is Sonnet 5.5 (claude-sonnet-5-5), chosen by the product owner on 2026-10-31.
- Documents and red lines belong to one account. No account can read another account's data; enforce it in the database, not only in the UI.

## Trust rules
- Every risk flag cites the exact sentence it came from. A flag whose source cannot be shown is a bug.
- Check each cited sentence against the stored document text before showing it, using the matching rule in ADR 0010. A quote from the model is not proof that the sentence exists. Show the matched stored text, not the model's string.
- A flag whose source fails the check is withheld. Show the Reviewer how many were withheld; any withheld flag blocks a Clean result.
- State only what the document says. Where the text does not support a claim, the product does not make it. This applies to the summary, flags, counter-offers and answers. Counter-offer wording may only restate or tighten terms already in the document, and the hedge-word ban covers it too. The exceptions are a Market-standard comparison backed by a row of the table, and a legal point that cites its statute (ADR 0009); anything else the document cannot prove is labelled Redline's judgment.
- When the answer to a question is not in the document, the question box says so instead of answering from general knowledge.

## Standing rules
- Keep credentials in .env.local, which is gitignored. Never commit a secret: a key is public the moment it is pushed and has to be rotated.
- The GitHub repo (aadhar-build/redline) is public. Check the staged diff for keys and tokens before every commit. Never commit a real contract or scan.
- Work on a feature branch and push as you go. Never push to main.
- Ask before adding a dependency. Approved so far: Vitest, @supabase/supabase-js, @supabase/ssr and the Supabase CLI, @playwright/test, pdfjs-dist, JSZip, and ppu-paddle-ocr (OCR, chosen 2026-10-31).
- All copy a Reviewer reads in this product, meaning the landing page, UI labels, error messages and empty states, has to be run through the humanizer skill before it is committed. Copy that reads as though a model wrote it is a defect, not a matter of taste.

## Working while unattended
- When a question comes up (a dependency, a step outside the scope, an unclear spec), add it to QUESTIONS.md, skip that item, and continue with in-scope work that does not depend on it. Do not guess on these.
- Do not record a capability as working until you have run it end to end against a real document.
