import "server-only";

import { cleanResultOf, inGroups, ownText, SEVERITIES } from "./review.js";
import { checkSources } from "./source-check.js";
import { findBannedWording } from "./wording.js";

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

export const WITHHELD_REASONS = Object.freeze(["source-not-found", "no-source", "unreadable"]);

export function isSavable(review) {
  return review?.summary?.status === "shown" && review?.riskFlagsStatus === "checked";
}

/** The columns of a reviews row for a complete review. Red lines checked: none yet (ticket 06). */
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
    // Reason codes only, so no model text is ever stored with a withheld flag.
    withheld: review.withheld.map((w) => ({ reason: WITHHELD_REASONS.includes(w.reason) ? w.reason : "unreadable" })),
    withheld_count: review.withheld.length,
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
  const summaryText = text(stored?.summary);
  const summary = summaryText
    ? {
        status: "shown",
        text: summaryText,
        marked: findBannedWording(summaryText, { documentText }).map((h) => ({
          phrase: h.phrase,
          start: h.index,
          end: h.index + h.match.length,
        })),
      }
    : { status: "withheld", reason: "unreadable-output" };

  const storedRedLines = Array.isArray(stored?.red_lines) ? stored.red_lines : [];
  const shown = [];
  let failedNow = 0;
  for (const f of Array.isArray(stored?.flags) ? stored.flags : []) {
    const checked = SEVERITIES.includes(f?.severity) && text(f.title) && text(f.says)
      ? checkSources(documentText, Array.isArray(f.source_sentences) ? f.source_sentences : [])
      : { found: false };
    if (!checked.found) {
      failedNow += 1;
      continue;
    }
    shown.push({
      severity: f.severity,
      title: ownText(text(f.title), documentText),
      says: ownText(text(f.says), documentText),
      judgment: text(f.judgment) ? ownText(text(f.judgment), documentText, { alwaysJudgment: true }) : null,
      sourceSentences: checked.sources,
      redLineMatch: redLineMatchFor(f.red_line, storedRedLines),
    });
  }

  const storedWithheld = (Array.isArray(stored?.withheld) ? stored.withheld : []).map((w) => ({
    reason: WITHHELD_REASONS.includes(w?.reason) ? w.reason : "unreadable",
  }));
  const withheld = [...storedWithheld, ...Array.from({ length: failedNow }, () => ({ reason: "source-not-found" }))];
  const reopened = {
    summary,
    riskFlagsStatus: "checked",
    riskFlags: inGroups(shown),
    outsideReferences: [],
    ambiguousClauses: [],
    // A stored flag that fails the check on reopen is withheld as source-not-found.
    withheld,
    withheldCount: withheld.length,
    cleanResult: null,
    redLinesChecked: Array.isArray(stored?.red_lines) ? stored.red_lines : [],
  };
  // Worked out again with the same rule Review uses, from what reopening shows: a stored flag that now
  // fails the Source sentence check is withheld, so it blocks a Clean result here too.
  reopened.cleanResult = cleanResultOf(reopened);
  return reopened;
}
