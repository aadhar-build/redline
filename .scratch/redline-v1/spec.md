# Redline v1: Review a small-business contract before signing
Status: ready-for-agent

## Problem Statement

I am a Reviewer: the ops manager, bookkeeper, office manager or fractional COO who reads a contract on the Owner's behalf before the Owner signs it, and decides what to raise with the Counterparty. Sometimes I am the Owner as well. The contracts in front of me are negotiable and not yet signed: vendor agreements, commercial leases and client agreements.

The Owners I work for sign these contracts without knowing what is in them, and find the terms after signing, when there is nothing left to negotiate. The strongest case in the research is the FTC's action against First American, a payment processor that sold to small businesses:

> "defendants' sales people regularly promise businesses they will be able to cancel services any time or within a trial period without a fee, when the company's standard written agreement requires businesses to sign on to a three-year term with a $495 cancellation fee."

Source: FTC press release, July 2022, https://search.ftc.gov/news-events/news/press-releases/2022/07/ftc-takes-action-stop-payment-processor-first-american-trapping-small-businesses-surprise-exit-fees (research reference A1 F1). The FTC required $4.9 million in refunds.

The Adobe/Advanis survey of 274 SMB owners (January 2025, page verified, A4 F7), in the research agent's words, found that 62% of SMB owners signed without knowing the details, 60% found surprising terms after signing, and 91% engage with contracts monthly. A LegalShield survey (2025, snippet only, A4 F6) puts the share of small business owners who avoided a lawyer on cost at 60%; lawyer review of a commercial lease runs $750–$1,500 flat (snippet only, one marketplace source, A4 F2).

My side of the problem is that I have no quick way to find what to raise and to show the Owner where the contract says it. No evidence stands behind that statement; it is the product owner's judgment (ADR 0002).

The research also shows that not understanding the contract is not the whole problem. In First American the harm came from sales reps contradicting the written agreement and from paperwork only available in English; the research concludes that reading the document better would not have helped. A Counterparty with leverage can refuse any Counter-offer, and no source tested whether a plain-English Risk flag before signing changes what anyone does.

**What Reviewers do today is not in the research.** Ops managers, bookkeepers and office managers were never studied. Whether they read these contracts now, how, with what tools, and how long it takes is unknown (ADR 0002). Everything the research shows about current behaviour is about Owners: they sign without knowing the details, avoid lawyers on cost, pay a lawyer when they do, buy bundled legal subscriptions, or use ChatGPT.

## Solution

Redline v1 lets me, the Reviewer, put a contract in front of Redline before the Owner signs it and get back what to push back on, with the evidence beside every point.

- I upload a text-layer PDF or a DOCX file, or paste the text. The file is parsed in my browser; only the extracted text is sent and stored, and the original file never leaves my browser. A scanned or image-only PDF is rejected with a message saying why.
- I get a plain-English summary that states only what the document says.
- I get Risk flags. Each shows its Source sentence, which Redline's code has found word for word in the stored document text before showing it; a flag whose Source sentence is not found is withheld and counted, never shown without its source and never silently dropped. Each flag has one Severity: Don't sign as written, Negotiate or Know this. A clause matching one of my Red lines is always Don't sign as written. What a clause says is stated as fact; anything the Source sentence cannot prove, such as that a clause is an Unusual clause, is labelled Redline's judgment. Redline uses no hedge words. When it is unsure whether a clause hurts the Owner it flags it at Know this; when it is unsure what a clause means it shows an Ambiguous clause with each reading.
- I get a Counter-offer for each flagged clause: replacement wording I can send to the Counterparty.
- I can ask questions, and the question box answers only from the document, saying so when the answer is not in it.
- The analysis runs against my Red lines, which start as the four Default Red lines, each labelled with its basis. I can add, edit and remove them.
- Every sentence that brings in terms from a document I did not upload is raised as an Outside reference. Until I upload the referenced document or mark the reference as reviewed, the review cannot be a Clean result. Marking a reference as reviewed is my statement, not something Redline checked.
- When a review has no Don't sign as written or Negotiate flags and no unresolved Outside references, Redline says plainly that it is a Clean result, lists every Red line it checked, and shows any Know this flags beneath. It never says safe, fine or good to sign.
- My documents, reviews and Red lines stay in a saved library that no other account can read.

In v1 the analysis runs only on the product owner's machine, so no one but the product owner can use it until an API key is adopted, which needs the product owner's decision first.

## User Stories

1. As a Reviewer, I want to review a vendor agreement, commercial lease or client agreement before the Owner signs it, so that I can raise terms with the Counterparty while there is still something to negotiate.
2. As a Reviewer, I want to upload a text-layer PDF of a contract, so that I can review it without retyping it.
3. As a Reviewer, I want to upload a DOCX file of a contract, so that I can review a draft the Counterparty sent in Word format.
4. As a Reviewer, I want to paste the text of a contract, so that I can review terms that reached me in an email or on a web page.
5. As a Reviewer, I want a scanned or image-only PDF rejected with a message that says why, so that I know to find a text-layer copy instead of getting a review of text Redline never read.
6. As a Reviewer, I want no analysis to run and nothing to be stored when my upload is rejected, so that a rejected document leaves nothing half-reviewed behind.
7. As a Reviewer, I want the file parsed in my browser, with only the extracted text sent and stored, so that the original contract file never leaves my browser.
8. As a Reviewer, I want a plain-English summary of the contract, so that I can tell the Owner what it covers without them reading every clause.
9. As a Reviewer, I want the summary to state only what the document says, so that I never repeat to the Owner something the contract does not support.
10. As a Reviewer, I want every Risk flag to show the Source sentence it came from, so that I can find that sentence in my own copy of the document and judge the flag myself.
11. As a Reviewer, I want Redline's code, not the model, to find each Source sentence word for word in the stored document text before the flag is shown, so that no Risk flag rests on a sentence the contract does not contain.
12. As a Reviewer, I want a Risk flag whose Source sentence is not found to be withheld, so that I am never shown a flag without its source.
13. As the product owner, I want every withheld flag counted and recorded, never silently dropped, so that I can see how often the model's output fails the Source sentence check.
14. As a Reviewer, I want each Risk flag to carry exactly one Severity, Don't sign as written, Negotiate or Know this, so that I know my next action for that clause.
15. As a Reviewer, I want flags within a Severity level left unranked against each other, so that Redline does not present an order it has no basis for.
16. As a Reviewer, I want a clause that matches one of my Red lines always marked Don't sign as written, whatever Market standard says, so that a term my business will not accept never appears at a lesser Severity.
17. As a Reviewer, I want a clause that matches no Red line to get its Severity from how far it departs from Market standard, so that boilerplate I already expect does not crowd the top level.
18. As a Reviewer, I want what a clause says stated as fact beside its Source sentence, so that I can check each statement against the document.
19. As a Reviewer, I want any claim the Source sentence cannot prove, such as that a clause is an Unusual clause, labelled Redline's judgment, so that I can tell what the document says from what Redline concludes.
20. As a Reviewer, I want Redline's own text free of hedge words such as "may", "could potentially" and "consider consulting a lawyer", so that I get output I can act on.
21. As a Reviewer, I want a clause Redline is unsure hurts the Owner flagged at Know this, so that a possible harm still reaches me without weakening Don't sign as written.
22. As a Reviewer, I want Don't sign as written kept for Red line matches and clear cases, so that the top level still means Redline is sure.
23. As a Reviewer, I want a clause Redline is unsure the meaning of shown as an Ambiguous clause with each possible reading, and no reading chosen, so that I can raise the wording with the Counterparty instead of relying on a guess.
24. As a Reviewer, I want a Counter-offer for each flagged clause, so that I have replacement wording ready to send to the Counterparty.
25. As a Reviewer, I want to ask a question about the contract and get an answer drawn only from the document, so that I can check a detail without rereading the whole contract.
26. As a Reviewer, I want the question box to say when the answer is not in the document, so that I never mistake general knowledge for what the contract says.
27. As a Reviewer, I want no claim the document does not support in the summary, Risk flags, Counter-offers or answers, so that everything I take to the Owner traces back to the contract.
28. As a Reviewer, I want my Red lines pre-filled with the four Default Red lines, so that my first document gets a Red line analysis.
29. As a Reviewer, I want each Default Red line labelled with its basis, including the one that rests only on the product owner's judgment, so that I know how much evidence stands behind each.
30. As a Reviewer, I want the Default Red line for a personal guarantee, so that a clause making the Owner personally liable for the business's obligations is marked Don't sign as written.
31. As a Reviewer, I want the Default Red line for auto-renewal with an exit fee or a minimum term over 12 months, so that terms like First American's three-year term with a $495 cancellation fee are marked Don't sign as written even where they are Market standard.
32. As a Reviewer, I want the Default Red line for the Counterparty changing terms or prices without the Owner's consent, so that a clause letting the Counterparty alter the deal on its own is marked Don't sign as written.
33. As a Reviewer, I want the Default Red line for uncapped indemnity or liability carried by the Owner, so that a clause making the Owner answerable for losses with no upper limit is marked Don't sign as written.
34. As a Reviewer, I want to add my own Red lines, so that the terms my business will not accept drive the analysis.
35. As a Reviewer, I want to edit any Red line, including a Default Red line, so that the list states my business's terms in its own words.
36. As a Reviewer, I want to remove any Red line, including a Default Red line, so that the analysis stops treating a term my business accepts as one it will not.
37. As a Reviewer, I want a clause that matched a Red line I have removed to no longer be marked a Red line match in a review run after the removal, so that the review reflects my current list.
38. As a Reviewer, I want every sentence that brings in terms from a document I did not upload (a web address, a Statement of Work, an Order Form, terms "as amended from time to time") raised as a Risk flag with that sentence as its Source sentence, so that I know which terms Redline never saw.
39. As a Reviewer, I want a review with any unresolved Outside reference to be unable to be a Clean result, so that Redline never gives a Clean result on a contract whose referenced terms it never read.
40. As a Reviewer, I want to resolve an Outside reference by uploading the referenced document, so that the terms it brings in are in front of Redline.
41. As a Reviewer, I want to resolve an Outside reference by marking it as reviewed, so that a reference I have checked myself stops standing in the way of a Clean result.
42. As a Reviewer, I want a reference I mark as reviewed recorded as my statement and not as something Redline checked, so that no one reading the review mistakes my check for Redline's.
43. As a Reviewer, I want Redline never to fetch a referenced document itself, so that only text I have put in front of it is analysed and stored.
44. As a Reviewer, I want a review with no Don't sign as written or Negotiate flags and no unresolved Outside references to say plainly that it is a Clean result, so that I do not have to infer it from an empty list.
45. As a Reviewer, I want a Clean result to list every Red line on my list at the time of analysis, so that I can show the Owner what was checked.
46. As a Reviewer, I want any Know this flags shown beneath a Clean result, so that the Owner still learns about clauses worth knowing.
47. As a Reviewer, I want a Clean result never to use the words safe, fine or good to sign, so that I never hand the Owner a verdict Redline cannot back up.
48. As a Reviewer, I want a saved library of my past documents and their reviews, so that I can return to a contract and its Risk flags later.
49. As a Reviewer, I want my Red lines saved to my account, so that I do not re-enter them for each contract.
50. As a Reviewer, I want no other account to be able to read my documents or Red lines, so that the contracts I review stay private to my account.
51. As the product owner, I want account isolation enforced by database policy and not only by the interface, so that another account querying the database directly gets nothing.
52. As the product owner, I want analysis to run only on my own machine, through server-side code calling the unmodified Claude Code CLI signed in to my own Claude subscription, so that Redline stays within Anthropic's terms.
53. As the product owner, I want Claude never called from the browser, so that no request to Claude comes from anywhere but server-side code on my machine.
54. As the product owner, I want no deployed code to call Claude, so that no one else's requests are routed through my Pro or Max plan.
55. As the product owner, I want Claude account credentials and session tokens never collected, stored or handed on, so that no one's Claude account is exposed through Redline.
56. As the product owner, I want every call to Claude to go through one model adapter, so that adopting an API key later means replacing that adapter only.
57. As the product owner, I want the model left unchosen until I choose it, so that the build does not commit to a model I have not agreed to.
58. As the product owner, I want PDF and DOCX parsers and every other dependency added only with my agreement, so that nothing enters the build without my agreement.
59. As the product owner, I want Review tested through a fake model adapter that returns scripted output, so that tests run without calling Claude and with output I control.
60. As the product owner, I want tests where the fake model adapter returns altered and invented Source sentences, so that I can prove every one is withheld, none is shown, and the recorded count equals the number withheld.
61. As the product owner, I want fixture documents with known sentences and a seeded clause for every Default Red line in each contract type, including one modelled on the First American terms, so that I can prove each is flagged Don't sign as written with the seeded sentence as its Source sentence.
62. As the product owner, I want fixtures seeded with each kind of Outside reference, so that I can prove each becomes a Risk flag, blocks a Clean result while unresolved, and stops blocking once uploaded or marked reviewed.
63. As the product owner, I want fixtures with clauses written to support two readings, so that I can prove each is shown as an Ambiguous clause with its readings and no reading chosen.
64. As the product owner, I want a question set written against fixtures that includes questions the document does not answer, so that I can prove the question box says the answer is not in the document.
65. As the product owner, I want Redline's own text checked for whole-word hedge words and verdict words, excluding Source sentences and other text reproduced word for word from the document, so that ADR 0005 and ADR 0006 are held to in every test run.
66. As the product owner, I want a network check while uploading a PDF and a DOCX file, so that I can prove only extracted text leaves the browser.
67. As the product owner, I want a second account to query the database directly for the first account's documents and Red lines in a test, so that I can prove no rows come back.
68. As the product owner, I want the deployed build checked for any code path that calls Claude, so that I can prove nothing deployed does.
69. As the product owner, I want the same Review seam to run later with the real model adapter against real contracts, so that the eval suite measures the product Reviewers get and not a separate harness.
70. As the product owner, I want no capability recorded as working until it has run end to end against a real document, so that success on fixtures is not mistaken for a working product.

## Implementation Decisions

Only decisions already settled in CLAUDE.md, PRD.md and ADRs 0001–0007 are recorded here. Everything still undecided is listed under Further Notes.

**Stack.** Next.js for the application, Supabase for auth and database, deployed on Vercel.

**Modules and their interfaces.**

- **Review** is the main module and the main test seam. It takes the document text, the Reviewer's Red lines, and a model adapter. It returns a review containing: the plain-English summary; the Risk flags, each with its Source sentence, its Severity, its Counter-offer, and whether it is a Red line match or a claim labelled Redline's judgment; the Outside references with their resolution state; the Ambiguous clauses with their readings; the count of withheld flags; and whether the review is a Clean result, together with the list of Red lines checked. Review also answers a question against the document text, returning either an answer or a not-in-document result. Review's callers see only this interface; how it prompts the model and assembles the review is internal to it.
- **Source sentence check** lives inside Review. It is done by Redline's code, not by the model: model output is untrusted, every Source sentence the model returns is looked for word for word in the stored document text, and a flag whose Source sentence is not found is withheld and added to the withheld count rather than returned among the Risk flags (ADR 0001). The rule for what counts as the same sentence is not yet written (open question 9).
- **Model adapter** is the only boundary to Claude. For local runs it calls the unmodified Claude Code CLI, signed in to the product owner's own subscription, from server-side code, never from the browser. Tests use a fake adapter that returns scripted output, including altered and invented Source sentences. Adopting an API key later means replacing the adapter only. The model is not chosen.
- **Extraction** runs in the browser. It takes a text-layer PDF, a DOCX file or pasted text and returns either the extracted text or, for an image-only PDF, a rejection with a reason. Only extracted text leaves the browser; the original file never does.
- **Library and Red lines storage** stores extracted text, reviews and Red lines per account in Supabase. Isolation between accounts is enforced by database policy, not only by the interface.

**Constraints the build must respect.**

- The PDF and DOCX parser choices, and every other dependency, need the product owner's agreement before they are added.
- Claude account credentials and session tokens are never collected, stored or handed on.
- Nothing deployed calls Claude. No one but the product owner can use v1's analysis, and analysis cannot run on Vercel, until an API key is adopted, which needs the product owner's decision first.
- No OCR: image-only PDFs are rejected, not read (ADR 0001).
- Redline does not fetch referenced documents itself (ADR 0007).

## Testing Decisions

**What a good test is.** A good test exercises external behaviour through a seam: it gives inputs and checks outputs. It does not depend on internal structure, prompts or intermediate steps, so the internals of a module can change without breaking its tests.

**Three seams, agreed with the product owner.**

1. **Review (main seam).** Document text, Red lines and the fake model adapter go in; the full review comes out. This seam covers PRD.md section 4 criteria 1–12 and 17: Source sentences found in the stored text (1), withheld flags and their count (2), Default Red line matches (3), removing a Default Red line (4), Red lines the Reviewer adds (5), Outside references (6), Clean result content (7), hedge words and verdict words (8), unusualness claims labelled Redline's judgment (9), questions not answered by the document (10), Ambiguous clauses (11), Counter-offers (12), and claims the document does not support (17). Criteria 9 and 17 are read by a person. Fixture documents are written for the purpose, with known sentences and seeded clauses: every Default Red line in each contract type (including one modelled on the First American terms, and with Default Red lines 2 and 4 seeded within a single sentence until open question 10 is settled), each kind of Outside reference, clauses with two readings, questions the document does not answer, and scripted model output with altered or invented Source sentences.
2. **Extraction (edge seam, browser).** A text-layer PDF, a DOCX file or pasted text goes in; extracted text or a rejection comes out. A network check confirms that only extracted text is sent while uploading a PDF and a DOCX file. This seam covers criterion 13 (an image-only PDF is rejected with a reason, no analysis runs, nothing is stored) and criterion 14 (only extracted text leaves the browser).
3. **Isolation (edge seam, database).** A second account queries the database directly, not through the interface, for the first account's documents and Red lines, and gets no rows. This seam covers criterion 15.

**Outside the seams.** Criterion 16, that no code path calls Claude, is checked against the deployed build, not through a seam.

**Evals later.** The same Review seam, with the real model adapter in place of the fake, is where the eval suite on real contracts will run later.

**Prior art.** None. The repo has no application code or tests yet.

**What the tests cannot yet measure** (PRD.md section 4):

- No test set of real vendor agreements, commercial leases or client agreements exists; every criterion runs on fixtures.
- The matching rule for "the same sentence" is not written, so criterion 1 cannot run until it is (open question 9).
- No targets exist for misses, false alarms, the share of documents that should produce a Clean result, or how many Know this flags is too many. Nor is there a basis for whether a non-Red-line clause got the right Severity, or a definition of a "clear case" for Don't sign as written.
- Accuracy on questions the document does answer and the quality of Counter-offer wording have no target, and no method for catching claims the document does not support has been decided.
- CLAUDE.md requires a run end to end against a real document before any capability counts as working; success on fixture tests is not enough.

## Out of Scope

- Payments and billing: v1 exists to prove the analysis can be trusted, and billing does not make it more trustworthy.
- OCR for scanned documents: a Source sentence pointing into misread text is worthless.
- Sharing a document between accounts: it does not make the analysis more trustworthy.
- Missing protection flags: a Missing protection has no Source sentence to show; showing them needs a separate decision (ADR 0001).
- Risks that come from several clauses together: there is no rule yet for showing more than one Source sentence (ADR 0001).
- After-signing help, such as exit terms and cancellation deadlines: Counter-offers are useless once signed (ADR 0002).
- Freelancer documents: their worst harm is a Missing protection, which cannot be flagged (ADR 0002).
- Consumer and renter documents: no Counterparty negotiates them, so a Counter-offer has nowhere to go (ADR 0002).
- Fetching referenced documents: files are parsed in the browser and only uploaded text is stored (ADR 0007).
- A numeric 1–10 scale in place of Severity: false precision a Reviewer cannot explain to an Owner (ADR 0003).
- Ranking flags within a Severity level: ADR 0003 settles that flags within a level are not ranked.
- A "safe" or "looks good" verdict: it is the claim Redline can least back up (ADR 0006).
- Analysis for anyone but the product owner, or on Vercel, until an API key is adopted: Anthropic's terms forbid routing other people's requests through a Pro or Max plan.
- Anything else that looks like the obvious next step: not in scope; ask the product owner first.

## Further Notes

### Open questions

Carried from PRD.md section 3. All are **undecided**, and each blocks the parts of the build it touches; an unattended build records the question and skips that part rather than guessing.

1. What Severity does an Outside reference flag get?
2. What does the Counter-offer for an Outside reference say?
3. Does "as amended from time to time" count as a match for Default Red line 3? If it does, it is Don't sign as written, and marking it reviewed would not produce a Clean result.
4. Does a Know this flag get a Counter-offer?
5. Is an Ambiguous clause a Risk flag, at what Severity, and does it block a Clean result?
6. What is Market standard based on for each contract type: vendor agreement, commercial lease, client agreement?
7. How does Redline decide which of the three contract types a document is, and what happens when it is none of them?
8. Does a fee escalator written into the contract match Default Red line 3, or only a change the Counterparty makes later?
9. What is the written matching rule for "the same sentence", given that PDF and DOCX extraction changes line breaks, hyphenation and whitespace?
10. What is the rule for a risk that comes from several sentences together? Default Red lines 2 and 4 depend on it.
11. Where is the count of withheld flags shown: to the Reviewer, or only recorded?
12. Can a review be a Clean result when flags were withheld?
13. Do question-box answers show the Source sentences they rely on?
14. Does the hedge-word ban apply to Counter-offer wording, where "may" is ordinary contract language?
15. What happens to an uploaded referenced document: is it analysed on its own, together with the document that referenced it, and against the Red lines?
16. How is a Red line the Reviewer writes in their own words matched against clauses?
17. When the Reviewer edits their Red lines, are saved documents re-analysed, and does each saved review keep the list of Red lines it was checked against?
18. How is a PDF with a text layer on some pages and only images on others handled?
19. Which languages are documents and output in?
20. Which model runs the analysis?
21. Which PDF and DOCX parsers?

### Contradictions in CLAUDE.md that need the product owner's decision before an unattended build

1. CLAUDE.md's scope says flags are "ranked by severity"; ADR 0003 says flags within a Severity level are not ranked against each other.
2. CLAUDE.md's scope lists six capabilities and says "stop there", but the list omits Clean results (ADR 0006) and the Outside reference flow (ADR 0007).
3. CLAUDE.md says "user" and uses "owner" for the product owner; CONTEXT.md says Reviewer and uses Owner for the small business owner who signs the contract.
4. CLAUDE.md applies "state only what the document says" to Counter-offers, which are new wording by definition.

### Pointers

PRD.md is the brief, CONTEXT.md is the glossary, and docs/adr/ holds the decisions.
