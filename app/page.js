import Demo from "./Demo";

const SIGN_IN = "/sign-in";

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="wordmark" href="/">Redline</a>
          <nav aria-label="Page">
            <ul className="nav">
              <li><a href="#contract">How it reads a contract</a></li>
              <li><a href="#limits">What it won&rsquo;t do</a></li>
              <li><a href={SIGN_IN}>Sign in</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main">
        <Demo signInHref={SIGN_IN}>
          <h1 className="headline">Every flag shows the sentence it came from.</h1>
          <p className="lede">
            Redline reads a vendor agreement, commercial lease or client agreement before it&rsquo;s signed and marks
            what to push back on.
          </p>
          <div className="action">
            <a className="cta" href={SIGN_IN}>Try it on a document</a>
            <p className="action-note">A PDF with selectable text, a Word file, or pasted text.</p>
          </div>
        </Demo>

        <section className="limits" id="limits" aria-labelledby="limits-title">
          <div className="wrap limits-grid">
            <div>
              <h2 className="section-title" id="limits-title">What Redline won&rsquo;t do</h2>
              <p className="section-lede">
                What a review covers, and what it leaves to you.
              </p>
            </div>
            <ul className="limits-list">
              <li>
                <h3>Tell you whether to sign</h3>
                <p>
                  It shows what the contract says and what to raise. It isn&rsquo;t a lawyer, and the decision stays
                  with you and the Owner.
                </p>
              </li>
              <li>
                <h3>Read scanned or photographed pages</h3>
                <p>It needs text it can select. If a contract is only a picture of text, Redline turns it away and says why.</p>
              </li>
              <li>
                <h3>Review other kinds of documents</h3>
                <p>It&rsquo;s built for vendor agreements, commercial leases and client agreements, before they&rsquo;re signed.</p>
              </li>
              <li>
                <h3>Read terms it wasn&rsquo;t given</h3>
                <p>
                  When a contract points to terms kept somewhere else, like a web address or an order form, Redline
                  flags the reference. The review can&rsquo;t be a Clean result until you upload that document or mark
                  it reviewed.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="sheet closing" aria-labelledby="closing-title">
          <div className="wrap">
            <div className="signoff">
              <h2 className="section-title" id="closing-title">Read the next contract before it&rsquo;s signed.</h2>
              <dl className="signoff-fields">
                <div><dt>Prepared by</dt><dd>Redline</dd></div>
                <div><dt>Reviewed by</dt><dd className="signoff-blank"><span className="sr-only">Not signed yet</span></dd></div>
                <div><dt>Date</dt><dd className="signoff-blank"><span className="sr-only">Not dated yet</span></dd></div>
              </dl>
              <a className="cta" href={SIGN_IN}>Try it on a document</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="wordmark wordmark-small">Redline</span>
          <p>Brightline Payments and the contract on this page are made up to show how a review reads.</p>
        </div>
      </footer>
    </>
  );
}
