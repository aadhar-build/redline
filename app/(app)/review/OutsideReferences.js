"use client";

// The Outside reference group in the Risk flags pane (ticket 13, ADR 0007). Each reference is a Risk
// flag the server found and checked: its Source sentence passed the same check as every other flag.
// The browser only shows what it was given. Marking one as reviewed is sent to the server, which saves
// it as the Reviewer's statement and sends back the review, so the server alone decides whether the
// review is a Clean result.
//
// A web address in a Source sentence is shown as plain text, never as a link, and nothing here fetches
// it: Redline does not read referenced documents (ADR 0007).

import { useState } from "react";
import { Glyph, Tick, SEVERITY_LABELS } from "../../Glyph";
import { formatSavedAt } from "../library/format";
import { COPY } from "./copy";
import MarkedText from "./MarkedText";
import CounterOffer from "./CounterOffer";
import AddReferenced from "./AddReferenced";

const KIND = { "dont-sign-as-written": "dont", negotiate: "negotiate", "know-this": "know" };

function OwnText({ part }) {
  return <MarkedText text={part.text} marked={part.marked ?? []} />;
}

function MarkControl({ reference, documentId, onReview }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const copy = COPY.outside;
  if (!documentId || !onReview) {
    return <p className="field-hint" data-testid="outside-sign-in">{copy.signInToMark}</p>;
  }
  const reviewed = reference.reviewed !== null && reference.reviewed !== undefined;

  async function mark() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res;
    let data;
    try {
      res = await fetch("/api/outside-references", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId,
          sourceSentence: reference.sourceSentences[0].text,
          referenceKey: reference.key ?? null,
          inDocumentId: reference.referencedDocument?.id ?? null,
          reviewed: !reviewed,
        }),
      });
      data = await res.json();
    } catch {
      setBusy(false);
      return setError(COPY.errors.network);
    }
    setBusy(false);
    if (res.ok && data?.review) return onReview(data.review);
    setError(copy.errors[data?.error] ?? copy.errors.failed);
  }

  return (
    <div className="outside-mark">
      <button type="button" className="link-button" onClick={mark} disabled={busy} data-testid="outside-mark">
        {busy ? copy.markBusy : reviewed ? copy.unmark : copy.mark}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

// QUESTIONS.md 37: the Reviewer removes a document they added. The server reviews the contract again
// without it and only then deletes it, and sends back the new review.
function RemoveControl({ added, documentId, onReview, runToken }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const copy = COPY.outside.remove;

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res;
    let data;
    try {
      res = await fetch("/api/referenced-documents", {
        method: "DELETE",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        body: JSON.stringify({ documentId, referencedDocumentId: added.id }),
      });
      data = await res.json();
    } catch {
      setBusy(false);
      return setError(COPY.errors.network);
    }
    setBusy(false);
    if (res.ok && data?.saved === "saved" && data?.review) return onReview(data.review);
    const code = res.ok ? "incomplete" : (data?.error ?? "failed");
    setError(copy.errors[code] ?? COPY.errors[code] ?? copy.errors.failed);
  }

  return (
    <div className="outside-mark">
      <button type="button" className="link-button" onClick={remove} disabled={busy} data-testid="outside-remove">
        {busy ? copy.busy : copy.button}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function ReferenceItem({ reference, number, isOpen, onToggle, documentId, onReview, runToken, charactersUsed }) {
  const copy = COPY.outside;
  const kind = KIND[reference.severity] ?? "negotiate";
  const panelId = `outside-panel-${number}`;
  const reviewed = reference.reviewed !== null && reference.reviewed !== undefined;
  return (
    <li
      className={`flag is-ticked ${isOpen ? "is-open" : ""}`}
      data-testid="outside-reference"
      data-severity={reference.severity}
      data-reviewed={reviewed ? "yes" : "no"}
    >
      <button type="button" className="flag-row" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle}>
        <span className="flag-no">{number}</span>
        <span className={`stamp stamp-${kind}`}>
          <Glyph kind={kind} />
          {SEVERITY_LABELS[kind]}
        </span>
        <span className="flag-main">
          <span className="flag-title" data-testid="outside-title">
            <OwnText part={reference.title} />
          </span>
          <span className="flag-src">{reference.sourceSentences[0].text}</span>
          <span className={`outside-state ${reviewed ? "is-reviewed" : ""}`} data-testid="outside-state">
            {reference.addedDocument ? copy.addedTag : reviewed ? copy.reviewedTag : copy.notReviewedTag}
          </span>
        </span>
        <span className="flag-ref">
          <Tick drawn />
          <span className="sr-only">{COPY.flags.foundKey}</span>
        </span>
      </button>
      <div className="flag-panel" id={panelId} hidden={!isOpen}>
        {reference.referencedDocument ? (
          <p className="basis" data-testid="outside-in-added">{copy.inAdded(reference.referencedDocument.title)}</p>
        ) : null}
        <p className="says" data-testid="outside-says">
          <OwnText part={reference.says} />
        </p>
        {reference.redLineMatch ? (
          <p className="basis basis-redline" data-testid="outside-red-line">
            <span className="basis-label">{COPY.flags.redLineMatchLabel}</span>
            {COPY.flags.redLineMatched(reference.redLineMatch.number, reference.redLineMatch.name)}
          </p>
        ) : null}
        {reference.judgment ? (
          <p className="basis basis-judgment" data-testid="outside-judgment">
            <span className="basis-label">{COPY.flags.judgmentLabel}</span>
            <OwnText part={reference.judgment} />
          </p>
        ) : null}
        <figure className="source">
          <figcaption>{reference.sourceSentences.length > 1 ? copy.sourcesCaption : COPY.flags.sourceCaption}</figcaption>
          {reference.sourceSentences.map((s) => (
            <blockquote key={s.start} data-testid="source-sentence">{s.text}</blockquote>
          ))}
        </figure>
        <CounterOffer counterOffer={reference.counterOffer ?? null} number={number} />
        <div className="outside-review" data-testid="outside-review">
          {reference.addedDocument ? (
            <p className="basis basis-statement" data-testid="outside-added">{copy.added(reference.addedDocument.title)}</p>
          ) : null}
          {reference.addedDocument ? null : reviewed ? (
            <p className="basis basis-statement" data-testid="outside-statement">
              <span className="basis-label">{copy.statementLabel}</span>
              {copy.statement(formatSavedAt(reference.reviewed.at))}
            </p>
          ) : (
            <p className="basis" data-testid="outside-not-reviewed">{copy.notReviewed}</p>
          )}
          {reference.redLineMatch ? (
            <p className="basis" data-testid="outside-still-blocks">
              {reference.addedDocument ? copy.addedStillBlocks(reference.redLineMatch.number) : copy.stillBlocks}
            </p>
          ) : null}
          {reference.sourceSentences.length > 1 ? (
            <p className="basis" data-testid="outside-mark-covers">{copy.markCovers(reference.sourceSentences.length)}</p>
          ) : null}
          {reference.addedDocument ? null : <MarkControl reference={reference} documentId={documentId} onReview={onReview} />}
          {documentId && onReview && reference.addedDocument ? (
            <RemoveControl added={reference.addedDocument} documentId={documentId} onReview={onReview} runToken={runToken} />
          ) : null}
          {documentId && onReview && !reference.addedDocument && reference.kinds.some((k) => k !== "as-amended") ? (
            <AddReferenced reference={reference} number={number} documentId={documentId} runToken={runToken} onReview={onReview} charactersUsed={charactersUsed} />
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * @param {{ references: object[], firstNumber: number, documentId?: string | null, onReview?: ((review: object) => void) | null }} props
 * firstNumber: the number of the first reference, after the pane's other flags, so every number in the
 * pane is unique.
 */
export default function OutsideReferences({ references, firstNumber, documentId = null, onReview = null, runToken = null, charactersUsed = null }) {
  const [closed, setClosed] = useState(() => new Set());
  if (references.length === 0) return null;
  const toggle = (n) =>
    setClosed((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  return (
    <div className="group group-outside sev-outside" data-testid="group-outside">
      <h3 className="group-title">
        <Glyph kind="outside" />
        {COPY.outside.title} <span className="count">{references.length}</span>
      </h3>
      <p className="group-empty">{COPY.outside.lede}</p>
      <ul className="flags">
        {references.map((r, i) => {
          const number = firstNumber + i;
          return (
            <ReferenceItem
              key={`${r.referencedDocument?.id ?? "main"}|${r.key ?? r.sourceSentences[0].start}`}
              reference={r}
              number={number}
              isOpen={!closed.has(number)}
              onToggle={() => toggle(number)}
              documentId={documentId}
              onReview={onReview}
              runToken={runToken}
              charactersUsed={charactersUsed}
            />
          );
        })}
      </ul>
    </div>
  );
}
