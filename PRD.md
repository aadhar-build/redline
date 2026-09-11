# Redline v1 product brief

Status: draft, 2026-09-11.

Built from CLAUDE.md, CONTEXT.md, docs/adr/0001–0007 and research/. Capitalised terms are defined in CONTEXT.md. Research references read `A1 F1` = research/agent1-who-has-pain.md, item F1. "Snippet only" means the research agent saw the figure in a search result and could not open the page to check it.

## 1. Who this is for, and what they do today instead

### Who it is for
The Reviewer: the person who reads a contract on the Owner's behalf before the Owner signs it, and decides what to raise with the Counterparty. Examples: an ops manager, bookkeeper, office manager or fractional COO. The Owner and the Reviewer can be the same person (CONTEXT.md).

The contract is a negotiable small-business contract that has not been signed: a vendor agreement, a commercial lease or a client agreement (ADR 0002).

### Who it is not for
| Not for | Why (ADR 0002 unless noted) |
|---|---|
| Freelancers | Their worst harm is a Missing protection, which ADR 0001 rules out flagging, and only 28% use a written contract (A4 F9). |
| Consumers and renters: terms of service, gym contracts, card agreements, residential leases | Their terms are mostly non-negotiable, with no Counterparty to send a Counter-offer to; free substitutes exist (LeaseChat, ToS;DR, ChatGPT); no willingness-to-pay evidence. |
| Anyone who has already signed | Counter-offers are useless once signed. |
| An Owner who wants a sign or don't-sign verdict | Redline never gives one (ADR 0002, ADR 0006). |
| In v1, anyone other than the product owner | Analysis runs only on the product owner's machine (section 3, build constraint). |

### What happens today instead
Everything the research shows is about Owners:

| What Owners do | Evidence | Strength |
|---|---|---|
| Sign without knowing the details | In the research agent's words: "62% of SMB owners signed without knowing the details". Adobe/Advanis survey, Jan 2025, 274 SMB owners. https://blog.adobe.com/en/publish/2025/02/04/top-5-takeaways-from-new-contracts-survey-most-people-sign-before-they-read (A4 F7) | Page verified |
| Avoid lawyers on cost | In the research agent's words: "60% of small business owners avoided retaining a lawyer due to perceived cost and complexity". LegalShield, 2025, 299 owners or managers. https://www.businesswire.com/news/home/20250519395084/en/New-Study-Legal-Pitfalls-Dent-Small-Business-Owners-Bottom-Line-Yet-Most-Forgo-Counsel (A4 F6). A 2010 Rocket Lawyer survey put it at 51% (A4 F5). | Both snippet only; the 2010 figure is stale |
| Pay a lawyer, when they do | Commercial lease review $750–$1,500 flat for a basic review, $730 average (A4 F2); general business agreement review $300–$1,000 flat (A4 F3); $100–$750 an hour (A4 F4). https://www.contractscounsel.com/b/commercial-lease-review | Snippet only, all from one lead-generation marketplace (ContractsCounsel) |
| Buy a bundled legal subscription | Rocket Lawyer: $149, $249 or $349 a year. Contract review ("Rocket Copilot" flags key terms and red flags) is included in membership, not sold on its own; a 30-minute attorney session is $149. https://www.rocketlawyer.com/pricing (A4 F8) | Page verified |
| Use ChatGPT | The documented case is a New York City renter, a consumer outside this segment. https://www.foxnews.com/tech/woman-turns-to-chatgpt-after-landlord-tries-to-hike-rent-despite-broken-washing-machines.amp (A3 F7). The business-contract example, a "Commercial Lease GPT" that summarises an uploaded lease, is snippet only (A3 F7). | Consumer case verified; business case snippet only |

One product in the research is aimed at roles close to the Reviewer: goHeather lists business ops and finance teams, small firms and fractional GCs as its audience, and advertises risk-ordered flags, suggested redlines and document chat (A3 competitor table, page read: https://www.goheather.io/ai-contract-review-app). No independent review or usage data was found for it (A3 F9).

**What Reviewers do today is unknown.** The research never studied ops managers, bookkeepers or office managers (ADR 0002). Whether they read these contracts now, how, with what tools, and how long it takes is not in the research.

## 2. The problem
Small-business Owners sign negotiable contracts without knowing what is in them, and find the terms after signing, when there is nothing left to negotiate.

The strongest case for this segment, from the FTC's action against a payment processor that sold to small businesses:

> "defendants' sales people regularly promise businesses they will be able to cancel services any time or within a trial period without a fee, when the company's standard written agreement requires businesses to sign on to a three-year term with a $495 cancellation fee."

https://search.ftc.gov/news-events/news/press-releases/2022/07/ftc-takes-action-stop-payment-processor-first-american-trapping-small-businesses-surprise-exit-fees (A1 F1). The FTC required $4.9 million in refunds.

The Adobe/Advanis survey, in the research agent's words rather than Adobe's (Jan 6–12, 2025, 274 SMB owners, page verified; https://blog.adobe.com/en/publish/2025/02/04/top-5-takeaways-from-new-contracts-survey-most-people-sign-before-they-read, A4 F7):
- "62% of SMB owners signed without knowing the details"
- "Among SMB owners, 69% experienced negative emotions post-signing and 60% found surprising terms."
- "SMB owners engage with contracts very frequently (91% monthly, 45% weekly, 19% daily)."
- "The survey did **not** address willingness to pay for any such tool."

The Reviewer's side of the problem, that the person checking the contract has no quick way to find what to raise and to show the Owner where the contract says it, has no evidence behind it; it is the product owner's judgment (ADR 0002 says the segment choice "rests on the product's shape, not on evidence").

### Evidence that not understanding the contract is not the whole problem
- **First American itself.** The harm came from sales reps contradicting the written agreement, and from paperwork in a language the Owners could not read: "the paperwork is only available in English" (A1 F1). The research concludes that in this case reading the document better would not have helped (research/summary.md, section 5, item 1). A1 adds that a flag would help only if it reached the Owner in their language and was believed over the sales pitch (A1, section 5).
- **Leverage.** A2 describes the pattern as a comprehension gap plus leverage asymmetry: a clause is often non-negotiable whatever the reader understood (A2, section 1). Its examples are consumer contracts; the research has no data on how often a small-business Counterparty accepts a Counter-offer.
- **Concern without action.** In the research agent's words: "82% are concerned about protecting the business from contract-related financial liability, but most still forgo counsel — a stated concern/action gap" (A4 F6, snippet only).
- **No test of the core premise.** No source tested whether a plain-English flag before signing changes what people do (research/summary.md, section 5, item 6).

Why this segment anyway: Counter-offers only make sense where there is a live negotiation, such as "freelance clients, commercial leases, vendor contracts" (research/summary.md, section 5, item 3). The research calls small-business negotiable contracts the least weak case and adds: "The evidence justifies a narrow test of demand and price, not a build of the full product for everyone." (research/summary.md, section 5).

## 3. What the first version does
1. **Takes in a contract.** Accepts a text-layer PDF, a DOCX file or pasted text. The file is parsed in the browser; only the extracted text is sent and stored, and the original file never leaves the browser. A scanned or image-only PDF is rejected with a clear message saying why; Redline does not try to read it.
2. **Summarises it in plain English.** The summary states only what the document says.
3. **Raises Risk flags, each with its Source sentence.**
   - Every Risk flag shows the exact sentence it came from (ADR 0001).
   - Before a flag is shown, Redline's code (not the model) finds that sentence word for word in the stored document text. A flag whose Source sentence is not found is withheld and counted, never shown without its source and never silently dropped.
   - Each flag has one Severity: Don't sign as written, Negotiate or Know this (ADR 0003). Severity is set by how far the clause departs from Market standard, except that a Red line match is always Don't sign as written. Within a level, flags are not ranked against each other.
   - What a clause says is stated as fact, backed by its Source sentence. Any claim the Source sentence cannot prove, such as that a clause is an Unusual clause, carries the label Redline's judgment. No hedge words: never "may", "could potentially" or "consider consulting a lawyer" (ADR 0005).
   - When Redline is unsure whether a clause hurts the Owner, it flags it at Know this. Don't sign as written is kept for Red line matches and clear cases (ADR 0005).
   - When Redline is unsure what a clause means, it shows it as an Ambiguous clause with each possible reading, and does not pick one (ADR 0005).
4. **Drafts a Counter-offer for each flagged clause**: replacement wording the Reviewer can send to the Counterparty.
5. **Answers questions from the document only.** When the answer is not in the document, the question box says so instead of answering from general knowledge.
6. **Runs the analysis against an editable list of Red lines.** The list starts with the four Default Red lines (section 5), each labelled with its basis. The Reviewer can add their own and edit or remove any. A clause that matches a Red line is Don't sign as written regardless of Market standard (ADR 0003, ADR 0004).
7. **Flags Outside references.** Every sentence that brings in terms from a document that was not uploaded (a web address, a Statement of Work, an Order Form, terms "as amended from time to time") becomes a Risk flag with that sentence as its Source sentence. While any Outside reference is unresolved, the review cannot be a Clean result. The Reviewer resolves one by uploading the referenced document or by marking the reference as reviewed; a reference marked as reviewed is the Reviewer's statement, not something Redline checked. Redline does not fetch referenced documents itself (ADR 0007).
8. **Gives a Clean result when there is one.** A review with no Don't sign as written or Negotiate flags and no unresolved Outside references is a Clean result. Redline says so plainly, lists every Red line it checked, and shows any Know this flags beneath. It never uses the words safe, fine or good to sign (ADR 0006).
9. **Keeps a library of the Reviewer's past documents.** Stored documents and Red lines belong to one account. No one can read another account's documents or Red lines, and this is enforced in the database, not only in the interface.

### Build constraint
Analysis runs only on the product owner's machine. Server-side code calls the unmodified Claude Code CLI, signed in to the product owner's own Claude subscription, for the product owner's own testing, and never from the browser. Nothing deployed calls Claude: Anthropic's terms forbid routing a product's or other people's requests through a Pro or Max plan (code.claude.com/docs/en/legal-and-compliance). **No one else can use v1's analysis, and analysis cannot run on Vercel, until an API key is adopted**, which needs the product owner's decision first. Claude account credentials and session tokens are never collected, stored or passed around.

The rest of the stack is settled: Next.js, Supabase for auth and database, deployed on Vercel.

### Open questions
Each of these changes what gets built and has not been decided.

**Severity and Counter-offers**
1. What Severity does an Outside reference flag get?
2. What does the Counter-offer for an Outside reference say?
3. Does "as amended from time to time" count as a match for Default Red line 3? ADR 0007 calls it "Default Red line 3 in another form". If it matches, it is Don't sign as written, so marking it reviewed would not produce a Clean result.
4. Does a Know this flag get a Counter-offer? CLAUDE.md asks for one per flagged clause; CONTEXT.md defines a Know this clause as acceptable.
5. Is an Ambiguous clause a Risk flag, and if so at what Severity? Does it block a Clean result?
6. What is Market standard based on for each contract type: vendor agreement, commercial lease, client agreement? The research provides nothing (ADR 0003).
7. How does Redline decide which of the three contract types a document is, and what happens when a document is none of them?
8. Does a fee escalator written into the contract match Default Red line 3, or only a change the Counterparty makes later?

**Source sentences and withheld flags**
9. What is the written matching rule for "the same sentence", given that PDF and DOCX extraction changes line breaks, hyphenation and whitespace (ADR 0001)?
10. What is the rule for a risk that comes from several sentences together? Until it exists such risks cannot be flagged (ADR 0001). Default Red line 2 (auto-renewal in one sentence, an exit fee in another) and Default Red line 4 ("uncapped" means no cap sentence anywhere) depend on it.
11. Where is the count of withheld flags shown: to the Reviewer, or only recorded?
12. Can a review be a Clean result when flags were withheld? Under the current definition, a document whose only Don't sign as written flags failed the Source sentence check would get one.
13. Do question-box answers show the Source sentences they rely on?
14. Does the hedge-word ban apply to Counter-offer wording, where "may" is ordinary contract language?

**Inputs and Red lines**
15. What happens to an uploaded referenced document: is it analysed on its own, together with the document that referenced it, and against the Red lines?
16. How is a Red line the Reviewer writes in their own words matched against clauses?
17. When the Reviewer edits their Red lines, are saved documents re-analysed, and does each saved review keep the list of Red lines it was checked against?
18. How is a PDF with a text layer on some pages and only images on others handled? Accepting it would leave terms unread and allow a Clean result on them.
19. Which languages are documents and output in? The strongest case in the research involved Owners with limited English (A1 F1).
20. Which model runs the analysis? Not chosen.
21. Which PDF and DOCX parsers? Each dependency needs the product owner's agreement.

## 4. What good looks like
**No test set of real vendor agreements, commercial leases or client agreements exists.** Every criterion below runs on fixture documents written for the purpose, with known sentences and seeded clauses (ADR 0001). CLAUDE.md adds that no capability counts as working until it has been run end to end against a real document.

| # | What is measured | On what | Met when | Target |
|---|---|---|---|---|
| 1 | Displayed Risk flags whose Source sentence is found in the stored document text under the matching rule | Every analysis run, fixtures included | 100%; no flag is shown without a Source sentence | Set by ADR 0001. Cannot be run until the matching rule is written (open question 9) |
| 2 | Withheld flags | Fixtures where the model's output is replaced with altered and invented Source sentences (ADR 0001) | Every altered or invented one is withheld, none is shown, and the recorded count equals the number withheld | Set by ADR 0001 |
| 3 | Default Red line matches | Fixtures of each contract type with a seeded clause for each of the four Default Red lines, including one modelled on the First American terms (three-year term, $495 cancellation fee; A1 F1) | Every seeded clause is flagged Don't sign as written, with the seeded sentence as its Source sentence | Set by ADR 0003 and ADR 0004. Red lines 2 and 4 are seeded within a single sentence until open question 10 is settled |
| 4 | Removing a Default Red line | The same fixtures after the Reviewer removes that Red line | The clause is no longer marked as a Red line match | Set by ADR 0004. What Severity it then gets depends on Market standard, which has no basis yet |
| 5 | Red lines the Reviewer adds | Fixtures with a clause seeded to match each added Red line | Every seeded clause is flagged Don't sign as written | Set by ADR 0003. Depends on open question 16 |
| 6 | Outside references | Fixtures seeded with each kind named in CONTEXT.md: a web address, a Statement of Work, an Order Form, "as amended from time to time" | Every one is a Risk flag with the referencing sentence as its Source sentence; no Clean result while any is unresolved; once all are uploaded or marked reviewed and nothing else stands in the way, a Clean result is given | Set by ADR 0007 |
| 7 | Clean result content | Every Clean result produced in testing | It says plainly that it is a Clean result, lists every Red line on the Reviewer's list at the time of analysis, and shows Know this flags beneath | Set by ADR 0006 |
| 8 | Hedge words and verdict words in Redline's own text | Summary, Risk flag text, Clean result and question-box answers, excluding Source sentences and any other text reproduced word for word from the document | Zero whole-word occurrences of "may", "could potentially", "consider consulting a lawyer", "safe", "fine", "good to sign" | Set by ADR 0005 and ADR 0006. Whether Counter-offers are checked is open question 14. No longer word list has been set |
| 9 | Unusualness claims | All output from test runs, read by a person | Every statement that a clause is an Unusual clause or departs from Market standard carries the label Redline's judgment | Set by ADR 0003 and ADR 0005 |
| 10 | Questions whose answer is not in the document | A question set written against fixtures whose contents are known | Every answer says the answer is not in the document and gives no answer from general knowledge | Set by CLAUDE.md trust rules. Accuracy on questions the document does answer: no target set |
| 11 | Ambiguous clauses | Fixtures with clauses written to support two readings | Each is shown as an Ambiguous clause with its readings, and no reading is chosen | Set by ADR 0005 |
| 12 | Counter-offers | Every displayed Risk flag | Each has a Counter-offer | Set by CLAUDE.md scope. Exceptions depend on open questions 2 and 4. Quality of the wording: no target set |
| 13 | Rejected uploads | An image-only PDF | Rejected with a message saying why; no analysis runs; nothing is stored | Set by CLAUDE.md |
| 14 | What leaves the browser | Network traffic while uploading a PDF and a DOCX | Only extracted text is sent; the original file is not | Set by CLAUDE.md |
| 15 | Data isolation | A second account querying the database directly, not through the interface, for the first account's documents and Red lines | No rows returned | Set by CLAUDE.md |
| 16 | Claude calls from deployed code | The deployed build | No code path calls Claude | Set by CLAUDE.md |
| 17 | Claims the document does not support, in the summary, flags, Counter-offers and answers | Test output, read by a person | None found | Set by CLAUDE.md trust rules. No method for catching them has been decided |

### Numbers that are unset
| What | Why it is unset |
|---|---|
| Misses and false alarms on real contracts | No test set of real contracts exists. |
| Whether a non-Red-line clause got the right Severity | Market standard has no basis for any contract type (ADR 0003). |
| Share of documents that should produce a Clean result | The research gives no base rate for how many contracts are acceptable. |
| How many Know this flags is too many | ADR 0005 expects Know this to fill up; no limit has been set. |
| What counts as a "clear case" for Don't sign as written outside Red line matches | ADR 0005 uses the phrase without defining it. |
| Whether Reviewers trust the output or act on it | Not measured; the research never studied Reviewers. |

## 5. The product owner's red lines
Redline ships four Default Red lines (ADR 0004). The Reviewer can edit or remove each one. Each is labelled with its basis, and one has no evidence behind it.

| # | Default Red line | Catches | Severity when matched | Basis as labelled |
|---|---|---|---|---|
| 1 | Personal guarantee | A clause making the Owner personally liable for the business's obligations | Don't sign as written | Research, qualitative only (A2 F8) |
| 2 | Auto-renewal with an exit fee, or a minimum term over 12 months | A contract that renews itself and charges to leave, or that locks the Owner in for longer than 12 months | Don't sign as written | Research: FTC complaint volume (A2 F1) and the First American case (A1 F1) |
| 3 | Counterparty can change terms or prices without the Owner's consent | A clause letting the Counterparty alter the deal on its own | Don't sign as written | Research, weakly evidenced (A2 F9) |
| 4 | Uncapped indemnity or liability carried by the Owner | A clause making the Owner answerable for losses with no upper limit | Don't sign as written | No evidence; the product owner's judgment |

### 1. Personal guarantee
> "Most small business owners sign personal guarantees without fully understanding what they've agreed to, and find out when the business hits a rough patch, the landlord sends a demand letter, and suddenly their personal bank account and home equity are at stake."

A commercial-lease law firm's blog, https://staceyromberg.com/blog/what-business-owners-should-know-about-personal-guarantees-for-commercial-leases/ (A2 F8). Snippet only. No counts or percentages were found anywhere in the research.

### 2. Auto-renewal with an exit fee, or a minimum term over 12 months
> "The FTC received nearly 70 consumer complaints per day on average [in 2024] regarding negative option programs, up from 42 per day in 2021."

https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-click-cancel-rule-making-it-easier-consumers-end-recurring (A2 F1, page verified). These are consumer complaints, not small-business ones. The small-business evidence is First American's "three-year term with a $495 cancellation fee" (A1 F1, section 2). The 12-month threshold does not come from the research; nothing in it names a term length other than First American's three years.

### 3. Counterparty can change terms or prices without the Owner's consent
The cited evidence is:

> "A 2017 Deloitte survey found that 91 percent of consumers consent to the terms of service without reading them, and this rises to 97 percent among 18-34 year olds."

Cited via a secondary source, https://i-agree.io/blog/why-nobody-reads-terms-and-conditions-anymore (A2 F9). Snippet only; the Deloitte original was not opened. It shows consumers not reading terms of service; it does not show small businesses harmed by terms changed later. ADR 0007 adds that "as amended from time to time" is this Red line in another form.

### 4. Uncapped indemnity or liability carried by the Owner
No evidence; the product owner's judgment. The research found no complaint data for indemnity or liability caps. A2: "Not claiming they don't matter — claiming I found no evidence either way."

### Every other clause type
Clauses that match no Red line get their Severity from how far they depart from Market standard (ADR 0003). That covers every other clause type in the research's ranking (research/summary.md, section 2) that appears in these contracts, such as payment terms, non-competes, IP assignment and arbitration, and anything the Reviewer has not written a Red line for. Two consequences:
- **A common but harmful clause gets a lesser Severity without a Red line.** Under Market standard alone, First American's $495 exit fee in the processor's standard agreement would not have reached Don't sign as written (ADR 0003). Default Red line 2 is what catches it; a Reviewer who removes it loses that protection.
- **Missing protections are not flagged at all** (ADR 0001), so a missing late-fee clause in a client agreement is not caught by any Red line.

The research found no complaint data for liability caps, indemnity or fee escalators: "**No evidence either way:** liability caps, indemnity, fee escalators. The agents searched and found no complaint data naming them." (research/summary.md, section 2).

## 6. The calls made and what was given up
| Call | Chosen | Chosen against | Who is worse off |
|---|---|---|---|
| Segment (ADR 0002) | Negotiable small-business contracts: vendor agreements, commercial leases, client agreements | Freelancers; consumers and renters | Freelancers, the largest individual losses in the research (91% paid late, 62% unpaid, 53% lost $10,000 or more; A2 F2), and consumers caught by auto-renewal |
| Who uses it (ADR 0002) | The Reviewer, who has to justify each Risk flag to someone else | The Owner as the person using Redline, wanting a sign or don't-sign verdict | Owners who want a verdict; ADR 0006 records that "The Owner does not get the reassuring verdict they want." |
| When (ADR 0002) | Before signing | After-signing help: exit terms, cancellation deadlines | Anyone already signed, the best-documented pain: 60% of SMB owners found surprising terms after signing (A4 F7); about 70 FTC auto-renewal complaints a day (A2 F1) |
| What sets Severity (ADR 0003) | Departure from Market standard | Worst-case cost if the Counterparty enforces the clause; likelihood the clause is used | Owners facing a common but harmful clause that no Red line covers. The assistant recommended worst-case cost; the product owner chose otherwise and stated no reason. Under this rule First American's $495 exit fee on a three-year term, in the processor's standard agreement, would not have reached Don't sign as written without Default Red line 2 |
| Red line match (ADR 0003) | Always Don't sign as written, regardless of Market standard | Not recorded | Reviewers whose Red lines catch clauses that are routine in their trade. This call was proposed during the brief and stands because the product owner did not object when asked |
| Severity levels (ADR 0003) | Three levels named by the Reviewer's next action | A 1–10 score (false precision a Reviewer cannot explain to an Owner); two levels (a personal guarantee and a 60-day notice window would look the same) | Reviewers who want flags ordered within a level; they are not |
| Red lines at start (ADR 0004) | Four Default Red lines, pre-filled | An empty list the Reviewer fills in | Businesses whose own lines differ: Redline ships with the product owner's judgments, one with no evidence. A Reviewer who removes one loses protection against that clause when it is Market standard |
| When unsure (ADR 0005) | Flag, but only at Know this | Flag only what is certain | Reviewers, whose Know this list fills up and gets skimmed. ADR 0005 reasons that a miss costs the Owner money and a false alarm costs the Reviewer time; no evidence, the product owner's judgment |
| Voice (ADR 0005) | Fact backed by the Source sentence; anything else labelled Redline's judgment; no hedge words | Hedged language; a plain confident voice with uncertainty shown only through Severity | Reviewers who find audit-style output cold |
| What a Clean result says (ADR 0006) | Says so plainly, lists every Red line checked, shows Know this flags; never safe, fine or good to sign | Always surfacing the top few items; a verdict such as "Looks good" | The Owner, who wants reassurance |
| Outside references (ADR 0007) | Each is a Risk flag and blocks a Clean result until uploaded or marked reviewed | Review only the uploaded text and add a general note | Reviewers of vendor agreements, who must track down referenced terms, possibly on a web page that has already changed; ADR 0007 expects some to leave. Raised by the assistant as a blind spot the product owner had not considered |
| Every flag cites its Source sentence (ADR 0001) | Every flag shows its Source sentence, checked word for word by code | Risks in the model's own words; section or page numbers; "no source found" labels; paraphrase | Anyone whose harm is a Missing protection, the biggest freelancer pain in the research, which cannot be flagged; risks spread across several clauses, which cannot be flagged until a rule exists; Reviewers who see fewer flags than the model produced |
| No OCR (CLAUDE.md, ADR 0001) | Reject scanned and image-only PDFs | Read them with OCR | Reviewers holding scanned or photographed contracts. How common those are is not in the research |
| File handling (CLAUDE.md) | Parse in the browser; store only extracted text | Not recorded | Reviewers whose referenced documents live elsewhere: Redline cannot fetch them (ADR 0007) |
| Where analysis runs (CLAUDE.md) | Only on the product owner's machine, through the Claude Code CLI on their own subscription | An API key | Everyone but the product owner, who cannot use the analysis. With no API, Claude's built-in source-pointing output is unavailable and all Source sentence checking lives in Redline's own code (ADR 0001) |

### Recorded tension: Clean results will be rare
ADR 0006 exists so that flags stay believable and a Clean result is credible. But ADR 0005 sends uncertain flags to Know this, so almost every Clean result will still carry Know this flags; and ADR 0007 blocks a Clean result while any Outside reference is unresolved, which ADR 0006 says most vendor agreements contain. Clean results will therefore be rare in practice, which undercuts the believability ADR 0006 is meant to protect. The ADR records this deliberately and does not resolve it. The claim that most vendor agreements contain Outside references is not from the research.

## 7. What we are not building, and why
| Not building | Why |
|---|---|
| Payments and billing | v1 exists to prove the analysis can be trusted, and billing does not make it more trustworthy (CLAUDE.md). |
| OCR for scanned documents | A Source sentence pointing into misread text is worthless (CLAUDE.md, ADR 0001). |
| Sharing a document between accounts | It does not make the analysis more trustworthy (CLAUDE.md). |
| Missing protection flags | A missing protection has no Source sentence to show; showing gaps needs a separate decision (ADR 0001). |
| Risks that come from several clauses together | No rule yet for showing more than one Source sentence (ADR 0001). |
| After-signing help: exit terms, cancellation deadlines | Counter-offers are useless once signed (ADR 0002). |
| Freelancer documents | Their worst harm is a Missing protection, which cannot be flagged (ADR 0002). |
| Consumer and renter documents | No Counterparty negotiates them, so a Counter-offer has nowhere to go (ADR 0002). |
| Fetching referenced documents | Files are parsed in the browser and only uploaded text is stored (ADR 0007). |
| A numeric score | False precision a Reviewer cannot explain to an Owner (ADR 0003). |
| Ranking flags within a Severity level | ADR 0003 settles that flags within a level are not ranked. |
| A "safe" or "looks good" verdict | It is the claim Redline can least back up (ADR 0006). |
| Analysis for anyone but the product owner, or on Vercel, until an API key is adopted | Anthropic's terms forbid routing other people's requests through a Pro or Max plan (CLAUDE.md). |
| Anything else that looks like the obvious next step | Not in scope; ask the product owner first (CLAUDE.md). |

## 8. What the research could not tell us
| Unknown | Where it is recorded | Decision it leaves exposed |
|---|---|---|
| Willingness to pay, in any segment. No survey or quote states a price for a review tool; every price found is a lawyer fee or a bundled subscription | research/summary.md sections 4 and 6; A4 section 5 | Whether Redline is worth building past v1, and the segment choice itself (ADR 0002) |
| What Reviewers do, need or would use. Ops managers, bookkeepers and office managers were never studied | ADR 0002 | Every call built around the Reviewer: Source sentences, the library, Counter-offers, the audit-style voice |
| Who pays: the Owner, the Reviewer, or someone else | ADR 0002 | Who Redline is sold to once billing exists |
| How many contracts are acceptable as written | ADR 0006 rests on "Most documents are acceptable"; the research has no base rate | How often a Clean result should appear, and whether ADR 0006's crying-wolf reasoning holds |
| A basis for Market standard in vendor agreements, commercial leases and client agreements | ADR 0003 | The Severity of every flag that is not a Red line match |
| Complaint data for indemnity, liability caps and fee escalators; counts for personal guarantees and IP assignment | research/summary.md section 6; A2 section 6 | Default Red line 4 entirely, Default Red line 1's weight, and whether these clause types deserve Red lines at all |
| How often Outside references appear, and how often harmful terms sit in the referenced document | Not in the research; ADR 0007 asserts both | Whether blocking a Clean result on Outside references is proportionate, and how many Reviewers leave over it |
| Whether reading a flag before signing changes the outcome | research/summary.md section 5 item 6; A1 section 5; A2 section 5 | Whether any v1 capability helps the Owner at all |
| How often a small-business Counterparty accepts a Counter-offer | Leverage evidence covers consumer contracts only (A2 section 5) | The value of Counter-offers and of the Negotiate level |
| The cost of a false alarm against the cost of a miss | Not in the research; ADR 0005 asserts that money is the worse loss | Leaning toward flagging at Know this (ADR 0005) |
| How tone affects trust. The research documents DoNotPay's accuracy and billing failures, not its voice | A3 F5; ADR 0005 asserts hedging is "the voice of the tools whose trust failed" | The no-hedge-words rule and the audit-style voice (ADR 0005) |
| Verified first-person accounts. Reddit could not be fetched; forum stories came through Yahoo and AOL write-ups; the freelancer quotes come from an e-signature vendor's blog | research/summary.md sections 6 and 7; A1 section 6 | The problem statement rests on regulators and surveys, with no Owner or Reviewer voice |
| How often small-business contracts arrive scanned | Not in the research | How many Reviewers the no-OCR call turns away |
| Competitor traction: usage or revenue for any product, and independent reviews for LeaseChat, goHeather and the small tools | A3 F9 and section 6 | Whether Source sentences are a real gap or just unverified in competitors; whether goHeather already serves Reviewers |
| Lawyer prices from more than one source. All come from ContractsCounsel, whose pages could not be opened | research/summary.md section 6; A4 F1–F4 | Any positioning of Redline against the cost of a lawyer |
| The legal status of the FTC click-to-cancel rule. A2 treats it as final; the summary's compiler believes a federal appeals court vacated it in July 2025, not verified | research/summary.md section 5 item 7 | Whether regulation will shrink the auto-renewal problem behind Default Red line 2, whose cited complaint figure comes from that rule's announcement |
