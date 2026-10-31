"use client";

// Asks the server to review a saved document again against the Reviewer's current Red lines (OQ17).
// Only the document id is sent: the server reads the stored text and the current list itself, through
// the same guarded /api/review route as every other review. The new review is saved alongside the old
// one, and the page then reloads to show it.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COPY } from "../../review/copy";
import { LIBRARY_COPY } from "../library-copy";

/** @param {{ documentId: string, runToken?: string | null }} props */
export default function RerunButton({ documentId, runToken = null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const copy = LIBRARY_COPY.saved;

  async function rerun() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res;
    let data;
    try {
      res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json", ...(runToken ? { "x-redline-run-token": runToken } : {}) },
        body: JSON.stringify({ documentId }),
      });
      data = await res.json();
    } catch {
      setBusy(false);
      return setError(COPY.errors.network);
    }
    if (res.ok && data?.saved === "saved") {
      router.refresh();
      // Stays busy until the refreshed page replaces this one, so a second click cannot save twice.
      return;
    }
    setBusy(false);
    const code = res.ok ? "incomplete" : (data?.error ?? "failed");
    setError(copy.rerunErrors[code] ?? COPY.errors[code] ?? COPY.errors.failed);
  }

  return (
    <div className="rerun" data-testid="rerun">
      <button type="button" className="cta" onClick={rerun} disabled={busy} data-testid="rerun-button">
        {busy ? copy.rerunBusy : copy.rerun}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
