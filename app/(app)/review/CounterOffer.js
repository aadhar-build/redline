"use client";

// A flag's Counter-offer (tickets 08 and 17): the replacement wording the Reviewer can send to the
// Counterparty, with a copy button. Every flag gets one; a Know this Counter-offer is styled quieter
// but is never hidden. The wording was checked on the server: banned words and numbers the contract
// lacks arrive marked, and this component only shows them.

import { useState } from "react";
import { COPY } from "./copy";
import MarkedText from "./MarkedText";

export default function CounterOffer({ counterOffer, number, quiet = false }) {
  const [state, setState] = useState("idle");
  if (!counterOffer) {
    return (
      <p className="basis counter-missing" data-testid="counter-offer-missing">
        {COPY.counterOffer.missing}
      </p>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(counterOffer.text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <figure className={`counter ${quiet ? "is-quiet" : ""}`} data-testid="counter-offer" data-quiet={quiet ? "true" : "false"}>
      <figcaption>
        <span>{COPY.counterOffer.caption}</span>
        <button type="button" className="copy-button" onClick={copy} aria-label={COPY.counterOffer.copyLabel(number)} data-testid="counter-offer-copy">
          {state === "copied" ? COPY.counterOffer.copied : COPY.counterOffer.copy}
        </button>
      </figcaption>
      <p data-testid="counter-offer-text">
        <MarkedText text={counterOffer.text} marked={counterOffer.marked ?? []} />
      </p>
      {counterOffer.newTermNote ? (
        <p className="basis counter-new-term" data-testid="counter-offer-needs-new-term">
          {COPY.counterOffer.needsNewTerm.lead}
          <MarkedText text={counterOffer.newTermNote.text} marked={counterOffer.newTermNote.marked ?? []} />
          {COPY.counterOffer.needsNewTerm.tail}
        </p>
      ) : null}
      {/* Announces the copy to screen readers; the button's own label stays the same. */}
      <span className="sr-only" aria-live="polite" data-testid="counter-offer-copy-status">
        {state === "copied" ? COPY.counterOffer.copied : ""}
      </span>
      {state === "failed" ? (
        <p className="counter-copy-failed" role="alert" data-testid="counter-offer-copy-failed">
          {COPY.counterOffer.copyFailed}
        </p>
      ) : null}
    </figure>
  );
}
