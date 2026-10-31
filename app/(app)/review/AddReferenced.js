"use client";

// Ticket 18: the Reviewer adds the document an Outside reference brings in, as a file or pasted text.
// A file is read here by Extraction, like any upload; only the text it returns is posted, never the
// file. The server saves the text to the Reviewer's account, reviews it together with the contract and
// sends back the new review, so the server alone decides what is resolved.

import { useRef, useState } from "react";
import { extractFile, extractPasted, MAX_TEXT_LENGTH } from "../../../lib/extraction/index.js";
import { COPY } from "./copy";

import { charactersLeft } from "./limits";

/**
 * @param {{ reference: object, number: number, documentId: string, runToken?: string | null, onReview: (review: object) => void, charactersUsed?: number | null }} props
 * charactersUsed: what the contract and its added documents use already, from the server.
 */
export default function AddReferenced({ reference, number, documentId, runToken = null, onReview, charactersUsed = null }) {
  const copy = COPY.outside.add;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null); // { name, source, ocrRanges, ocrPages, pageCount } once read
  const [state, setState] = useState({ kind: "idle" });
  const input = useRef(null);
  const busy = state.kind === "reading" || state.kind === "busy";

  if (!open) {
    return (
      <button type="button" className="link-button" onClick={() => setOpen(true)} data-testid="outside-add-open">
        {copy.open}
      </button>
    );
  }

  async function onFile(event) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setFile(null);
    setText("");
    setState({ kind: "reading" });
    let result;
    try {
      result = await extractFile(chosen);
    } catch {
      result = { kind: "rejected", reason: "unreadable" };
    }
    if (result.kind === "text") {
      setText(result.text);
      setFile({ name: chosen.name, source: result.source, ocrRanges: result.ocrRanges ?? [], ocrPages: result.ocrPages ?? [], pageCount: result.pageCount ?? null });
      return setState({ kind: "idle" });
    }
    if (input.current) input.current.value = "";
    setState({ kind: "error", code: result.kind === "needs-ocr" ? "ocr-failed" : result.reason });
  }

  function clearFile() {
    setFile(null);
    setText("");
    if (input.current) input.current.value = "";
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (text.trim().length === 0) return setState({ kind: "error", code: "empty-document" });
    // Refused here, before anything is sent, when it would take the total over the cap.
    if (Number.isInteger(charactersUsed) && charactersUsed + text.length > MAX_TEXT_LENGTH) return setState({ kind: "error", code: "combined-too-long" });
    if (text.length > MAX_TEXT_LENGTH) return setState({ kind: "error", code: "document-too-long" });
    const checked = extractPasted(text);
    if (checked.kind !== "text") return setState({ kind: "error", code: checked.reason });
    const source = file ? file.source : "paste";
    setState({ kind: "busy" });
    let res;
    let data;
    try {
      res = await fetch("/api/referenced-documents", {
        method: "POST",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        body: JSON.stringify({
          documentId,
          referenceSentence: reference.sourceSentences[0].text,
          inDocumentId: reference.referencedDocument?.id ?? null,
          text,
          source,
          ...(source === "pdf" && file.ocrRanges.length > 0 ? { ocrRanges: file.ocrRanges } : {}),
          ...(source === "pdf" && file.ocrPages.length > 0 ? { ocrPages: file.ocrPages, pageCount: file.pageCount } : {}),
        }),
      });
      data = await res.json();
    } catch {
      return setState({ kind: "error", code: "network" });
    }
    if (res.ok && data?.saved === "saved" && data?.review) return onReview(data.review);
    setState({ kind: "error", code: res.ok ? "incomplete" : (data?.error ?? "failed") });
  }

  const fileId = `outside-add-file-${number}`;
  const textId = `outside-add-text-${number}`;
  const errorText =
    state.kind !== "error"
      ? null
      : state.code === "combined-too-long"
        ? Number.isInteger(charactersUsed)
          ? COPY.outside.tooLongTogether(charactersLeft(charactersUsed))
          : COPY.errors["document-too-long"]
        : (copy.errors[state.code] ?? COPY.errors[state.code] ?? copy.errors.failed);
  return (
    <form className="outside-add" onSubmit={submit} noValidate data-testid="outside-add">
      <p className="field-hint">{copy.hint}</p>
      <label className="field-label" htmlFor={fileId}>{copy.fileLabel}</label>
      <input
        ref={input}
        id={fileId}
        className="file-field"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onFile}
        disabled={busy}
        data-testid="outside-add-file"
      />
      {state.kind === "reading" && <p className="field-hint" role="status">{COPY.fileReading}</p>}
      {file && (
        <p className="file-loaded">
          {COPY.fileLoaded(file.name)}{" "}
          <button type="button" className="link-button" onClick={clearFile}>{COPY.clearFile}</button>
        </p>
      )}
      <label className="field-label" htmlFor={textId}>{copy.pasteLabel}</label>
      <textarea
        id={textId}
        className="paste-field"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={file !== null}
        spellCheck={false}
        data-testid="outside-add-text"
      />
      <button type="submit" className="cta" disabled={busy} data-testid="outside-add-submit">
        {state.kind === "busy" ? copy.busy : copy.submit}
      </button>
      {errorText && <p className="form-error" role="alert">{errorText}</p>}
    </form>
  );
}
