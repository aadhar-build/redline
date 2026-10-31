"use client";

// A finished review: the summary, the question box under it and the Risk flags. Used right after a
// review and when a saved one is reopened from the library, so both read the same.

import { COPY } from "./copy";
import MarkedText from "./MarkedText";
import QuestionBox from "./QuestionBox";
import RiskFlags from "./RiskFlags";

/**
 * @param {{ review: object, documentText?: string, documentId?: string | null, askOff?: string | null, children?: React.ReactNode }} props
 * documentId set: the question box asks about the saved document by id. Otherwise it posts documentText.
 * askOff set: questions are off on this site, and this line says so in place of the box.
 * runToken: set only with the local Claude Code CLI adapter; the question route requires it back.
 */
export default function ReviewResult({ review, documentText, documentId = null, askOff = null, runToken = null, children }) {
  const summary = review.summary;
  const marked = summary.marked ?? [];
  return (
    <div className="results">
      <section className="pane summary-pane" aria-labelledby="summary-title">
        <div className="pane-head">
          <h2 className="pane-title" id="summary-title">{COPY.summaryCaption}</h2>
        </div>
        <div className="summary-body" aria-live="polite">
          <p className="summary-text" data-testid="summary">
            <MarkedText text={summary.text} marked={marked} />
          </p>
          {marked.length > 0 && <p className="marked-note" data-testid="marked-note">{COPY.markedNote}</p>}
          <p className="summary-note">{COPY.summaryNote}</p>
          {children}
          {askOff ? (
            <p className="summary-note" data-testid="ask-off">{askOff}</p>
          ) : (
            <QuestionBox key={documentId ?? documentText} documentId={documentId} documentText={documentText} runToken={runToken} />
          )}
        </div>
      </section>
      <RiskFlags review={review} />
    </div>
  );
}
