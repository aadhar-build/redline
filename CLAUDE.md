# Redline

## Read first
- research/summary.md holds the user research. Read it before deciding what the product should do.
- The brief lives in PRD.md once it exists. Read it before building; if it is missing, ask before building.

## Scope
Build these capabilities and stop there:
1. Plain-English summary of the uploaded document
2. Clauses that could hurt the user, ranked by severity, each showing its exact source sentence
3. A drafted counter-offer for each flagged clause
4. A question box that answers only from the document
5. An editable list of the user's own red lines that drives the analysis
6. A saved library of the user's past documents

- When something looks like the obvious next step and is not on this list, ask first.
- Excluded on purpose: payments and billing, OCR for scanned documents, sharing a document between users. This version exists to prove the analysis can be trusted, and none of these make it more trustworthy. OCR undermines it: a citation is worthless when the text it points at was misread.

## Settled decisions (not open for reinterpretation)
- Next.js, Supabase for auth and database, deployed on Vercel.
- The uploaded file is parsed in the browser. Only the extracted text is sent and stored; the original file never leaves the browser.
- Accept text-layer PDF, DOCX and pasted text. Reject scanned or image-only PDFs with a clear message instead of trying to read them.
- For now, analysis runs only on the owner's machine: server-side code calls the unmodified Claude Code CLI, signed in to the owner's own Claude subscription, for the owner's own testing. Never from the browser.
- Nothing deployed calls Claude. Anthropic's terms forbid routing a product's or other users' requests through a Pro/Max plan (code.claude.com/docs/en/legal-and-compliance). Before anyone but the owner uses Redline, or before analysis runs on Vercel, stop and ask: that needs an API key.
- Never collect, store or pass around Claude account credentials or session tokens.
- The model has not been chosen. Ask; do not pick one.
- Documents and red lines belong to one user. No user can read another user's data; enforce it in the database, not only in the UI.

## Trust rules
- Every risk flag cites the exact sentence it came from. A flag whose source cannot be shown is a bug.
- Check each cited sentence against the stored document text before showing it. A quote from the model is not proof that the sentence exists.
- State only what the document says. Where the text does not support a claim, the product does not make it. This applies to the summary, flags, counter-offers and answers.
- When the answer to a question is not in the document, the question box says so instead of answering from general knowledge.

## Standing rules
- Keep credentials in .env.local, which is gitignored. Never commit a secret: a key is public the moment it is pushed and has to be rotated.
- The GitHub repo (aadhar-build/redline) is public. Check the staged diff for keys and tokens before every commit.
- Work on a feature branch and push as you go. Never push to main.
- Ask before adding a dependency. This includes the PDF and DOCX parsers.
- All copy a user reads in this product, meaning the landing page, UI labels, error messages and empty states, has to be run through the humanizer skill before it is committed. Copy that reads as though a model wrote it is a defect, not a matter of taste.

## Working while unattended
- When a question comes up (a dependency, a step outside the scope, an unclear spec, the model choice), add it to QUESTIONS.md, skip that item, and continue with in-scope work that does not depend on it. Do not guess on these.
- Do not record a capability as working until you have run it end to end against a real document.
