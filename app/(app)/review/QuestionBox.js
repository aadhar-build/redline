"use client";

// The question box. It posts the text that was summarised and the Reviewer's question to the server
// route and shows an answer with its checked Source sentences, or says the contract doesn't answer it.
// It must never import from lib/review: the model adapter is server-only.

import { useState } from "react";
import { Tick } from "../../Glyph";
import { ASK_COPY } from "./ask-copy";

const MAX_QUESTION = 1_000;

// Renders text with each marked span wrapped in <mark>. Spans are character offsets, in order.
function MarkedText({ text, marked }) {
  const parts = [];
  let at = 0;
  for (const { start, end } of marked) {
    if (start < at || end > text.length) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="banned-word">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return parts;
}

/**
 * @param {{ documentText?: string, documentId?: string | null, runToken?: string | null }} props
 * documentId: a saved document. Only its id is sent; the server reads the stored text itself.
 * documentText: an unsaved paste, the text the summary was made from, not the live paste box.
 * runToken: set only with the local Claude Code CLI adapter; the route requires it back.
 */
export default function QuestionBox({ documentText, documentId = null, runToken = null }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState({ kind: "empty" });

  async function onSubmit(event) {
    event.preventDefault();
    const q = question.trim();
    if (q.length === 0) return setState({ kind: "error", code: "empty-question" });
    if (q.length > MAX_QUESTION) return setState({ kind: "error", code: "question-too-long" });

    setState({ kind: "busy" });
    let res;
    let data;
    try {
      res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        body: JSON.stringify(documentId ? { documentId, question: q } : { text: documentText, question: q }),
      });
      data = await res.json();
    } catch {
      return setState({ kind: "error", code: "network" });
    }
    if (!res.ok) return setState({ kind: "error", code: data?.error ?? "failed" });

    const answer = data?.answer;
    if (answer?.status === "answered") return setState({ kind: "answered", answer });
    if (answer?.status === "not-in-document") return setState({ kind: "not-in-document" });
    if (answer?.status === "withheld") return setState({ kind: "withheld", reason: answer.reason });
    return setState({ kind: "error", code: "failed" });
  }

  const busy = state.kind === "busy";
  const errorText = state.kind === "error" ? (ASK_COPY.errors[state.code] ?? ASK_COPY.errors.failed) : null;

  return (
    <section className="question-box" aria-labelledby="question-title">
      <form className="question-form" onSubmit={onSubmit} noValidate>
        <h3 className="box-title" id="question-title">{ASK_COPY.title}</h3>
        <label className="field-label" htmlFor="question-text">{ASK_COPY.fieldLabel}</label>
        <p className="field-hint" id="question-text-hint">{ASK_COPY.fieldHint}</p>
        <div className="question-row">
          <input
            id="question-text"
            className="question-field"
            type="text"
            aria-describedby="question-text-hint"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={MAX_QUESTION + 1}
            autoComplete="off"
          />
          <button className="cta" type="submit" disabled={busy}>
            {busy ? ASK_COPY.submitBusy : ASK_COPY.submit}
          </button>
        </div>
        {errorText && <p className="form-error" role="alert">{errorText}</p>}
      </form>

      <div className="answer-body" aria-live="polite" aria-busy={busy}>
        {state.kind === "answered" && (
          <div className="answer" data-testid="answer">
            <p className="answer-caption">{ASK_COPY.answerCaption}</p>
            <p className="answer-text" data-testid="answer-text">
              <MarkedText text={state.answer.text} marked={state.answer.marked ?? []} />
            </p>
            {state.answer.marked?.length > 0 && (
              <p className="marked-note" data-testid="answer-marked-note">{ASK_COPY.markedNote}</p>
            )}
            {state.answer.sources.map((s) => (
              <figure className="source" key={s.start} data-testid="answer-source">
                <figcaption>
                  <Tick className="source-tick" /> {ASK_COPY.sourceCaption}
                </figcaption>
                <blockquote className="source-quote">{s.text}</blockquote>
              </figure>
            ))}
            <p className="summary-note">{ASK_COPY.answerNote}</p>
          </div>
        )}
        {state.kind === "not-in-document" && (
          <p className="answer-none" data-testid="not-in-document">{ASK_COPY.notInDocument}</p>
        )}
        {state.kind === "withheld" && (
          <p className="answer-none" data-testid="answer-withheld">
            {ASK_COPY.withheld[state.reason] ?? ASK_COPY.errors.failed}
          </p>
        )}
        {(state.kind === "empty" || busy) && (
          <p className="summary-empty">{busy ? ASK_COPY.submitBusy : ASK_COPY.emptyState}</p>
        )}
      </div>
    </section>
  );
}
