import "server-only";

import { inGroups, ownText, SEVERITIES } from "./review.js";
import { checkSources } from "./source-check.js";
import { findBannedWording } from "./wording.js";

// A saved review (ticket 10): how a review is written to the reviews table and how it is opened again.
//
// Opening a saved review never calls the model: reopenReview takes no adapter, so it cannot re-analyse
// (OQ17). It does re-run the Source sentence check on every stored sentence against the stored
// document text before anything is shown (CLAUDE.md trust rules): a stored row is not proof either.
//
// What is stored: the summary text, each shown flag with the exact text of its Source sentences, and
// the withheld count. Offsets, marked words and judgment labels are worked out again from the stored
// text on reopen, with the same code Review uses. The reasons behind each withheld flag are not stored,
// so a reopened review gives the count only.
//
// Only a complete review is saved: one whose summary was shown and whose Risk flags list was read.
// Otherwise there is nothing honest to reopen, because "no flags" and "unreadable flags" would look
// the same once stored.

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
    })),
    withheld_count: review.withheldCount,
  };
}

const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Rebuilds the review shape the interface shows from a stored reviews row and the stored document text.
 * @param {{ documentText: string, stored: { summary: string, flags: object[], withheld_count: number, red_lines: unknown[] } }} input
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
    });
  }

  const storedWithheld = Number.isInteger(stored?.withheld_count) && stored.withheld_count > 0 ? stored.withheld_count : 0;
  return {
    summary,
    riskFlagsStatus: "checked",
    riskFlags: inGroups(shown),
    outsideReferences: [],
    ambiguousClauses: [],
    // Reasons are not stored; a flag that fails the check on reopen counts as source-not-found.
    withheld: Array.from({ length: failedNow }, () => ({ reason: "source-not-found" })),
    withheldCount: storedWithheld + failedNow,
    cleanResult: null,
    redLinesChecked: Array.isArray(stored?.red_lines) ? stored.red_lines : [],
  };
}
