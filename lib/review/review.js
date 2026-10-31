import "server-only";

import { checkSources } from "./source-check.js";
import { findBannedWording, findJudgmentWording } from "./wording.js";

// Review: the main module and the main test seam (spec.md, "Modules and their interfaces").
// Document text, the Reviewer's Red lines and a model adapter go in; a review comes out.
// How it prompts the model and assembles the review is internal to this module.
//
// Built so far: the summary (ticket 01) and Risk flags with checked Source sentences (ticket 03).
// The other parts of the review are present in the shape so callers do not change later, but they are
// not computed yet. An empty list of Risk flags does not mean a Clean result: cleanResult stays null
// until ticket 11 computes it.

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

function reviewPrompt(documentText) {
  return [
    "You are reviewing a contract for the person who reads it before it is signed, on behalf of the small business that will sign it (the Owner).",
    "",
    "Part 1, summary. Write a plain-English summary of what the document below says: who the parties are, what is provided, the term, the money, and how it ends.",
    "State only what the document says. Do not add anything the document does not support, and do not judge whether the terms are acceptable.",
    "",
    "Part 2, risk flags. List each clause that could hurt the Owner. For each one give:",
    '- "severity": exactly one of "dont-sign-as-written", "negotiate", "know-this". Severity comes from how far the clause departs from what a counterparty would typically offer in this kind of contract, not from worst-case cost. "dont-sign-as-written" is only for clear cases. When unsure whether a clause hurts the Owner, use "know-this".',
    '- "title": a short label for the clause.',
    '- "says": what the clause says, stated as fact, using only what the quoted sentences say.',
    '- "judgment": any claim the quoted sentences cannot prove, such as that the clause is unusual or departs from what is typical. Use null when there is none. Never put such a claim in "says".',
    '- "sourceSentences": the exact sentence or sentences from the document that the flag comes from, copied character for character, each one or more whole sentences. Never shorten, paraphrase or join sentences with an ellipsis. Give more than one only when the risk comes from several sentences together.',
    "",
    "State each point as fact. Do not hedge. Never use these words in your own text: may, could potentially, consider consulting a lawyer, safe, fine, good to sign.",
    'Reply with JSON only, in the form {"summary": "...", "riskFlags": [{"severity": "...", "title": "...", "says": "...", "judgment": null, "sourceSentences": ["..."]}]}.',
    "",
    "<document>",
    documentText,
    "</document>",
  ].join("\n");
}

// Model output is untrusted: anything that is not the expected JSON is unreadable.
function parseReply(reply) {
  try {
    const data = JSON.parse(String(reply).trim());
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
// labelled as Redline's judgment. marked holds character offsets into text.
export function ownText(text, documentText, { alwaysJudgment = false } = {}) {
  const marked = findBannedWording(text, { documentText }).map((h) => ({
    phrase: h.phrase,
    start: h.index,
    end: h.index + h.match.length,
  }));
  const isJudgment = alwaysJudgment || findJudgmentWording(text, { documentText }).length > 0;
  return { text, marked, isJudgment };
}

const nonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// Checks one flag from the model. Returns { flag } or { withheld: reason }.
function checkFlag(raw, documentText) {
  if (!raw || typeof raw !== "object") return { withheld: "unreadable" };
  const { severity, title, says, judgment, sourceSentences } = raw;
  if (!SEVERITIES.includes(severity)) return { withheld: "unreadable" };
  if (!nonEmptyString(title) || !nonEmptyString(says)) return { withheld: "unreadable" };
  if (judgment != null && typeof judgment !== "string") return { withheld: "unreadable" };
  if (!Array.isArray(sourceSentences) || sourceSentences.length === 0) return { withheld: "no-source" };

  // Every Source sentence goes through the shared check; one that fails withholds the whole flag
  // (ADR 0010). What is shown is the span cut from the stored text, never the model's string.
  const checked = checkSources(documentText, sourceSentences);
  if (!checked.found) return { withheld: "source-not-found" };

  return {
    flag: {
      severity,
      title: ownText(title.trim(), documentText),
      says: ownText(says.trim(), documentText),
      judgment: nonEmptyString(judgment) ? ownText(judgment.trim(), documentText, { alwaysJudgment: true }) : null,
      sourceSentences: checked.sources,
    },
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

function readRiskFlags(data, documentText) {
  if (!data || !Array.isArray(data.riskFlags)) {
    return { riskFlagsStatus: "unreadable-output", riskFlags: [], withheld: [], withheldCount: 0 };
  }
  const shown = [];
  const withheld = [];
  for (const raw of data.riskFlags) {
    const result = checkFlag(raw, documentText);
    if (result.flag) shown.push(result.flag);
    else withheld.push({ reason: result.withheld });
  }
  return { riskFlagsStatus: "checked", riskFlags: inGroups(shown), withheld, withheldCount: withheld.length };
}

/**
 * @param {{ documentText: string, redLines: string[], adapter: { complete(prompt: string): Promise<string> } }} input
 */
export async function review({ documentText, redLines = [], adapter }) {
  if (!adapter || typeof adapter.complete !== "function") {
    throw new ReviewInputError("no-adapter", "no model adapter configured");
  }
  const text = typeof documentText === "string" ? documentText : "";
  if (text.trim().length === 0) throw new ReviewInputError("empty-document", "the document text is empty");
  if (text.length > MAX_DOCUMENT_LENGTH) throw new ReviewInputError("document-too-long", "the document text is too long");

  const data = parseReply(await adapter.complete(reviewPrompt(text)));

  // Each part of the reply is read on its own, so a broken list of Risk flags never costs the summary.
  const summaryText = readSummary(data);
  let summary;
  if (summaryText === null) {
    summary = { status: "withheld", reason: "unreadable-output" };
  } else {
    // A summary that breaks the hedge-word ban is still shown, with each banned word marked so the
    // Reviewer sees it (product owner, 2026-10-31).
    const { marked } = ownText(summaryText, text);
    summary = { status: "shown", text: summaryText, marked };
  }

  // riskFlagsStatus "unreadable-output" means the list could not be read at all: it is not zero flags.
  // withheld records why each withheld flag failed; the flags themselves are never returned.
  const { riskFlagsStatus, riskFlags, withheld, withheldCount } = readRiskFlags(data, text);

  return {
    summary,
    riskFlagsStatus,
    riskFlags,
    outsideReferences: [],
    ambiguousClauses: [],
    withheld,
    withheldCount,
    cleanResult: null,
    // No Red line is checked yet (ticket 06), so none is listed as checked.
    redLinesChecked: [],
  };
}
