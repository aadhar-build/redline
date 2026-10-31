"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config.js";

// The browser's Supabase client, used only to ask for a sign-in link. It holds the public anon key;
// documents and reviews are read and written by the server, never from here.
export function supabaseInBrowser() {
  const config = supabaseConfig();
  return config ? createBrowserClient(config.url, config.anonKey) : null;
}
