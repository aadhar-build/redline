"use client";

// A finished review: the summary, the question box under it and the Risk flags. Used right after a
// review and when a saved one is reopened from the library, so both read the same.

import { useState } from "react";
import { COPY } from "./copy";
import MarkedText, { isNumberMark } from "./MarkedText";
import OwnerLine from "./OwnerLine";
import QuestionBox from "./QuestionBox";
import RiskFlags from "./RiskFlags";
import CopyAll from "./CopyAll";

/**
 * @param {{ review: object, documentText?: string, documentId?: string | null, askOff?: string | null, runToken?: string | null, onChangeOwner?: ((term: string) => void) | null, busy?: boolean, children?: React.ReactNode }} props
 * documentId set: the question box asks about the saved document by id. Otherwise it posts documentText.
 * askOff set: questions are off on this site, and this line says so in place of the box.
 * runToken: set only with the local Claude Code CLI adapter; the question route requires it back.
 * onChangeOwner: set right after a review, or on a saved document's latest review, so the Reviewer can
 *   re-run it for another party (tickets 22 and 24). typedOwner: the party is typed, not picked.
 * readOnly: an earlier saved review (ticket 24): no Change and no marking of Outside references.
 */
export default function ReviewResult({
  review,
  documentText,
  documentId = null,
  askOff = null,
  runToken = null,
  onChangeOwner = null,
  busy = false,
  readOnly = false,
  typedOwner = false,
  children,
}) {
  // After the Reviewer marks an Outside reference, the server sends the saved review back (ticket 13).
  // It replaces what is shown until a new review arrives from the parent. Whose side the review is for
  // is not stored, so that is kept from the review as it was.
  const [marked, setMarked] = useState(null);
  const current =
    marked && marked.base === review ? { ...marked.review, ownerParty: review.ownerParty, parties: review.parties } : review;
  const onReview = documentId && !readOnly ? (next) => setMarked({ base: review, review: next }) : null;
  return (
    <Result review={current} documentText={documentText} documentId={documentId} askOff={askOff} runToken={runToken}
      onChangeOwner={readOnly ? null : onChangeOwner} busy={busy} onReview={onReview} typedOwner={typedOwner}>
      {children}
    </Result>
  );
}

function Result({ review, documentText, documentId, askOff, runToken, onChangeOwner, busy, onReview, typedOwner, children }) {
  const summary = review.summary;
  const marked = summary.marked ?? [];
  return (
    <>
    <CopyAll
      key={JSON.stringify(review.outsideReferences?.map((r) => r.reviewed) ?? [])}
      review={review}
      ownerUnknownShown={!review.ownerParty && typeof onChangeOwner === "function" && (review.parties ?? []).length > 0}
    />
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
        documentId={documentId}
        onReview={onReview}
        runToken={runToken}
        above={
          <OwnerLine
            key={review.ownerParty?.term ?? ""}
            ownerParty={review.ownerParty ?? null}
            parties={review.parties ?? []}
            onChange={onChangeOwner}
            busy={busy}
            typed={typedOwner}
          />
        }
      />
    </div>
    </>
  );
}
