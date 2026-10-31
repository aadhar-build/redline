"use client";

// A finished review: the summary, the question box under it and the Risk flags. Used right after a
// review and when a saved one is reopened from the library, so both read the same.

import { COPY } from "./copy";
import MarkedText, { isNumberMark } from "./MarkedText";
import OwnerLine from "./OwnerLine";
import QuestionBox from "./QuestionBox";
import RiskFlags from "./RiskFlags";

/**
 * @param {{ review: object, documentText?: string, documentId?: string | null, askOff?: string | null, runToken?: string | null, onChangeOwner?: ((term: string) => void) | null, busy?: boolean, children?: React.ReactNode }} props
 * documentId set: the question box asks about the saved document by id. Otherwise it posts documentText.
 * askOff set: questions are off on this site, and this line says so in place of the box.
 * runToken: set only with the local Claude Code CLI adapter; the question route requires it back.
 * onChangeOwner: set right after a review, so the Reviewer can re-run it for another party (ticket 22).
 */
export default function ReviewResult({
  review,
  documentText,
  documentId = null,
  askOff = null,
  runToken = null,
  onChangeOwner = null,
  busy = false,
  children,
}) {
  const summary = review.summary;
  const marked = summary.marked ?? [];
  return (
    <div className="results">
      <section className="pane summary-pane" aria-labelledby="summary-title">
        <div className="pane-head">
          <h2 className="pane-title" id="summary-title">{COPY.summaryCaption}</h2>
        </div>
        <div className="summary-body" aria-live="polite">
          {review.scanned && (
            <p className="template-note" data-testid="scanned-note">{COPY.scannedNote(review.scanned)}</p>
          )}
          {review.template && <p className="template-note" data-testid="template-note">{COPY.templateNote}</p>}
          <p className="summary-text" data-testid="summary">
            <MarkedText text={summary.text} marked={marked} />
          </p>
          {marked.some((m) => !isNumberMark(m)) && <p className="marked-note" data-testid="marked-note">{COPY.markedNote}</p>}
          {marked.some(isNumberMark) && <p className="marked-note" data-testid="number-note">{COPY.numberNote}</p>}
          <p className="summary-note">{COPY.summaryNote}</p>
          {children}
          {askOff ? (
            <p className="summary-note" data-testid="ask-off">{askOff}</p>
          ) : (
            <QuestionBox key={documentId ?? documentText} documentId={documentId} documentText={documentText} runToken={runToken} />
          )}
        </div>
      </section>
      <RiskFlags
        review={review}
        above={
          <OwnerLine
            key={review.ownerParty?.term ?? ""}
            ownerParty={review.ownerParty ?? null}
            parties={review.parties ?? []}
            onChange={onChangeOwner}
            busy={busy}
          />
        }
      />
    </div>
  );
}
