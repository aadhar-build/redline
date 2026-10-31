"use client";

// Browser side of upload-or-paste and summarise. A chosen file is read here by Extraction
// (lib/extraction); only the text it returns is posted to the server route, never the file, along with
// where the text came from ("pdf", "docx" or "paste").
// It must never import from lib/review: the model adapter is server-only.
//
// Signed in, the server saves the text and the review and returns the document id; the question box
// then asks about the saved document by id, so its answers are checked against the stored text.

import { useRef, useState } from "react";
import { extractFile, extractPasted, MAX_TEXT_LENGTH } from "../../../lib/extraction/index.js";
import { LIBRARY_COPY } from "../library/library-copy";
import { COPY } from "./copy";
import ReviewResult from "./ReviewResult";

const MAX_LENGTH = MAX_TEXT_LENGTH;

/**
 * @param {{ account: "off" | "signed-out" | "signed-in", runToken?: string | null }} props
 * runToken is set only when the local Claude Code CLI adapter runs this server; the routes require it
 * back (lib/review/local-guard.js).
 */
export default function PasteForm({ account = "off", runToken = null }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState(null); // set while the text shown came from a file
  const [fileSource, setFileSource] = useState(null); // "pdf" or "docx" while a file's text is shown
  const [hiddenText, setHiddenText] = useState(false); // the file's Word text has hidden runs
  // Where OCR read the file's text (ADR 0008): [start, end] offsets, posted with the text so Review
  // can apply the unreadable-amount rule. Empty for any text that did not come from OCR.
  const [ocrRanges, setOcrRanges] = useState([]);
  // The pages OCR read and the file's page count, for the scanned note (QUESTIONS 18). Numbers only.
  const [ocrPages, setOcrPages] = useState({ pages: [], pageCount: null });
  const [removedLines, setRemovedLines] = useState([]); // running lines left out of a PDF; never sent
  const [state, setState] = useState({ kind: "empty" });
  const fileInput = useRef(null);
  const reading = useRef(null); // the AbortController of the file being read

  function clearFile() {
    setFileName(null);
    setFileSource(null);
    setHiddenText(false);
    setOcrRanges([]);
    setOcrPages({ pages: [], pageCount: null });
    setRemovedLines([]);
    setText("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function cancelReading() {
    reading.current?.abort();
  }

  async function onFileChosen(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(null);
    setFileSource(null);
    setHiddenText(false);
    setOcrRanges([]);
    setOcrPages({ pages: [], pageCount: null });
    setRemovedLines([]);
    setText("");
    setState({ kind: "reading", progress: null });
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    const onProgress = (progress) => {
      if (!controller.signal.aborted) setState({ kind: "reading", progress });
    };
    let result;
    try {
      result = await extractFile(file, { onProgress, signal: controller.signal });
    } catch (err) {
      result = err?.name === "AbortError" ? { kind: "cancelled" } : { kind: "rejected", reason: "unreadable" };
    }
    if (reading.current !== controller) return; // another file was chosen meanwhile
    reading.current = null;
    if (result.kind === "text") {
      setText(result.text);
      setFileName(file.name);
      setFileSource(result.source);
      setHiddenText((result.hiddenRuns ?? 0) > 0);
      setOcrRanges(result.ocrRanges ?? []);
      setOcrPages({ pages: result.ocrPages ?? [], pageCount: result.pageCount ?? null });
      setRemovedLines(Array.isArray(result.removed) ? result.removed : []);
      return setState({ kind: "empty" });
    }
    // A rejected or cancelled file: nothing is sent.
    if (fileInput.current) fileInput.current.value = "";
    if (result.kind === "cancelled") return setState({ kind: "cancelled" });
    if (result.kind === "needs-ocr") return setState({ kind: "error", code: "ocr-failed" });
    return setState({ kind: "error", code: result.reason });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (text.trim().length === 0) return setState({ kind: "error", code: "empty-document" });
    if (text.length > MAX_LENGTH) return setState({ kind: "error", code: "document-too-long" });
    const checked = extractPasted(text);
    if (checked.kind !== "text") return setState({ kind: "error", code: checked.reason });
    // The text box is read-only while a file's text is in it, so the source is the file's or a paste.
    const source = fileName !== null && fileSource ? fileSource : "paste";
    return runReview(text, source, null);
  }

  // Sends the text for review. ownerParty set: the Reviewer chose whose side the review is for
  // (ticket 22, "Change"), and the same text is reviewed again with that party as the Owner.
  async function runReview(documentText, source, ownerParty) {
    setState({ kind: "busy" });
    let res;
    let data;
    try {
      res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        // ocrRanges, ocrPages and pageCount go only with a file's text that OCR read; they are numbers,
        // never file content.
        body: JSON.stringify({
          text: documentText,
          source,
          ...(ownerParty ? { ownerParty } : {}),
          ...(source === "pdf" && ocrRanges.length > 0 ? { ocrRanges } : {}),
          ...(source === "pdf" && ocrPages.pages.length > 0 ? { ocrPages: ocrPages.pages, pageCount: ocrPages.pageCount } : {}),
        }),
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
        documentText,
        source,
        documentId: data.documentId ?? null,
        saved: data.saved ?? "signed-out",
        review: data.review,
      });
    }
    return setState({ kind: "error", code: summary?.reason ?? "failed" });
  }

  const busy = state.kind === "busy";
  const isReading = state.kind === "reading";
  const progress = isReading ? state.progress : null;
  let errorText = null;
  if (state.kind === "error") errorText = COPY.errors[state.code] ?? COPY.errors.failed;
  const paste = LIBRARY_COPY.paste;

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
          disabled={busy || isReading}
        />
        {isReading && (
          <p className="field-hint" role="status" data-testid="file-reading">
            {progress && progress.total > 0 ? COPY.ocrProgress(progress.done, progress.total) : COPY.fileReading}{" "}
            {progress && (
              <button type="button" className="link-button" onClick={cancelReading}>{COPY.ocrCancel}</button>
            )}
          </p>
        )}
        {state.kind === "cancelled" && (
          <p className="field-hint" role="status" data-testid="file-cancelled">{COPY.ocrCancelled}</p>
        )}
        {fileName && (
          <p className="file-loaded" data-testid="file-loaded">
            {COPY.fileLoaded(fileName)}{" "}
            <button type="button" className="link-button" onClick={clearFile}>{COPY.clearFile}</button>
          </p>
        )}
        {fileName && hiddenText && (
          <p className="field-hint" data-testid="hidden-text-note">{COPY.hiddenText}</p>
        )}
        {fileName && removedLines.length > 0 && (
          <p className="field-hint" data-testid="removed-lines-note">{COPY.removedLines(removedLines)}</p>
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
        <button className="cta" type="submit" disabled={busy || isReading}>
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
        {account === "signed-in" && (
          <p className="field-hint" data-testid="own-red-lines">
            {paste.ownRedLines} <a href="/red-lines">{paste.ownRedLinesLink}</a>
          </p>
        )}
      </form>

      {state.kind === "summary" ? (
        <ReviewResult
          review={state.review}
          documentText={state.documentText}
          documentId={state.documentId}
          runToken={runToken}
          busy={busy}
          onChangeOwner={(term) => runReview(state.documentText, state.source, term)}
        >
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
