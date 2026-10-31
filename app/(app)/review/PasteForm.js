"use client";

// Browser side of paste-and-summarise. It sends the pasted text to the server route and shows what
// comes back. It must never import from lib/review: the model adapter is server-only.

import { useState } from "react";
import { COPY } from "./copy";
import MarkedText from "./MarkedText";
import QuestionBox from "./QuestionBox";
import RiskFlags from "./RiskFlags";

const MAX_LENGTH = 200_000;

export default function PasteForm() {
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
        text: summary.text,
        marked: summary.marked ?? [],
        documentText: text,
        review: data.review,
      });
    }
    return setState({ kind: "error", code: summary?.reason ?? "failed" });
  }

  const busy = state.kind === "busy";
  const errorText = state.kind === "error" ? (COPY.errors[state.code] ?? COPY.errors.failed) : null;

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
      </form>

      <div className="results">
        <section className="pane summary-pane" aria-labelledby="summary-title" aria-busy={busy}>
          <div className="pane-head">
            <h2 className="pane-title" id="summary-title">{COPY.summaryCaption}</h2>
          </div>
          <div className="summary-body" aria-live="polite">
            {state.kind === "summary" ? (
              <>
                <p className="summary-text" data-testid="summary">
                  <MarkedText text={state.text} marked={state.marked} />
                </p>
                {state.marked.length > 0 && (
                  <p className="marked-note" data-testid="marked-note">{COPY.markedNote}</p>
                )}
                <p className="summary-note">{COPY.summaryNote}</p>
                <QuestionBox key={state.documentText} documentText={state.documentText} />
              </>
            ) : (
              <p className="summary-empty">{busy ? COPY.submitBusy : COPY.emptyState}</p>
            )}
          </div>
        </section>
        {state.kind === "summary" && <RiskFlags review={state.review} />}
      </div>
    </div>
  );
}
