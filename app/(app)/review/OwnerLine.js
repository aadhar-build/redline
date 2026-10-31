"use client";

// "Reviewed for: the Allottee" above the Risk flags, with a Change control (ticket 22, ruling E).
// Change re-runs the review with the chosen party fixed as the Owner. It is offered right after a review
// and on the latest saved review of a document (ticket 24), where the server re-runs the saved document.
// A saved review stores its party terms (ticket 24 part 2), so a reopened one offers them in a list too.
// With fewer than two known, the Reviewer types the party's name; the server refuses a party the
// contract doesn't name.

import { useState } from "react";
import { COPY } from "./copy";

/**
 * @param {{ ownerParty: { term: string, fixed: boolean } | null, parties: string[], onChange?: ((term: string) => void) | null, busy?: boolean, typed?: boolean }} props
 * typed: a reopened saved review, where the Reviewer types the party when fewer than two are known.
 */
export default function OwnerLine({ ownerParty, parties = [], onChange = null, busy = false, typed = false }) {
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(ownerParty?.term ?? parties[0] ?? "");
  const canChange = typeof onChange === "function" && (parties.length > 0 || typed);
  const pick = parties.length >= 2;

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
