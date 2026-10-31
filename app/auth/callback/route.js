import { NextResponse } from "next/server";
import { requestOrigin } from "../../../lib/supabase/origin.js";
import { supabaseForRequest } from "../../../lib/supabase/server.js";

// Where the emailed sign-in link lands. It swaps the one-time code for a session (stored in cookies by
// @supabase/ssr) and sends the Reviewer on. Redline never sees or stores a password.
export const dynamic = "force-dynamic";

// Only a path on this site, never another host.
function nextPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/library";
}

export async function GET(request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const next = nextPath(url.searchParams.get("next"));
  const db = await supabaseForRequest();
  if (db && code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/sign-in?link=failed", origin));
}
