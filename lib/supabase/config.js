// The public Supabase settings: the project URL and the anon key, which Row Level Security is built to
// be safe with. Next.js inlines NEXT_PUBLIC_ values at build time. The service-role key is never read
// anywhere in the app.
//
// When either is missing (the production build on main has neither), accounts are off: no sign-in, no
// library, and the paste flow works unsaved.

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}
