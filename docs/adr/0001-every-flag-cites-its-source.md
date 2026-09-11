# 0001. Every risk flag cites its source sentence

Status: Accepted, 2026-09-11

## Decision
Every risk flag Redline shows carries the exact sentence from the uploaded document that it came from. Before a flag is displayed, that sentence must be found word for word in the stored document text. A flag whose source sentence cannot be shown is a bug, not a formatting preference: it is never shown to the reader without its source, and it is treated as a defect to fix.

## Alternatives
- **Let the model describe risks in its own words, quoting nothing.** This is the easiest to build and reads well. It was rejected because the reader has no way to tell a real risk from an invented one.
- **Point to a section or page number instead of the sentence.** This was rejected because the reader still has to find and interpret the text, and page and section numbers from extracted PDFs are unreliable.
- **Quote when possible and label the rest "no source found".** This was rejected because it makes the citation optional, and an unsourced flag still looks like a finding.
- **Let the model paraphrase the clause next to the flag.** This was rejected because a paraphrase is the model's reading of the clause, not the document.

## Why
A reader can check every flag without trusting Redline:
- find the quoted sentence in their own copy of the document, word for word;
- read that sentence and judge whether the flag's claim follows from it;
- catch Redline when it is wrong, because the claim and its evidence sit side by side.

The research shows trust is the category's weak point. DoNotPay failed on accuracy, and no consumer tool was confirmed to cite the sentence (research/summary.md, section 3).

## Consequences
- **Missing protections cannot be risk flags.** A contract with no late-fee clause has no sentence to quote, and that absence was the biggest freelancer pain in the research. Showing such gaps needs a separate decision.
- **Risks that come from several clauses together** need a rule for citing more than one sentence. Until that rule exists, they cannot be flagged.
- **OCR stays out.** A citation into misread text is worthless, so scanned PDFs are rejected.
- **"Exact" needs a written matching rule.** PDF and DOCX extraction changes line breaks, hyphenation and whitespace, so the rule for what counts as the same sentence must be written down and tested.
- **Model output is untrusted.** Code, not the model, checks every quote against the stored text. The reader may see fewer flags than the model produced, and flags that were withheld must be counted, not silently dropped.
- **Tests** need fixture documents with known sentences. They must assert that every displayed quote appears verbatim in the stored text, and include cases where the model returns an altered or invented quote that must be withheld.
- **No API citation feature to lean on.** While analysis runs through the Claude Code CLI rather than the API, Claude's built-in citation output is not available, so all verification lives in Redline's own code.
