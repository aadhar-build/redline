import "server-only";

import { findBannedWording } from "./wording.js";

// Review: the main module and the main test seam (spec.md, "Modules and their interfaces").
// Document text, the Reviewer's Red lines and a model adapter go in; a review comes out.
// How it prompts the model and assembles the review is internal to this module.
//
// Ticket 01 builds the summary only. The other parts of the review are present in the shape so
// callers do not change later, but they are not computed yet, and an empty list of Risk flags here
// does not mean a Clean result: cleanResult stays null until ticket 11 computes it.

export const REVIEW_MODULE_NAME = "redline-review:server";

export const MAX_DOCUMENT_LENGTH = 200_000;

export class ReviewInputError extends Error {
  constructor(code, message) {
    super(`${REVIEW_MODULE_NAME}: ${message}`);
    this.name = "ReviewInputError";
    this.code = code;
  }
}

function summaryPrompt(documentText) {
  return [
    "You are summarising a contract for the person who reviews it before it is signed.",
    "Write a plain-English summary of what the document below says: who the parties are, what is provided, the term, the money, and how it ends.",
    "State only what the document says. Do not add anything the document does not support, and do not judge whether the terms are acceptable.",
    "State each point as fact. Do not hedge. Never use these words: may, could potentially, consider consulting a lawyer, safe, fine, good to sign.",
    'Reply with JSON only, in the form {"summary": "..."}.',
    "",
    "<document>",
    documentText,
    "</document>",
  ].join("\n");
}

// Model output is untrusted: anything that is not the expected JSON is unreadable.
function parseSummaryReply(reply) {
  let data;
  try {
    data = JSON.parse(String(reply).trim());
  } catch {
    return null;
  }
  if (!data || typeof data.summary !== "string") return null;
  const summary = data.summary.trim();
  return summary.length > 0 ? summary : null;
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

  const reply = await adapter.complete(summaryPrompt(text));
  const summaryText = parseSummaryReply(reply);

  let summary;
  if (summaryText === null) {
    summary = { status: "withheld", reason: "unreadable-output" };
  } else {
    const bannedWording = findBannedWording(summaryText, { documentText: text });
    summary =
      bannedWording.length > 0
        ? { status: "withheld", reason: "banned-wording", bannedWording }
        : { status: "shown", text: summaryText };
  }

  return {
    summary,
    riskFlags: [],
    outsideReferences: [],
    ambiguousClauses: [],
    withheldCount: 0,
    cleanResult: null,
    // No Red line is checked yet (ticket 06), so none is listed as checked.
    redLinesChecked: [],
  };
}
