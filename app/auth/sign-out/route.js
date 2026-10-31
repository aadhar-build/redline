import { NextResponse } from "next/server";
import { requestOrigin } from "../../../lib/supabase/origin.js";
import { supabaseForRequest } from "../../../lib/supabase/server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const db = await supabaseForRequest();
  if (db) await db.auth.signOut();
  return NextResponse.redirect(new URL("/", requestOrigin(request)), 303);
}
