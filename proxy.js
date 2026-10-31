import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseConfig } from "./lib/supabase/config.js";

// Keeps the Supabase sign-in session fresh: when the access token has expired, the refreshed cookies
// are written to the response here, because server components cannot set cookies themselves. It does
// not decide who may see what; Row Level Security in the database does.
export async function proxy(request) {
  const config = supabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // The auth server being unreachable leaves the request signed out, not broken.
  }
  return response;
}

export const config = {
  // App screens and API routes only; the landing page and static files skip it.
  matcher: ["/review/:path*", "/library/:path*", "/sign-in", "/api/:path*"],
};
