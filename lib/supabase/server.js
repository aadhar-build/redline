import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config.js";

// A Supabase client for one server request, signed in as whoever the request's cookies say, with the
// anon key. Row Level Security limits it to that account's rows. Null when accounts are off.
export async function supabaseForRequest() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        // Server components cannot set cookies; proxy.js refreshes the session for them.
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

/**
 * The signed-in account for this request, checked with the auth server, and a client for it.
 * @returns {Promise<{ db: import("@supabase/supabase-js").SupabaseClient | null, user: { id: string, email?: string } | null }>}
 */
export async function currentAccount() {
  const db = await supabaseForRequest();
  if (!db) return { db: null, user: null };
  try {
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) return { db, user: null };
    return { db, user: { id: data.user.id, email: data.user.email } };
  } catch {
    return { db, user: null };
  }
}
