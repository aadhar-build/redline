"use client";

// Browser side of paste-and-summarise. It sends the pasted text to the server route and shows what
// comes back. It must never import from lib/review: the model adapter is server-only.
//
// Signed in, the server saves the text and the review and returns the document id; the question box
// then asks about the saved document by id, so its answers are checked against the stored text.

import { useState } from "react";
import { LIBRARY_COPY } from "../library/library-copy";
import { COPY } from "./copy";
import ReviewResult from "./ReviewResult";

const MAX_LENGTH = 200_000;

/** @param {{ account: "off" | "signed-out" | "signed-in" }} props */
export default function PasteForm({ account = "off" }) {
  const [text, setText] = useState("");
  const [state, setState] = useState({ kind: "empty" });

  async function onSubmit(event) {
    event.preventDefault();
    if (text.trim().length === 0) return setState({ kind: "error", code: "empty-document" });
    if (text.length > MAX_LENGTH) return setState({ kind: "error", code: "document-too-long" });

    setState({ kind: "busy" });
    let res;
    let data;
    try {
      res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      data = await res.json();
    } catch {
      return setState({ kind: "error", code: "network" });
    }

    if (!res.ok) return setState({ kind: "error", code: data?.error ?? "failed" });
    const summary = data?.review?.summary;
    if (summary?.status === "shown") {
      return setState({
        kind: "summary",
        documentText: text,
        documentId: data.documentId ?? null,
        saved: data.saved ?? "signed-out",
        review: data.review,
      });
    }
    return setState({ kind: "error", code: summary?.reason ?? "failed" });
  }

  const busy = state.kind === "busy";
  const errorText = state.kind === "error" ? (COPY.errors[state.code] ?? COPY.errors.failed) : null;
  const paste = LIBRARY_COPY.paste;

  return (
    <div className="paste-grid">
      <form className="action-box paste-form" onSubmit={onSubmit} noValidate>
        <label className="field-label" htmlFor="contract-text">{COPY.fieldLabel}</label>
        <p className="field-hint" id="contract-text-hint">{COPY.fieldHint}</p>
        <textarea
          id="contract-text"
          className="paste-field"
          aria-describedby="contract-text-hint"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          spellCheck={false}
        />
        <button className="cta" type="submit" disabled={busy}>
          {busy ? COPY.submitBusy : COPY.submit}
        </button>
        {errorText && (
          <p className="form-error" role="alert">{errorText}</p>
        )}
        {account === "signed-out" && (
          <p className="field-hint" data-testid="not-signed-in">
            {paste.signedOut} <a href="/sign-in">{paste.signedOutLink}</a>
          </p>
        )}
      </form>

      {state.kind === "summary" ? (
        <ReviewResult review={state.review} documentText={state.documentText} documentId={state.documentId}>
          {account === "signed-in" &&
            (state.documentId ? (
              <p className="saved-note" data-testid="saved-note">
                {paste.saved} <a href={`/library/${state.documentId}`}>{paste.savedLink}</a>
              </p>
            ) : state.saved === "incomplete" ? (
              <p className="marked-note" data-testid="not-saved-note">{paste.notSaved}</p>
            ) : (
              // The session ended between loading the page and pressing Review.
              <p className="marked-note" data-testid="not-saved-note">
                {paste.signedOut} <a href="/sign-in">{paste.signedOutLink}</a>
              </p>
            ))}
        </ReviewResult>
      ) : (
        <div className="results">
          <section className="pane summary-pane" aria-labelledby="summary-title" aria-busy={busy}>
            <div className="pane-head">
              <h2 className="pane-title" id="summary-title">{COPY.summaryCaption}</h2>
            </div>
            <div className="summary-body" aria-live="polite">
              <p className="summary-empty">{busy ? COPY.submitBusy : COPY.emptyState}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
