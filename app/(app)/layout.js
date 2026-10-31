import { currentAccount } from "../../lib/supabase/server.js";
import { supabaseConfig } from "../../lib/supabase/config.js";
import { LIBRARY_COPY } from "./library/library-copy";

// App shell for screens behind the landing page. When accounts are on, the top bar links the library
// and signs in or out.
export default async function AppLayout({ children }) {
  const accountsOn = supabaseConfig() !== null;
  const { user } = accountsOn ? await currentAccount() : { user: null };
  const nav = LIBRARY_COPY.nav;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="wordmark" href="/">Redline</a>
          {accountsOn && (
            <nav className="account-nav" aria-label={nav.label}>
              <a href="/review">{nav.review}</a>
              {user ? (
                <>
                  <a href="/library">{nav.library}</a>
                  <span className="account-email" data-testid="account-email">{user.email}</span>
                  <form action="/auth/sign-out" method="post">
                    <button type="submit" className="link-button">{nav.signOut}</button>
                  </form>
                </>
              ) : (
                <a href="/sign-in">{nav.signIn}</a>
              )}
            </nav>
          )}
        </div>
      </header>
      <main id="main">{children}</main>
    </>
  );
}
