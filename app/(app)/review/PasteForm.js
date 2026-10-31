"use client";

// Browser side of upload-or-paste and summarise. A chosen file is read here by Extraction
// (lib/extraction); only the text it returns is posted to the server route, never the file.
// It must never import from lib/review: the model adapter is server-only.

import { useRef, useState } from "react";
import { extractFile, extractPasted } from "../../../lib/extraction/index.js";
import { COPY } from "./copy";
import MarkedText from "./MarkedText";
import QuestionBox from "./QuestionBox";
import RiskFlags from "./RiskFlags";

const MAX_LENGTH = 200_000;

export default function PasteForm() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState(null); // set while the text shown came from a file
  const [state, setState] = useState({ kind: "empty" });
  const fileInput = useRef(null);

  function clearFile() {
    setFileName(null);
    setText("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onFileChosen(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(null);
    setText("");
    setState({ kind: "reading" });
    let result;
    try {
      result = await extractFile(file);
    } catch {
      result = { kind: "rejected", reason: "unreadable" };
    }
    if (result.kind === "text") {
      setText(result.text);
      setFileName(file.name);
      return setState({ kind: "empty" });
    }
    // A rejected file, or one with scanned pages (OCR is not built yet): nothing is sent.
    if (fileInput.current) fileInput.current.value = "";
    if (result.kind === "needs-ocr") return setState({ kind: "error", code: "needs-ocr", pages: result.pages });
    return setState({ kind: "error", code: result.reason });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (text.trim().length === 0) return setState({ kind: "error", code: "empty-document" });
    if (text.length > MAX_LENGTH) return setState({ kind: "error", code: "document-too-long" });
    const checked = extractPasted(text);
    if (checked.kind !== "text") return setState({ kind: "error", code: checked.reason });

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
  const reading = state.kind === "reading";
  let errorText = null;
  if (state.kind === "error") {
    errorText = state.code === "needs-ocr" ? COPY.scannedPages(state.pages) : (COPY.errors[state.code] ?? COPY.errors.failed);
  }

  return (
    <div className="paste-grid">
      <form className="action-box paste-form" onSubmit={onSubmit} noValidate>
        <label className="field-label" htmlFor="contract-file">{COPY.fileLabel}</label>
        <p className="field-hint" id="contract-file-hint">{COPY.fileHint}</p>
        <input
          ref={fileInput}
          id="contract-file"
          className="file-field"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-describedby="contract-file-hint"
          onChange={onFileChosen}
          disabled={busy || reading}
        />
        {reading && <p className="field-hint" role="status">{COPY.fileReading}</p>}
        {fileName && (
          <p className="file-loaded" data-testid="file-loaded">
            {COPY.fileLoaded(fileName)}{" "}
            <button type="button" className="link-button" onClick={clearFile}>{COPY.clearFile}</button>
          </p>
        )}

        <label className="field-label" htmlFor="contract-text">{COPY.fieldLabel}</label>
        <p className="field-hint" id="contract-text-hint">{COPY.fieldHint}</p>
        <textarea
          id="contract-text"
          className="paste-field"
          aria-describedby="contract-text-hint"
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={fileName !== null}
          rows={16}
          spellCheck={false}
        />
        <button className="cta" type="submit" disabled={busy || reading}>
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
