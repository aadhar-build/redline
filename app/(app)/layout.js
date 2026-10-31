// App shell for screens behind the landing page. Sign-in arrives with ticket 02.
export default function AppLayout({ children }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="wordmark" href="/">Redline</a>
        </div>
      </header>
      <main id="main">{children}</main>
    </>
  );
}
