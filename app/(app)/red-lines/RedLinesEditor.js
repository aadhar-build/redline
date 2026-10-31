"use client";

// Lists the Reviewer's Red lines and lets them add, edit and remove any, Default Red lines included.
// Every change goes to /api/red-lines, which saves it to the account and returns the whole list.

import { useState } from "react";
import { RED_LINES_COPY as COPY } from "./red-lines-copy";

const labelFor = (r) => (r.defaultNumber ? COPY.defaultLabel(r.defaultNumber) : COPY.ownLabel);

async function send(method, body) {
  let res;
  try {
    res = await fetch("/api/red-lines", {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { error: "network" };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { error: data?.error ?? "failed" };
  return { list: data };
}

function RedLineItem({ redLine, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(redLine.name);
  const label = labelFor(redLine);
  const fieldId = `red-line-edit-${redLine.rowId}`;

  async function save(e) {
    e.preventDefault();
    if (await onSave(redLine.rowId, text)) setEditing(false);
  }

  return (
    <li className="red-line red-line-editable" data-testid="red-line" data-red-line={redLine.id}>
      <span className="red-line-ref" data-testid="red-line-label">{label}</span>
      {editing ? (
        <form className="red-line-edit" onSubmit={save}>
          <label className="sr-only" htmlFor={fieldId}>{COPY.editLabel(label)}</label>
          <textarea
            id={fieldId}
            className="paste-field red-line-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
          />
          <div className="red-line-actions">
            <button type="submit" className="cta" disabled={busy}>{busy ? COPY.saveBusy : COPY.save}</button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setText(redLine.name);
                setEditing(false);
              }}
            >
              {COPY.cancel}
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="red-line-name" data-testid="red-line-name">{redLine.name}</span>
          {redLine.catches ? <span className="red-line-catches">{redLine.catches}</span> : null}
          {redLine.basis ? (
            <span className="basis red-line-basis" data-testid="red-line-basis">
              <span className="basis-label">{COPY.basisLabel}</span>
              <strong>{redLine.basis.label}.</strong> {redLine.basis.note}
            </span>
          ) : null}
          {redLine.edited ? (
            <span className="red-line-catches" data-testid="red-line-edited">{COPY.editedNote(redLine.defaultNumber)}</span>
          ) : null}
          {redLine.defaultNumber === 3 ? (
            <span className="red-line-catches" data-testid="red-line-as-amended-note">{COPY.oneSidedChangesNote}</span>
          ) : null}
          <div className="red-line-actions">
            <button
              type="button"
              className="link-button"
              aria-label={COPY.editLabel(label)}
              onClick={() => {
                setText(redLine.name);
                setEditing(true);
              }}
            >
              {COPY.edit}
            </button>
            <button
              type="button"
              className="link-button"
              aria-label={COPY.removeLabel(label)}
              disabled={busy}
              onClick={() => onRemove(redLine.rowId)}
            >
              {COPY.remove}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/**
 * @param {{ initial: { redLines: object[], removedDefaults: number[] }, defaultNames: string[] }} props
 */
export default function RedLinesEditor({ initial, defaultNames }) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");

  async function run(method, body) {
    setBusy(true);
    setError(null);
    const result = await send(method, body);
    if (result.error === "not-found") {
      const fresh = await send("GET");
      if (fresh.list) setList(fresh.list);
    }
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setList(result.list);
    return true;
  }

  async function add(e) {
    e.preventDefault();
    if (draft.trim().length === 0) return setError("empty-red-line");
    if (await run("POST", { text: draft })) setDraft("");
  }

  return (
    <div className="red-lines-editor">
      {list.redLines.length === 0 ? (
        <p className="action-box" data-testid="red-lines-empty">{COPY.empty}</p>
      ) : (
        <ol className="red-lines" aria-label={COPY.listLabel} data-testid="red-lines">
          {list.redLines.map((r) => (
            <RedLineItem
              key={`${r.rowId}:${r.name}`}
              redLine={r}
              busy={busy}
              onSave={(id, text) => run("PATCH", { id, text })}
              onRemove={(id) => run("DELETE", { id })}
            />
          ))}
        </ol>
      )}

      {error && (
        <p className="form-error" role="alert" data-testid="red-lines-error">{COPY.errors[error] ?? COPY.errors.failed}</p>
      )}

      {list.removedDefaults.length > 0 && (
        <section className="red-lines-removed" aria-labelledby="removed-title" data-testid="red-lines-removed">
          <h2 className="field-label" id="removed-title">{COPY.removedTitle}</h2>
          {list.removedDefaults.map((n) => (
            <p key={n} className="marked-note" data-testid="red-line-removed">{COPY.removed(n, defaultNames[n - 1])}</p>
          ))}
        </section>
      )}

      <form className="paste-form red-line-add" onSubmit={add}>
        <label className="field-label" htmlFor="red-line-add">{COPY.addLabel}</label>
        <span className="field-hint" id="red-line-add-hint">{COPY.addHint}</span>
        <textarea
          id="red-line-add"
          className="paste-field red-line-field"
          aria-describedby="red-line-add-hint"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <button type="submit" className="cta" disabled={busy}>{COPY.addSubmit}</button>
      </form>
    </div>
  );
}
