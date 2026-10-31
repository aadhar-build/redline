"use client";

// "Reviewed for: the Allottee" above the Risk flags, with a Change control (ticket 22, ruling E).
// Change re-runs the review with the chosen party fixed as the Owner. It is offered only right after a
// review (onChange set); a reopened saved review never calls the model, so it has no Change.

import { useState } from "react";
import { COPY } from "./copy";

/**
 * @param {{ ownerParty: { term: string, fixed: boolean } | null, parties: string[], onChange?: ((term: string) => void) | null, busy?: boolean }} props
 */
export default function OwnerLine({ ownerParty, parties = [], onChange = null, busy = false }) {
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(ownerParty?.term ?? parties[0] ?? "");
  const canChange = typeof onChange === "function" && parties.length > 0;

  if (!ownerParty && !canChange) return null;

  if (editing && canChange) {
    return (
      <form
        className="owner-line"
        data-testid="owner-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) onChange(choice);
          setEditing(false);
        }}
      >
        <label htmlFor="owner-party">{COPY.owner.pickLabel}</label>
        <select id="owner-party" value={choice} onChange={(e) => setChoice(e.target.value)}>
          {parties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy}>{COPY.owner.submit}</button>
        <button type="button" onClick={() => setEditing(false)}>{COPY.owner.cancel}</button>
      </form>
    );
  }

  return (
    <p className="owner-line" data-testid="owner-line">
      {ownerParty ? (
        <>
          <span className="owner-label">{COPY.owner.label}</span>{" "}
          <strong data-testid="owner-party">{ownerParty.term}</strong>
        </>
      ) : (
        <span data-testid="owner-unknown">{COPY.owner.unknown}</span>
      )}
      {canChange && (
        <button type="button" onClick={() => setEditing(true)} disabled={busy} data-testid="owner-change">
          {COPY.owner.change}
        </button>
      )}
    </p>
  );
}
