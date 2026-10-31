"use client";

// Asks Supabase to email a one-time sign-in link. The link comes back to /auth/callback on this site.
// No password is asked for or kept.

import { useState } from "react";
import { supabaseInBrowser } from "../../../lib/supabase/browser.js";
import { LIBRARY_COPY } from "../library/library-copy";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInForm() {
  const copy = LIBRARY_COPY.signIn;
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ kind: "empty" });

  async function onSubmit(event) {
    event.preventDefault();
    const address = email.trim();
    if (address.length === 0) return setState({ kind: "error", code: "empty" });
    if (!EMAIL.test(address)) return setState({ kind: "error", code: "invalid" });
    const supabase = supabaseInBrowser();
    if (!supabase) return setState({ kind: "error", code: "failed" });

    setState({ kind: "busy" });
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/library` },
    });
    if (error) return setState({ kind: "error", code: "failed" });
    setState({ kind: "sent", email: address });
  }

  const busy = state.kind === "busy";
  return (
    <form className="action-box sign-in-form" onSubmit={onSubmit} noValidate>
      <label className="field-label" htmlFor="sign-in-email">{copy.emailLabel}</label>
      <input
        id="sign-in-email"
        className="question-field"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="cta" type="submit" disabled={busy}>
        {busy ? copy.submitBusy : copy.submit}
      </button>
      {state.kind === "error" && <p className="form-error" role="alert">{copy.errors[state.code]}</p>}
      {state.kind === "sent" && <p className="sign-in-sent" role="status" data-testid="link-sent">{copy.sent(state.email)}</p>}
    </form>
  );
}
