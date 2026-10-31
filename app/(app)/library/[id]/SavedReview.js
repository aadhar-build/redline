"use client";

// A reopened saved review (ticket 24). On the document's latest review, Change re-runs the saved
// document by id for the party the Reviewer names, through the same guarded /api/review route; the
// server saves a new review of the same document, and the page reloads to show it. An earlier review
// is read-only: no Change and no marking. Opening either never calls the model.

import { useRouter } from "next/navigation";
import { useState } from "react";
import ReviewResult from "../../review/ReviewResult";
import { COPY } from "../../review/copy";
import { LIBRARY_COPY } from "../library-copy";

/**
 * @param {{ review: object, documentId: string, askOff?: string | null, runToken?: string | null, canChange: boolean, readOnly: boolean }} props
 */
export default function SavedReview({ review, documentId, askOff = null, runToken = null, canChange, readOnly }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function change(ownerParty) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res;
    let data;
    try {
      res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        body: JSON.stringify({ documentId, ownerParty }),
      });
      data = await res.json();
    } catch {
      setBusy(false);
      return setError(COPY.errors.network);
    }
    if (res.ok && data?.saved === "saved") {
      router.refresh();
      return;
    }
    setBusy(false);
    const code = res.ok ? "incomplete" : (data?.error ?? "failed");
    setError(LIBRARY_COPY.saved.rerunErrors[code] ?? COPY.errors[code] ?? COPY.errors.failed);
  }

  return (
    <ReviewResult
      review={review}
      documentId={documentId}
      askOff={askOff}
      runToken={runToken}
      readOnly={readOnly}
      typedOwner
      busy={busy}
      onChangeOwner={canChange && !readOnly ? change : null}
    >
      {error && <p className="form-error" role="alert" data-testid="owner-change-error">{error}</p>}
    </ReviewResult>
  );
}
