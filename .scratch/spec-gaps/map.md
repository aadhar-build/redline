# Map: close the spec gaps in Redline v1

Label: wayfinder:map
Tickets: `.scratch/spec-gaps/issues/` (local-markdown tracker, docs/agents/issue-tracker.md)

## Destination

Every implementation ticket in `.scratch/redline-v1/issues/` has a Blocked-by line that names only other implementation tickets (no OQ or C references), every PRD.md section 3 open question a v1 ticket depends on is marked decided with a link to its ticket here, and the dependencies those tickets need are approved.

## Notes

- Domain: the product spec for Redline v1. Read CLAUDE.md, CONTEXT.md, PRD.md, `.scratch/redline-v1/spec.md` and docs/adr/ before working a ticket.
- Grilling tickets call the grilling and domain-modeling skills. Any copy a Reviewer will read goes through the humanizer skill.
- HITL tickets resolve only from the product owner's own answer. A recommended option is not an answer. If no answer comes, the ticket stays open and the question goes into QUESTIONS.md.
- Each resolution flows back to three places: the PRD.md section 3 entry (marked decided, linked here), `.scratch/redline-v1/spec.md` Further Notes, and the Blocked-by line of every implementation ticket it unblocks. A new ADR is written when the decision is one ADR-worthy (domain-modeling skill decides).
- Execution override (owner, 2026-10-31: "as they start getting clarity, lets push to development"): once an implementation ticket's blockers are all cleared, it may be built on its own feature branch and pushed. Never to main. No Vercel deploy without asking.
- Unattended build rules (owner, 2026-10-31): finished ticket branches merge into `development` (cut from the spec branch) once tests and build pass; never main. Up to 3–4 implementers at once on non-overlapping tickets. The Claude Code CLI may run `claude -p --model claude-sonnet-5-5` on this machine with no cap. If a ticket fails after two retries, consult a Fable advisor, then try two more times before logging it in QUESTIONS.md. Sign-in is Supabase email magic link. Sample documents: a mix of public Indian contracts and other public English contracts, kept in ~/redline-samples with a source index, never committed. A hosted Supabase project is approved.
- Also approved 2026-10-31: @supabase/ssr for magic-link sessions; hosted Supabase project in Mumbai (ap-south-1), keys into the Vercel project env. "Live" means the protected Vercel preview of `development` with everything except analysis; analysis runs only on the product owner's machine (no API key adopted). The owner promotes to main.
- From 2026-10-31 the working branch for spec and code is `development`; `spec/wayfinder-gaps` is frozen.
- Hosted Supabase created 2026-10-31: project `redline` (ref kwtpcbbvurfahgnhohmb, Mumbai), migrations 01–02 pushed; NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in Vercel for Preview on `development`. DB password lives only in the integration worktree's .env.local. Still to do when ticket 10 lands: allow the preview URLs as auth redirect URLs.
- C1 (ranking within a Severity level) is already settled: grouped by level, not ranked (ADR 0003, CLAUDE.md edit 2026-10-20).

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->
- [Approve the dependencies the first build needs](issues/01-approve-dependencies-for-the-first-build.md): Approved: Vitest (dev), @supabase/supabase-js plus the Supabase CLI (dev) for a local database, @playwright/test (dev), and Vercel project access for ticket 01's deployed-build check.
- [Which of Clean result, Outside references and Copy all join the scope](issues/02-scope-of-clean-result-outside-references-and-copy-all.md): All three join the scope: Clean result (ADR 0006), the Outside reference flow (ADR 0007) and Copy all as text (implementation ticket 20).
- [How the truth rule and the hedge-word ban apply to Counter-offer wording](issues/03-truth-rule-and-hedge-words-in-counter-offer-wording.md): Both rules apply to the Counter-offer wording itself: a Counter-offer may only restate or tighten terms already in the document (no new terms the document does not contain), and the hedge-word ban covers the proposed wording too, so 'may' and similar words are not allowed in it.
- [Whether a Know this flag gets a Counter-offer](issues/04-know-this-flags-and-counter-offers.md): Yes: every flag gets a Counter-offer, Know this included.
- [Which model runs the analysis](issues/05-which-model-runs-the-analysis.md): Sonnet 5.5 (claude-sonnet-5-5) runs the analysis through the local Claude Code CLI adapter.
- [What browser PDF and DOCX parsers exist and what each can detect](issues/06-browser-pdf-and-docx-parser-options.md): Research: [06-browser-pdf-and-docx-parsers.md](research/06-browser-pdf-and-docx-parsers.md).
- [Which PDF and DOCX parsers to adopt](issues/07-which-pdf-and-docx-parsers.md): pdfjs-dist for PDF (worker wired into Next.js by us, our own per-page text-layer detection) and JSZip plus our own document.xml reader for DOCX, so auto-numbered clause labels are kept.
- [How a PDF with text on some pages only is handled](issues/08-pdfs-with-text-on-some-pages-only.md): Reverses the OCR exclusion (ADR 0008).
- [What extraction does to a sentence](issues/09-what-extraction-does-to-sentences.md): Research: [09-what-extraction-does-to-sentences.md](research/09-what-extraction-does-to-sentences.md).
- [The written rule for what counts as the same sentence](issues/10-the-same-sentence-matching-rule.md): The written rule (OQ9, ADR 0001): (1) Span: a model's quote may be part of a sentence but must start and end on sentence boundaries; an ellipsis is never a wildcard and makes the quote altered.
- [The rule for a risk that comes from several sentences](issues/11-risks-that-come-from-several-sentences.md): A flag may cite several Source sentences; each is checked word for word, and the flag is withheld if any one fails.
- [What Default Red line 3 covers](issues/12-what-default-red-line-3-covers.md): Both match Default Red line 3, so both are Don't sign as written: terms 'as amended from time to time', and fee escalators already written into the contract.
- [Severity and Counter-offer for an Outside reference](issues/13-outside-reference-severity-and-counter-offer.md): An Outside reference flag is Negotiate (an 'as amended from time to time' reference is Don't sign as written through Default Red line 3, ticket 12).
- [What happens to an uploaded referenced document](issues/14-what-happens-to-an-uploaded-referenced-document.md): Analysed together with the document that referenced it, as one review, against the Red lines; each flag cites the sentence in whichever document it came from.
- [Where Ambiguous clauses sit against Risk flags and the Clean result](issues/15-ambiguous-clauses-and-the-clean-result.md): An Ambiguous clause is a Risk flag at Negotiate, shown with each possible reading, and it blocks a Clean result.
- [Where withheld flags are shown and whether they block a Clean result](issues/16-withheld-flags-and-the-clean-result.md): The withheld count is shown to the Reviewer ('N flags withheld because their source couldn't be found'), and any withheld flag blocks a Clean result.
- [Whether question-box answers show their Source sentences](issues/17-question-box-answers-and-source-sentences.md): Yes, each answer cites its sentences, checked like flags.
- [What sources could ground Market standard per contract type](issues/18-market-standard-sources.md): Research: [18-market-standard-sources.md](research/18-market-standard-sources.md).
- [What Market standard is based on and how the contract type is decided](issues/19-market-standard-basis-and-contract-type.md): OQ6: Market standard for Indian English-language contracts is a curated, dated reference table per contract type and clause type, each row citing its source and date (GeM general terms, MSMED Act, Maharashtra leave-and-licence format, broker reports where marked as such).
- [How the Reviewer's own Red lines are matched and what edits do to saved reviews](issues/20-red-lines-in-the-reviewers-own-words.md): OQ16: a Red line in the Reviewer's own words goes to the model with the document; each match names the Red line it matched and cites its Source sentence, checked like any flag.
- [Which languages documents and output are in](issues/21-document-and-output-languages.md): English only for v1: English documents, English output; a non-English document is rejected with a clear message.
- [Align CLAUDE.md's 'user' and 'owner' with CONTEXT.md](issues/22-reviewer-and-owner-wording-in-claude-md.md): Approved: align CLAUDE.md wording with CONTEXT.md (Reviewer, Owner, product owner) and record today's settled decisions in it.
- [What OCR engines run in the browser and how well they read contracts](issues/23-browser-ocr-engines.md): Research: [23-browser-ocr-engines.md](research/23-browser-ocr-engines.md).
- [What sources could ground Market standard for Indian small-business contracts](issues/25-india-market-standard-sources.md): Research: [25-india-market-standard-sources.md](research/25-india-market-standard-sources.md).
- [What the Counter-offer for an Outside reference says](issues/26-outside-reference-counter-offer.md): The Counter-offer for an Outside reference asks that the referenced document be attached as a schedule and that its terms be fixed as at the signing date, changing only by written agreement of both parties.
- [Draft the India Market standard table for the owner to approve](issues/28-india-market-standard-table.md): only the three statute rows approved; no lease or vendor practice rows in v1.
- [How a statute citation is checked before it is shown](issues/29-statute-citation-check.md): a fixed approved list; the model selects by id and Redline shows the entry's own text.
- [Which OCR engine to adopt](issues/24-which-ocr-engine.md): ppu-paddle-ocr with self-hosted PP-OCRv5 English models; the only permissive option that reads ₹.

## Not yet specified

- **Open tickets now:** verifying the three statute rows against the official text (30). OCR engine chosen (24); ticket 27 validates it.

- **Eval targets.** PRD.md section 4 "Numbers that are unset": targets for misses, false alarms, Clean result share, how many Know this flags is too many, and a method for catching unsupported claims. Becomes sharp once the model (ticket 05) and Market standard basis (ticket 19) are known and a first real run exists.
- **What a "clear case" for Don't sign as written is**, outside Red line matches (ADR 0005). Probably falls out of ticket 19.
- **Real test contracts.** No test set of real vendor agreements, leases or client agreements exists; where they come from is a task ticket once the eval targets are clearer.

## Out of scope

- Payments and sharing between accounts: excluded in CLAUDE.md.

- Missing protection flags and after-signing help: ADR 0001, ADR 0002.
