import "server-only";

import { looksEnglish } from "../extraction/language.js";
import { gateCleanResult } from "./clean-result-gate.js";
import { checkSources } from "./source-check.js";
import { normalise } from "./normalise.js";
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
// line matches (ticket 06), the Clean result (ticket 11) and a Counter-offer on every flag (tickets 08
// and 17). The other parts of the review are present in the shape so callers do not change later, but
// they are not computed yet.

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

// The fixed line added when the document has blanks or placeholders (ticket 22, ruling C(a)).
export const TEMPLATE_PROMPT_LINE = "This document contains blanks and is an unsigned form.";

function ownerPromptPart(ownerParty) {
  if (ownerParty) {
    return [`The Owner is ${ownerParty}. Give "${ownerParty}" as "ownerParty".`];
  }
  return [
    'Work out which party is the Owner from the document. Give "ownerParty": the term the document itself uses for the Owner, copied from the document (for example "the Licensee"), or null when you cannot tell.',
  ];
}

function reviewPrompt(documentText, redLines, { template = false, ownerParty = null } = {}) {
  return [
    "You are reviewing a contract for the person who reads it before it is signed, on behalf of the small business that will sign it (the Owner).",
    ...(template ? [TEMPLATE_PROMPT_LINE] : []),
    ...ownerPromptPart(ownerParty),
    'Give "parties": the term the document uses for each party, copied from the document.',
    "",
    "Rules for everything you write:",
    '- State only what the document says. Bring in no facts from outside it: no geography, law, rates, dates or parties it does not state.',
    '- A document with blanks, placeholders or unfilled signature blocks is an unsigned template or form. Say what it "provides for". Never say it is signed, executed or dated.',
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
    ...redLinesPromptPart(redLines),
    ...counterOfferPromptPart(ownerParty),
    "",
    "State each point as fact. Do not hedge. Never use these words in your own text, Counter-offers included: may, could potentially, consider consulting a lawyer, safe, fine, good to sign.",
    'Reply with JSON only, in the form {"ownerParty": "...", "parties": ["..."], "summary": "...", "riskFlags": [{"severity": "...", "title": "...", "says": "...", "judgment": null, "sourceSentences": ["..."], "redLine": null, "counterOffer": "..."}]}.',
    "",
    "<document>",
    documentText,
    "</document>",
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

function partyTermIn(term, normalisedDocument) {
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
export function checkFlagText({ title, says, judgment }, documentText, numbers) {
  if (findUnsupportedNumbers(says, numbers).length > 0) return { withheld: "unsupported-number" };
  const judgmentText = nonEmptyString(judgment) ? judgment.trim() : null;
  const judgmentDropped = judgmentText !== null && findJudgmentWording(judgmentText, { documentText }).length > 0;
  return {
    title: ownText(title.trim(), documentText),
    says: ownText(says.trim(), documentText),
    judgment:
      judgmentText && !judgmentDropped ? ownText(judgmentText, documentText, { alwaysJudgment: true, numbers }) : null,
    judgmentDropped,
  };
}

// Checks one flag from the model. Returns { flag, judgmentDropped } or { withheld: reason }.
function checkFlag(raw, documentText, redLines, numbers) {
  if (!raw || typeof raw !== "object") return { withheld: "unreadable" };
  const { severity, title, says, judgment, sourceSentences, redLine, counterOffer } = raw;
  if (!SEVERITIES.includes(severity)) return { withheld: "unreadable" };
  if (!nonEmptyString(title) || !nonEmptyString(says)) return { withheld: "unreadable" };
  if (judgment != null && typeof judgment !== "string") return { withheld: "unreadable" };
  if (redLine != null && typeof redLine !== "string") return { withheld: "unreadable" };
  if (!Array.isArray(sourceSentences) || sourceSentences.length === 0) return { withheld: "no-source" };

  // Every Source sentence goes through the shared check; one that fails withholds the whole flag
  // (ADR 0010). What is shown is the span cut from the stored text, never the model's string.
  const checked = checkSources(documentText, sourceSentences);
  if (!checked.found) return { withheld: "source-not-found" };

  // A clause that matches a Red line is always Don't sign as written, whatever Severity the model
  // gave it (ADR 0003). Redline's code applies the rule; the model is not trusted to.
  const redLineMatch = matchedRedLine(redLine, redLines);

  const own = checkFlagText({ title, says, judgment }, documentText, numbers);
  if (own.withheld) return { withheld: own.withheld };

  return {
    flag: {
      severity: redLineMatch ? "dont-sign-as-written" : severity,
      redLineMatch,
      title: own.title,
      says: own.says,
      judgment: own.judgment,
      sourceSentences: checked.sources,
      // Tickets 08 and 17: marked, never withheld. A flag whose Counter-offer is missing or unreadable
      // still shows, with counterOffer null, because its Source sentences checked out (QUESTIONS.md).
      counterOffer: checkCounterOffer(counterOffer, numbers),
    },
    judgmentDropped: own.judgmentDropped,
  };
}

// Groups by Severity in the fixed order. Inside a group, flags follow the document, by where their
// first Source sentence starts, so the model's own order never reads as a ranking.
export function inGroups(flags) {
  const position = (f) => Math.min(...f.sourceSentences.map((s) => s.start));
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
// - no unresolved Outside reference. Ticket 13 adds them; until then the list is empty. An entry counts
//   as resolved only when it says so with resolved === true, so an entry of any other shape blocks.
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
  if (!outside.every((r) => r && r.resolved === true)) return false;
  return true;
}

function readRiskFlags(data, documentText, redLines, numbers) {
  if (!data || !Array.isArray(data.riskFlags)) {
    return { riskFlagsStatus: "unreadable-output", riskFlags: [], withheld: [], withheldCount: 0, judgmentsDropped: 0 };
  }
  const shown = [];
  const withheld = [];
  let judgmentsDropped = 0;
  for (const raw of data.riskFlags) {
    const result = checkFlag(raw, documentText, redLines, numbers);
    if (result.flag) {
      shown.push(result.flag);
      if (result.judgmentDropped) judgmentsDropped += 1;
    } else withheld.push({ reason: result.withheld });
  }
  return { riskFlagsStatus: "checked", riskFlags: inGroups(shown), withheld, withheldCount: withheld.length, judgmentsDropped };
}

/**
 * @param {{ documentText: string, redLines: { id: string, name: string, catches?: string, basis?: object }[], adapter: { complete(prompt: string): Promise<string> }, ownerParty?: string | null }} input
 *   ownerParty: the Owner's side, fixed by the Reviewer ("Change", ticket 22 ruling E). It must be a
 *   term the document uses. Without it, the model works out the Owner.
 */
export async function review({ documentText, redLines = [], adapter, ownerParty = null }) {
  if (!adapter || typeof adapter.complete !== "function") {
    throw new ReviewInputError("no-adapter", "no model adapter configured");
  }
  const text = typeof documentText === "string" ? documentText : "";
  if (text.trim().length === 0) throw new ReviewInputError("empty-document", "the document text is empty");
  if (text.length > MAX_DOCUMENT_LENGTH) throw new ReviewInputError("document-too-long", "the document text is too long");
  // ADR 0009: English documents only. The browser checks first; this keeps the rule for any caller.
  if (!looksEnglish(text)) throw new ReviewInputError("not-english", "the document is not in English");
  const lines = readRedLines(redLines);

  const normalisedDocument = normalise(text).toLowerCase();
  let fixedOwner = null;
  if (ownerParty != null) {
    fixedOwner = partyTermIn(ownerParty, normalisedDocument);
    if (!fixedOwner) throw new ReviewInputError("bad-owner-party", "the Owner must be a party the document names");
  }
  // Ruling C(a): a document with blanks reads as an unsigned form, to the model and to the Reviewer.
  const template = looksLikeTemplate(text);
  const numbers = documentNumbers(text);

  const data = parseReply(await adapter.complete(reviewPrompt(text, lines, { template, ownerParty: fixedOwner })));

  // Each part of the reply is read on its own, so a broken list of Risk flags never costs the summary.
  const summaryText = readSummary(data);
  let summary;
  if (summaryText === null) {
    summary = { status: "withheld", reason: "unreadable-output" };
  } else {
    // A summary that breaks the hedge-word ban is still shown, with each banned word marked so the
    // Reviewer sees it (product owner, 2026-10-31). Numbers the document lacks are marked too.
    const { marked } = ownText(summaryText, text, { numbers });
    summary = { status: "shown", text: summaryText, marked };
  }

  // riskFlagsStatus "unreadable-output" means the list could not be read at all: it is not zero flags.
  // withheld records why each withheld flag failed; the flags themselves are never returned.
  const { riskFlagsStatus, riskFlags, withheld, withheldCount, judgmentsDropped } = readRiskFlags(data, text, lines, numbers);

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
    ownerParty: owner,
    parties,
    // Ruling D: judgments dropped because they claimed what is market, standard or typical.
    judgmentsDropped,
    riskFlagsStatus,
    riskFlags,
    outsideReferences: [],
    ambiguousClauses: [],
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
