"use client";

// Copy all as text (ticket 20): one button that puts the whole review on the clipboard as plain text.
// Same pattern as the Counter-offer copy button: the clipboard only, nothing is sent, and a polite live
// region tells screen readers when the copy worked.

import { useState } from "react";
import { COPY } from "./copy";
import { reviewAsText } from "./review-text";

export default function CopyAll({ review, ownerUnknownShown = false }) {
  const [state, setState] = useState("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reviewAsText(review, { ownerUnknownShown }));
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="copy-all" data-testid="copy-all">
      <button type="button" className="copy-button" onClick={copy} data-testid="copy-all-button">
        {state === "copied" ? COPY.copyAll.copied : COPY.copyAll.button}
      </button>
      <span className="sr-only" aria-live="polite" data-testid="copy-all-status">
        {state === "copied" ? COPY.copyAll.status : ""}
      </span>
      {state === "failed" ? (
        <p className="counter-copy-failed" role="alert" data-testid="copy-all-failed">{COPY.copyAll.failed}</p>
      ) : null}
    </div>
  );
}
