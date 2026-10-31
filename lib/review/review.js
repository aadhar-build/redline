import "server-only";

import { looksEnglish } from "../extraction/language.js";
import { gateCleanResult } from "./clean-result-gate.js";
import { ONE_SIDED_CHANGES_ID } from "./outside-references.js";
import { checkSources } from "./source-check.js";
import { citesUnreadableAmount, readOcrRanges, UNREADABLE_AMOUNT } from "./unreadable-amount.js";
import { readScannedPages, scannedNote } from "./scanned-pages.js";
import { normalise } from "./normalise.js";
import { outsideReferencesFor, referencedDocumentOf, referencedPromptPart, reviewTexts, textFor } from "./referenced.js";
import { checkCounterOffer, counterOfferPromptPart } from "./counter-offer.js";
import {
  documentNumbers,
  findBannedWording,
  findJudgmentWording,
  findUnsupportedNumbers,
  looksLikeTemplate,
} from "./wording.js";

// Review: the main module and the main test seam (spec.md, "Modules and their interfaces").
// Document text, the Reviewer's Red lines and a model adapter go in; a review comes out.
// How it prompts the model and assembles the review is internal to this module.
//
// Built so far: the summary (ticket 01), Risk flags with checked Source sentences (ticket 03) and Red
// line matches (ticket 06), the Clean result (ticket 11), a Counter-offer on every flag (tickets 08
// and 17), Ambiguous clauses with their readings (ticket 07) and Outside references (ticket 13). The
// other parts of the review are present in the shape so callers do not change later, but they are not
// computed yet.

export const REVIEW_MODULE_NAME = "redline-review:server";

export const MAX_DOCUMENT_LENGTH = 200_000;

// The three Severity levels, in the fixed order their groups are shown (ADR 0003). The order is between
// groups only; flags inside a group are not ranked.
export const SEVERITIES = Object.freeze(["dont-sign-as-written", "negotiate", "know-this"]);

export class ReviewInputError extends Error {
  constructor(code, message) {
    super(`${REVIEW_MODULE_NAME}: ${message}`);
    this.name = "ReviewInputError";
    this.code = code;
  }
}

const nonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// The Red lines Review was given, checked for shape. Each needs a stable id and a name; catches and
// basis are optional, since a Red line the Reviewer writes (ticket 12) may have neither.
function readRedLines(redLines) {
  if (!Array.isArray(redLines)) throw new ReviewInputError("bad-red-lines", "Red lines must be a list");
  const seen = new Set();
  return redLines.map((r, i) => {
    if (!r || typeof r !== "object" || !nonEmptyString(r.id) || !nonEmptyString(r.name)) {
      throw new ReviewInputError("bad-red-lines", `Red line ${i + 1} needs an id and a name`);
    }
    const id = r.id.trim();
    if (seen.has(id)) throw new ReviewInputError("bad-red-lines", `Red line id ${id} is used twice`);
    seen.add(id);
    return {
      id,
      number: i + 1,
      name: r.name.trim(),
      catches: nonEmptyString(r.catches) ? r.catches.trim() : null,
      basis: r.basis && typeof r.basis === "object" ? { ...r.basis } : null,
    };
  });
}

function redLinesPromptPart(redLines) {
  if (redLines.length === 0) {
    return ['- "redLine": always null. There are no Red lines for this review.'];
  }
  return [
    '- "redLine": the id of the Red line the clause matches, or null when it matches none. A Red line is a term the Owner\'s business will not accept. Name a Red line only from the list below, and only when the quoted sentences show the match. A clause that matches a Red line is always "dont-sign-as-written".',
    "",
    "The Owner's Red lines:",
    ...redLines.map((r) => `- id "${r.id}": ${r.name}.${r.catches ? ` ${r.catches}` : ""}`),
  ];
}

// The fixed line added when the document has blanks or placeholders in its body (ticket 22 ruling
// C(a), worded by ticket 24 ruling 22).
export const TEMPLATE_PROMPT_LINE = "This document contains blanks.";

function ownerPromptPart(ownerParty) {
  if (ownerParty) {
    return [`The Owner is ${ownerParty}. Give "${ownerParty}" as "ownerParty".`];
  }
  return [
    'Work out which party is the Owner from the document. Give "ownerParty": the term the document itself uses for the Owner, copied from the document (for example "the Licensee"), or null when you cannot tell.',
  ];
}

// The prompt lines for the "readings" field (ticket 07, ADR 0005, spec-gaps 15). An Ambiguous clause is
// "unsure what it means", not "unsure whether it hurts" (that is a Know this flag).
export const AMBIGUOUS_PROMPT_LINES = Object.freeze([
  '- "readings": null for most clauses. When a clause\'s wording can reasonably be read more than one way and you cannot tell which reading applies, it is an Ambiguous clause: give "readings", a list of each possible reading, at least two, and give it "severity" "negotiate". This is for being unsure what the clause means, not for being unsure whether it hurts the Owner. State each reading only from the document, as what the clause says on that reading. Do not choose, rank or favour a reading, in "readings" or anywhere else in the flag; "says" describes the wording without picking a reading. The "counterOffer" for an Ambiguous clause removes the ambiguity: it restates or tightens the clause so it can be read only one way, the way that favours the Owner, and adds no new term.',
  '- The "counterOffer" for an Ambiguous clause uses the wording of one of the readings you gave. It does not build a third reading of its own.',
]);

// QUESTIONS.md 27 and 31 (settled by Fable advisor, 2026-10-31), sent only when Default Red line 3 is on
// the list.
const ONE_SIDED_CHANGES_PROMPT_LINES = [
  `- Redline raises Outside references itself. Do not raise a flag for id "${ONE_SIDED_CHANGES_ID}" whose only evidence is "as amended from time to time" wording or the like.`,
  `- A statute or its rules "as amended from time to time" is a change Parliament makes, not the Counterparty. It is not a match for id "${ONE_SIDED_CHANGES_ID}".`,
];

function reviewPrompt(documentText, redLines, { template = false, ownerParty = null, texts = [] } = {}) {
  return [
    "You are reviewing a contract for the person who reads it before it is signed, on behalf of the small business that will sign it (the Owner).",
    ...(template ? [TEMPLATE_PROMPT_LINE] : []),
    ...ownerPromptPart(ownerParty),
    'Give "parties": the term the document uses for each party, copied from the document.',
    "",
    "Rules for everything you write:",
    '- State only what the document says. Bring in no facts from outside it: no geography, law, rates, dates or parties it does not state.',
    "- Say the document is signed, executed or dated only where its text states it. A blank signature or date line is not evidence either way.",
    "- Where the document is silent on something, say that it is silent. Do not fill the gap.",
    "- Compare only like with like: an amount with an amount, a period with a period.",
    "- Write every number exactly as the document writes it, in words or in digits.",
    "- Never say a term is market, standard, customary, usual, typical, common or one-sided.",
    "",
    "Part 1, summary. Write a plain-English summary of what the document below says: who the parties are, what is provided, the term, the money, and how it ends.",
    "Do not judge whether the terms are acceptable.",
    "",
    "Part 2, risk flags. List each clause that could hurt the Owner. For each one give:",
    '- "severity": exactly one of "dont-sign-as-written", "negotiate", "know-this". Severity comes from how far the clause departs from what a counterparty would typically offer in this kind of contract, not from worst-case cost. "dont-sign-as-written" is only for clear cases. When unsure whether a clause hurts the Owner, use "know-this".',
    '- "title": a short label for the clause.',
    '- "says": what the clause says, stated as fact, using only what the quoted sentences say.',
    '- "judgment": what the clause does to the Owner, or what is missing from the document, that the quoted sentences do not state outright. Use null when there is none. Never put such a claim in "says".',
    '- "sourceSentences": the exact sentence or sentences from the document that the flag comes from, copied character for character, each one or more whole sentences. Begin each one at the clause number or bullet that opens its line, when there is one. Never shorten, paraphrase or join sentences with an ellipsis. Give more than one only when the risk comes from several sentences together.',
    '- When part of the risk is that something appears nowhere in the document, such as a cap on what the Owner has to pay, say so in "judgment", for example "No cap appears in the document."',
    ...AMBIGUOUS_PROMPT_LINES,
    ...redLinesPromptPart(redLines),
    ...(redLines.some((r) => r.id === ONE_SIDED_CHANGES_ID) ? ONE_SIDED_CHANGES_PROMPT_LINES : []),
    ...counterOfferPromptPart(ownerParty),
    "",
    "State each point as fact. Do not hedge. Never use these words in your own text, Counter-offers included: may, could potentially, consider consulting a lawyer, safe, fine, good to sign.",
    `Reply with JSON only, in the form {"ownerParty": "...", "parties": ["..."], "summary": "...", "riskFlags": [{${texts.length > 1 ? '"document": "main", ' : ""}"severity": "...", "title": "...", "says": "...", "judgment": null, "sourceSentences": ["..."], "redLine": null, "readings": null, "counterOffer": "..."}]}.`,
    "",
    "<document>",
    documentText,
    "</document>",
    // Ticket 18: referenced documents the Reviewer added, reviewed together with this one.
    ...referencedPromptPart(texts),
  ].join("\n");
}

// A reply wrapped whole in one Markdown code fence (```json ... ```), as Sonnet 5.5 sent once in the
// ticket 22 real runs. Only a fence around the entire reply is removed; any other text stays, so the
// reply is still unreadable.
const WHOLE_FENCE = /^```(?:json)?[ \t]*\n([\s\S]*?)\n?```$/;

// Model output is untrusted: anything that is not the expected JSON is unreadable.
function parseReply(reply) {
  try {
    const trimmed = String(reply).trim();
    const data = JSON.parse(trimmed.match(WHOLE_FENCE)?.[1] ?? trimmed);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function readSummary(data) {
  if (!data || typeof data.summary !== "string") return null;
  const summary = data.summary.trim();
  return summary.length > 0 ? summary : null;
}

// Redline's own text, with banned hedge and verdict words marked and any Market standard claim
// labelled as Redline's judgment. marked holds character offsets into text, in order.
// With `numbers` (the document's numbers, from documentNumbers), any number the document does not
// contain is marked too, with kind "number" (ticket 22, ruling C(b)).
export function ownText(text, documentText, { alwaysJudgment = false, numbers = null } = {}) {
  const marked = findBannedWording(text, { documentText }).map((h) => ({
    phrase: h.phrase,
    start: h.index,
    end: h.index + h.match.length,
  }));
  if (numbers) {
    for (const n of findUnsupportedNumbers(text, numbers)) {
      marked.push({ phrase: n.match, kind: "number", start: n.index, end: n.index + n.match.length });
    }
    marked.sort((a, b) => a.start - b.start);
  }
  const isJudgment = alwaysJudgment || findJudgmentWording(text, { documentText }).length > 0;
  return { text, marked, isJudgment };
}

// Ticket 22, ruling E: a party term the model gives is shown only when the document uses it.
const MAX_PARTY_LENGTH = 100;

export function partyTermIn(term, normalisedDocument) {
  if (!nonEmptyString(term)) return null;
  const t = term.trim().replace(/\s+/g, " ");
  if (t.length > MAX_PARTY_LENGTH) return null;
  const bare = normalise(t.replace(/^the\s+/i, "")).toLowerCase();
  if (bare.length < 2) return null;
  return normalisedDocument.includes(bare) ? t : null;
}

function readParties(data, normalisedDocument) {
  const list = Array.isArray(data?.parties) ? data.parties : [];
  const seen = new Set();
  const parties = [];
  for (const p of list) {
    const term = partyTermIn(p, normalisedDocument);
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      parties.push(term);
    }
  }
  return parties;
}

// The Red line a flag matched, or null. Only an id on the list Review was given counts: a Red line
// the Reviewer left out, or one the model made up, is never a match, whatever the model says. What is
// shown is the Reviewer's own entry, never text from the model.
function matchedRedLine(id, redLines) {
  if (!nonEmptyString(id)) return null;
  const r = redLines.find((x) => x.id === id.trim());
  return r ? { id: r.id, number: r.number, name: r.name } : null;
}

/**
 * The checks on a flag's own text after its Source sentences pass (ticket 22). Shared with reopening a
 * saved review, so both read the same.
 * - C(b): every number in "says" must occur in the document, or the flag is withheld as
 *   "unsupported-number". Numbers in "judgment" that the document lacks are marked instead.
 * - D: a judgment that claims what is market, standard, usual, typical or common is dropped; the flag
 *   still shows with its "says" and Source sentences.
 * @returns {{ withheld: "unsupported-number" } | { title: object, says: object, judgment: object | null, judgmentDropped: boolean }}
 */
export function checkFlagText({ title, says, judgment, readings = null }, documentText, numbers) {
  if (findUnsupportedNumbers(says, numbers).length > 0) return { withheld: "unsupported-number" };
  const checkedReadings = readReadings(readings);
  if (checkedReadings === undefined) return { withheld: "unreadable" };
  // Ticket 07: a reading states what the clause says on one reading of it, so it is held to the same
  // rule as "says": a number the document does not contain withholds the flag.
  if (checkedReadings && checkedReadings.some((r) => findUnsupportedNumbers(r, numbers).length > 0)) {
    return { withheld: "unsupported-number" };
  }
  const judgmentText = nonEmptyString(judgment) ? judgment.trim() : null;
  const judgmentDropped = judgmentText !== null && findJudgmentWording(judgmentText, { documentText }).length > 0;
  return {
    title: ownText(title.trim(), documentText),
    says: ownText(says.trim(), documentText),
    judgment:
      judgmentText && !judgmentDropped ? ownText(judgmentText, documentText, { alwaysJudgment: true, numbers }) : null,
    judgmentDropped,
    // Hedge and verdict words in a reading are marked, as in "says" (PRD criterion 8).
    readings: checkedReadings ? checkedReadings.map((r) => ownText(r, documentText)) : null,
  };
}

// An Ambiguous clause's readings (ticket 07, ADR 0005, spec-gaps 15), in the model's order: no reading
// is chosen or ranked. Returns null for an ordinary flag (no readings given) and undefined when the
// readings cannot be used: not a list, an entry that is not text, or fewer than two distinct readings.
// A clause with one reading is not ambiguous, so such a flag is withheld rather than shown as either.
function readReadings(readings) {
  if (readings == null) return null;
  if (!Array.isArray(readings) || !readings.every((r) => typeof r === "string")) return undefined;
  const list = readings.map((r) => r.trim()).filter((r) => r.length > 0);
  const distinct = new Set(list.map((r) => normalise(r).toLowerCase()));
  if (list.length < 2 || distinct.size !== list.length) return undefined;
  return list;
}

/**
 * The Severity a flag is shown at. A Red line match is always Don't sign as written (ADR 0003). An
 * Ambiguous clause is otherwise always Negotiate, whatever the model gave it (spec-gaps 15). When both
 * apply, the Red line rule wins: a Red line match outranks Ambiguous (ADR 0003). Redline's code applies the rules; the model is
 * not trusted to.
 */
export function shownSeverity(severity, { redLineMatch, readings }) {
  if (redLineMatch) return "dont-sign-as-written";
  if (readings) return "negotiate";
  return severity;
}

// The review's Ambiguous clauses: the shown flags that carry readings. Each is a Risk flag at Negotiate
// (or Don't sign as written when it matches a Red line), listed here too so cleanResultOf can block on
// it. Shared with reopening, so both list them the same way.
export function ambiguousClausesOf(riskFlags) {
  return riskFlags.filter((f) => Array.isArray(f.readings) && f.readings.length > 0);
}

// Ticket 18: the referenced texts Review was given, checked for shape. Each is checked like the document
// itself (not empty, in English, valid OCR ranges), and the texts together stay under the length cap.
function readReferenced(list, mainLength) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new ReviewInputError("bad-referenced", "referenced documents must be a list");
  let total = mainLength;
  return list.map((r) => {
    if (!r || typeof r !== "object" || !nonEmptyString(r.id) || !nonEmptyString(r.referenceSentence)) {
      throw new ReviewInputError("bad-referenced", "a referenced document needs an id and its reference");
    }
    const t = typeof r.text === "string" ? r.text : "";
    if (t.trim().length === 0) throw new ReviewInputError("empty-document", "a referenced document is empty");
    total += t.length;
    if (total > MAX_DOCUMENT_LENGTH) throw new ReviewInputError("document-too-long", "the documents together are too long");
    if (!looksEnglish(t)) throw new ReviewInputError("not-english", "a referenced document is not in English");
    if (readOcrRanges(r.ocrRanges ?? [], t.length) === null) throw new ReviewInputError("bad-ocr-ranges", "the OCR ranges are not valid for this text");
    return { id: r.id, title: r.title ?? null, text: t, referenceSentence: r.referenceSentence, ocrRanges: r.ocrRanges ?? [], inReferencedDocumentId: r.inReferencedDocumentId ?? null };
  });
}

/** QUESTIONS.md 40: the characters the contract and its added documents use, against one cap. */
export const charactersUsedBy = (texts) => texts.reduce((n, t) => n + t.text.length, 0);

// Checks one flag from the model. Returns { flag, judgmentDropped } or { withheld: reason }.
// Ticket 18: every check uses the text the flag cites (the document or one referenced document), never
// the texts joined together. A flag naming a text that is not in this review is withheld.
function checkFlag(raw, texts, redLines) {
  if (!raw || typeof raw !== "object") return { withheld: "unreadable" };
  const cited = textFor(texts, raw.document);
  if (!cited) return { withheld: "source-not-found" };
  const { text: documentText, numbers, ocr: ocrRanges } = cited;
  const { severity, title, says, judgment, sourceSentences, redLine, counterOffer, readings } = raw;
  if (!SEVERITIES.includes(severity)) return { withheld: "unreadable" };
  if (!nonEmptyString(title) || !nonEmptyString(says)) return { withheld: "unreadable" };
  if (judgment != null && typeof judgment !== "string") return { withheld: "unreadable" };
  if (redLine != null && typeof redLine !== "string") return { withheld: "unreadable" };
  if (!Array.isArray(sourceSentences) || sourceSentences.length === 0) return { withheld: "no-source" };

  // Every Source sentence goes through the shared check; one that fails withholds the whole flag
  // (ADR 0010). What is shown is the span cut from the stored text, never the model's string.
  const checked = checkSources(documentText, sourceSentences);
  if (!checked.found) return { withheld: "source-not-found" };
  // spec-gaps 24: a cited sentence OCR read with a misread amount is withheld, never shown.
  if (citesUnreadableAmount(documentText, checked.sources, ocrRanges)) return { withheld: UNREADABLE_AMOUNT };

  const redLineMatch = matchedRedLine(redLine, redLines);

  const own = checkFlagText({ title, says, judgment, readings }, documentText, numbers);
  if (own.withheld) return { withheld: own.withheld };

  return {
    flag: {
      severity: shownSeverity(severity, { redLineMatch, readings: own.readings }),
      redLineMatch,
      title: own.title,
      says: own.says,
      judgment: own.judgment,
      // null for an ordinary flag; for an Ambiguous clause, every reading, none chosen (ticket 07).
      readings: own.readings,
      sourceSentences: checked.sources,
      // Tickets 08 and 17: marked, never withheld. A flag whose Counter-offer is missing or unreadable
      // still shows, with counterOffer null, because its Source sentences checked out (QUESTIONS.md).
      counterOffer: checkCounterOffer(counterOffer, numbers),
      // Ticket 18: the referenced document the Source sentences come from, or null for the document.
      referencedDocument: referencedDocumentOf(cited),
    },
    judgmentDropped: own.judgmentDropped,
  };
}

// Groups by Severity in the fixed order. Inside a group, flags follow the document, by where their
// first Source sentence starts, so the model's own order never reads as a ranking.
export function inGroups(flags) {
  // Ticket 18: the document's own flags first, then each referenced document's, each in its own order.
  const position = (f) => (f.referencedDocument?.index ?? 0) * 1e7 + Math.min(...f.sourceSentences.map((s) => s.start));
  return SEVERITIES.flatMap((severity) =>
    flags.filter((f) => f.severity === severity).sort((a, b) => position(a) - position(b)),
  ).map((f, i) => ({ number: i + 1, ...f }));
}

// Whether a review is a Clean result (ADR 0006, ADR 0007, spec-gaps 15 and 16), worked out by Redline's
// code from the finished review, never by the model. null when the Risk flags could not be read, since
// then nothing was checked. Otherwise true only when nothing stands in the way:
// - every shown flag is Know this (so no Don't sign as written or Negotiate flag, including a Red line
//   match, which is always Don't sign as written);
// - no flag was withheld: one that failed the Source sentence check could have been anything;
// - no Ambiguous clause (each is a Negotiate flag);
// - no unresolved Outside reference (ticket 13). An entry counts as resolved only when it says so with
//   resolved === true, so an entry of any other shape blocks. Review sets resolved only on a reference
//   the Reviewer marked as reviewed that is not a Red line match, so "as amended" is never resolved.
// Every test fails closed: a missing or malformed part blocks a Clean result rather than allowing one.
export function cleanResultOf(review) {
  if (!review || review.riskFlagsStatus !== "checked") return null;
  const flags = Array.isArray(review.riskFlags) ? review.riskFlags : null;
  const ambiguous = Array.isArray(review.ambiguousClauses) ? review.ambiguousClauses : null;
  const outside = Array.isArray(review.outsideReferences) ? review.outsideReferences : null;
  if (!flags || !ambiguous || !outside) return false;
  if (!flags.every((f) => f && f.severity === "know-this")) return false;
  if (review.withheldCount !== 0) return false;
  if (ambiguous.length > 0) return false;
  // QUESTIONS.md 36: this includes the references inside the documents the Reviewer added.
  if (!outside.every((r) => r && r.resolved === true)) return false;
  return true;
}

function readRiskFlags(data, texts, redLines) {
  if (!data || !Array.isArray(data.riskFlags)) {
    return { riskFlagsStatus: "unreadable-output", riskFlags: [], withheld: [], withheldCount: 0, judgmentsDropped: 0 };
  }
  const shown = [];
  const withheld = [];
  let judgmentsDropped = 0;
  for (const raw of data.riskFlags) {
    const result = checkFlag(raw, texts, redLines);
    if (result.flag) {
      shown.push(result.flag);
      if (result.judgmentDropped) judgmentsDropped += 1;
    } else withheld.push({ reason: result.withheld });
  }
  return { riskFlagsStatus: "checked", riskFlags: inGroups(shown), withheld, withheldCount: withheld.length, judgmentsDropped };
}

/**
 * @param {{ documentText: string, redLines: { id: string, name: string, catches?: string, basis?: object }[], adapter: { complete(prompt: string): Promise<string> }, ownerParty?: string | null, ocrRanges?: [number, number][], ocrPages?: number[], pageCount?: number | null }} input
 *   ocrPages, pageCount: the 1-based pages OCR read and the file's page count, for the scanned note
 *   ocrRanges: where OCR read the text (ADR 0008), as [start, end] offsets; empty for other text
 *   ownerParty: the Owner's side, fixed by the Reviewer ("Change", ticket 22 ruling E). It must be a
 *   term the document uses. Without it, the model works out the Owner.
 *   referencedDocuments (ticket 18): texts the Reviewer added against Outside references, each
 *   { id, title, text, referenceSentence, ocrRanges, inReferencedDocumentId }, reviewed together with the
 *   document as one review.
 *   previousMarks (QUESTIONS.md 38): the Reviewer's marks on the saved document's previous latest review,
 *   by markKey (outside-references.js), carried to the references this review finds again.
 */
export async function review({ documentText, redLines = [], adapter, ownerParty = null, ocrRanges = [], ocrPages = [], pageCount = null, referencedDocuments = [], previousMarks = null }) {
  if (!adapter || typeof adapter.complete !== "function") {
    throw new ReviewInputError("no-adapter", "no model adapter configured");
  }
  const text = typeof documentText === "string" ? documentText : "";
  if (text.trim().length === 0) throw new ReviewInputError("empty-document", "the document text is empty");
  if (text.length > MAX_DOCUMENT_LENGTH) throw new ReviewInputError("document-too-long", "the document text is too long");
  // ADR 0009: English documents only. The browser checks first; this keeps the rule for any caller.
  if (!looksEnglish(text)) throw new ReviewInputError("not-english", "the document is not in English");
  const lines = readRedLines(redLines);
  const ocr = readOcrRanges(ocrRanges, text.length);
  if (ocr === null) throw new ReviewInputError("bad-ocr-ranges", "the OCR ranges are not valid for this text");
  const scannedPages = readScannedPages(ocrPages, pageCount);
  if (scannedPages === null) throw new ReviewInputError("bad-ocr-pages", "the OCR pages are not valid");
  const referenced = readReferenced(referencedDocuments, text.length);
  const texts = reviewTexts(text, ocr, referenced);

  const normalisedDocument = normalise(text).toLowerCase();
  let fixedOwner = null;
  if (ownerParty != null) {
    fixedOwner = partyTermIn(ownerParty, normalisedDocument);
    if (!fixedOwner) throw new ReviewInputError("bad-owner-party", "the Owner must be a party the document names");
  }
  // Ruling C(a): a document with blanks reads as an unsigned form, to the model and to the Reviewer.
  const template = looksLikeTemplate(text);
  const numbers = documentNumbers(text);

  const data = parseReply(await adapter.complete(reviewPrompt(text, lines, { template, ownerParty: fixedOwner, texts })));

  // Each part of the reply is read on its own, so a broken list of Risk flags never costs the summary.
  const summaryText = readSummary(data);
  let summary;
  if (summaryText === null) {
    summary = { status: "withheld", reason: "unreadable-output" };
  } else {
    // A summary that breaks the hedge-word ban is still shown, with each banned word marked so the
    // Reviewer sees it (product owner, 2026-10-31). Numbers the document lacks are marked too.
    // With referenced documents the summary covers them too, so their numbers count as the document's.
    const allText = referenced.length > 0 ? texts.map((t) => t.text).join("\n\n") : text;
    const { marked } = ownText(summaryText, allText, { numbers: referenced.length > 0 ? documentNumbers(allText) : numbers });
    summary = { status: "shown", text: summaryText, marked };
  }

  // riskFlagsStatus "unreadable-output" means the list could not be read at all: it is not zero flags.
  // withheld records why each withheld flag failed; the flags themselves are never returned.
  const flagsRead = readRiskFlags(data, texts, lines);
  const { riskFlagsStatus, judgmentsDropped } = flagsRead;

  // Ticket 13: Outside references, found by Redline's own patterns over each stored text, plus any the
  // model adds under "outsideReferences" (optional; the prompt does not ask for them yet). One whose
  // sentence fails the check is withheld and counted with the flags, so it still blocks a Clean result.
  // QUESTIONS.md 36: the references inside each added document are found the same way, in that text.
  // QUESTIONS.md 31: a flag that only repeats a Red line 3 Outside reference in its own text is merged.
  const refs = outsideReferencesFor({
    texts,
    redLines: lines,
    flags: flagsRead.riskFlags,
    modelReferences: data?.outsideReferences,
    own: (t) => (x, opts) => ownText(x, t, opts),
    // A statute name holding a party term is never exempt from Red line 3 (security review).
    parties: [fixedOwner, partyTermIn(data?.ownerParty, normalisedDocument), ...readParties(data, normalisedDocument)].filter(Boolean),
    previousMarks,
  });
  // Numbered again, so the numbers stay 1, 2, 3 after a merge.
  const riskFlags = inGroups(refs.flags.map(({ number: _n, ...f }) => f));
  const withheld = [...flagsRead.withheld, ...refs.withheld];
  const withheldCount = withheld.length;

  // Ruling E: whose side the review is for. A fixed Owner is the Reviewer's choice; otherwise it is the
  // model's, shown only when the document uses that term.
  const owner = fixedOwner
    ? { term: fixedOwner, fixed: true }
    : (() => {
        const term = partyTermIn(data?.ownerParty, normalisedDocument);
        return term ? { term, fixed: false } : null;
      })();
  const parties = readParties(data, normalisedDocument);
  if (owner && !parties.some((p) => p.toLowerCase() === owner.term.toLowerCase())) parties.unshift(owner.term);

  const result = {
    summary,
    template,
    // QUESTIONS 18: how much of the document OCR read, or null when none of it was.
    scanned: scannedNote(scannedPages, ocr),
    ownerParty: owner,
    parties,
    // Ruling D: judgments dropped because they claimed what is market, standard or typical.
    judgmentsDropped,
    riskFlagsStatus,
    riskFlags,
    // Ticket 18: each reference says which text it sits in and which document was added against it.
    outsideReferences: refs.outsideReferences,
    // The referenced documents this review was run together with, for saving.
    referencedDocuments: texts.slice(1).map((t) => ({ id: t.id, title: t.title })),
    // QUESTIONS.md 40: the characters the contract and its added documents use together.
    charactersUsed: charactersUsedBy(texts),
    // Flags dropped because they repeated an Outside reference: not withheld, not stored.
    mergedCount: refs.mergedCount,
    ambiguousClauses: ambiguousClausesOf(riskFlags),
    withheld,
    withheldCount,
    cleanResult: null,
    cleanResultHeld: false,
    // The Red lines this review was checked against, as given. When the Risk flags could not be read,
    // nothing was checked, so none is listed.
    redLinesChecked: riskFlagsStatus === "checked" ? lines : [],
  };
  // Held back until tickets 13 and 07 land (clean-result-gate.js).
  Object.assign(result, gateCleanResult(cleanResultOf(result)));
  return result;
}
