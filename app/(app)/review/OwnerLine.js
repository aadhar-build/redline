"use client";

// "Reviewed for: the Allottee" above the Risk flags, with a Change control (ticket 22, ruling E).
// Change re-runs the review with the chosen party fixed as the Owner. It is offered right after a review
// and on the latest saved review of a document (ticket 24), where the server re-runs the saved document.
// A saved review stores only its Owner, not every party the model named, so with fewer than two parties
// known the Reviewer types the party's name; the server refuses a party the contract doesn't name.

import { useState } from "react";
import { COPY } from "./copy";

/**
 * @param {{ ownerParty: { term: string, fixed: boolean } | null, parties: string[], onChange?: ((term: string) => void) | null, busy?: boolean, typed?: boolean }} props
 * typed: the Reviewer types the party instead of picking from the list (a reopened saved review).
 */
export default function OwnerLine({ ownerParty, parties = [], onChange = null, busy = false, typed = false }) {
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(ownerParty?.term ?? parties[0] ?? "");
  const canChange = typeof onChange === "function" && (parties.length > 0 || typed);
  const pick = parties.length >= 2 && !typed;

  if (!ownerParty && !canChange) return null;

  if (editing && canChange) {
    return (
      <form
        className="owner-line"
        data-testid="owner-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice.trim()) onChange(choice.trim());
          setEditing(false);
        }}
      >
        <label htmlFor="owner-party">{COPY.owner.pickLabel}</label>
        {pick ? (
          <select id="owner-party" value={choice} onChange={(e) => setChoice(e.target.value)}>
            {parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <input id="owner-party" type="text" value={choice} onChange={(e) => setChoice(e.target.value)} data-testid="owner-typed" />
        )}
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
