import { NextResponse } from "next/server";
import { requestOrigin, safeNextPath } from "../../../lib/supabase/origin.js";
import { supabaseForRequest } from "../../../lib/supabase/server.js";

// Where the emailed sign-in link lands. It swaps the one-time code for a session (stored in cookies by
// @supabase/ssr) and sends the Reviewer on, only ever to a path on this site. Redline never sees or
// stores a password.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), origin);
  const db = await supabaseForRequest();
  if (db && code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/sign-in?link=failed", origin));
}
