import "server-only";

import { checkFlagText, cleanResultOf, inGroups, ownText, SEVERITIES } from "./review.js";
import { gateCleanResult } from "./clean-result-gate.js";
import { checkSources } from "./source-check.js";
import { assembleOutsideReferences, NOT_CITABLE, toStoredOutsideReferences } from "./outside-references.js";
import { documentNumbers, looksLikeTemplate } from "./wording.js";

// A saved review (ticket 10): how a review is written to the reviews table and how it is opened again.
//
// Opening a saved review never calls the model: reopenReview takes no adapter, so it cannot re-analyse
// (OQ17). It does re-run the Source sentence check on every stored sentence against the stored
// document text before anything is shown (CLAUDE.md trust rules): a stored row is not proof either.
//
// What is stored: the summary text, each shown flag with the exact text of its Source sentences, the
// withheld count and each withheld flag's reason code only ({"reason": code}, never model text; the
// database checks this). Offsets, marked words and judgment labels are worked out again from the
// stored text on reopen, with the same code Review uses, so a reopened review reads like a fresh one.
//
// Only a complete review is saved: one whose summary was shown and whose Risk flags list was read
// (settled by Fable advisor, 2026-10-31). Withheld flags never make a review incomplete. Otherwise
// there is nothing honest to reopen, because "no flags" and "unreadable flags" would look the same.

// The database allows the same codes (migrations 20261031000200 and 20261031000400).
export const WITHHELD_REASONS = Object.freeze(["source-not-found", "no-source", "unreadable", "unsupported-number"]);

export function isSavable(review) {
  return review?.summary?.status === "shown" && review?.riskFlagsStatus === "checked";
}

const keptWithheld = (withheld) => withheld.filter((w) => w.reason !== NOT_CITABLE);

/** The columns of a reviews row for a complete review. */
export function toStoredReview(review) {
  if (!isSavable(review)) throw new Error("only a complete review is saved");
  return {
    red_lines: review.redLinesChecked ?? [],
    summary: review.summary.text,
    flags: review.riskFlags.map((f) => ({
      severity: f.severity,
      title: f.title.text,
      says: f.says.text,
      judgment: f.judgment ? f.judgment.text : null,
      source_sentences: f.sourceSentences.map((s) => s.text),
      // Only the id: the match is rebuilt on reopen from the stored Red line list, never from model text.
      red_line: f.redLineMatch ? f.redLineMatch.id : null,
    })),
    // Reason codes only, so no model text is ever stored with a withheld flag. An Outside reference
    // Redline's patterns found but could not cite is left out: reopening finds it again and counts it.
    withheld: keptWithheld(review.withheld).map((w) => ({ reason: WITHHELD_REASONS.includes(w.reason) ? w.reason : "unreadable" })),
    withheld_count: keptWithheld(review.withheld).length,
    // Ticket 13: each Outside reference's kinds, its Source sentence's text and the Reviewer's mark.
    // Redline's wording and Counter-offer are rebuilt from the kinds on reopen, so no prose is stored.
    outside_references: toStoredOutsideReferences(review.outsideReferences),
  };
}

const text = (v) => (typeof v === "string" ? v.trim() : "");

// The Red line a stored flag matched, looked up in the list the review was checked against.
function redLineMatchFor(id, redLines) {
  if (typeof id !== "string") return null;
  const line = redLines.find((r) => r && r.id === id);
  return line ? { id: line.id, number: line.number, name: line.name } : null;
}

/**
 * Rebuilds the review shape the interface shows from a stored reviews row and the stored document text.
 * @param {{ documentText: string, stored: { summary: string, flags: object[], withheld_count: number, withheld: { reason: string }[], red_lines: unknown[] } }} input
 */
export function reopenReview({ documentText, stored }) {
  // The same ticket 22 checks as a fresh review: numbers the document lacks, dropped judgments, and
  // the template note, all worked out again from the stored text.
  const numbers = documentNumbers(documentText);
  const summaryText = text(stored?.summary);
  const summary = summaryText
    ? { status: "shown", text: summaryText, marked: ownText(summaryText, documentText, { numbers }).marked }
    : { status: "withheld", reason: "unreadable-output" };

  const storedRedLines = Array.isArray(stored?.red_lines) ? stored.red_lines : [];
  const shown = [];
  const failedNow = [];
  let judgmentsDropped = 0;
  for (const f of Array.isArray(stored?.flags) ? stored.flags : []) {
    const checked = SEVERITIES.includes(f?.severity) && text(f.title) && text(f.says)
      ? checkSources(documentText, Array.isArray(f.source_sentences) ? f.source_sentences : [])
      : { found: false };
    if (!checked.found) {
      failedNow.push({ reason: "source-not-found" });
      continue;
    }
    const own = checkFlagText({ title: f.title, says: f.says, judgment: f.judgment }, documentText, numbers);
    if (own.withheld) {
      failedNow.push({ reason: own.withheld });
      continue;
    }
    if (own.judgmentDropped) judgmentsDropped += 1;
    shown.push({
      severity: f.severity,
      title: own.title,
      says: own.says,
      judgment: own.judgment,
      sourceSentences: checked.sources,
      redLineMatch: redLineMatchFor(f.red_line, storedRedLines),
    });
  }

  const storedWithheld = (Array.isArray(stored?.withheld) ? stored.withheld : []).map((w) => ({
    reason: WITHHELD_REASONS.includes(w?.reason) ? w.reason : "unreadable",
  }));
  // Ticket 13: Outside references are found again in the stored text with the same patterns, so a row
  // saved before they were stored still shows them, and a stored one the patterns no longer find is
  // checked like a flag. The Reviewer's "reviewed" marks are carried over by Source sentence text.
  const refs = assembleOutsideReferences({
    documentText,
    redLines: storedRedLines,
    stored: stored?.outside_references,
    own: (t, opts) => ownText(t, documentText, opts),
  });
  // A reference the patterns find but cannot cite is not in the stored withheld list (toStoredReview
  // leaves it out, because it is found again here), so it is counted once.
  const withheld = [...storedWithheld, ...failedNow, ...refs.withheld];
  const reopened = {
    summary,
    template: looksLikeTemplate(documentText),
    // Not stored, so a reopened review does not say whose side it was for (ticket 22 report).
    ownerParty: null,
    parties: [],
    judgmentsDropped,
    riskFlagsStatus: "checked",
    riskFlags: inGroups(shown),
    outsideReferences: refs.outsideReferences,
    ambiguousClauses: [],
    // A stored flag that fails the check on reopen is withheld as source-not-found.
    withheld,
    withheldCount: withheld.length,
    cleanResult: null,
    cleanResultHeld: false,
    redLinesChecked: Array.isArray(stored?.red_lines) ? stored.red_lines : [],
  };
  // Worked out again with the same rule Review uses, from what reopening shows: a stored flag that now
  // fails the Source sentence check is withheld, so it blocks a Clean result here too.
  Object.assign(reopened, gateCleanResult(cleanResultOf(reopened)));
  return reopened;
}
