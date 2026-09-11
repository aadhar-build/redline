"use client";

import { useEffect, useRef, useState } from "react";
import { Glyph, Tick, SEVERITY_LABELS } from "./Glyph";

// Sample content: a made-up merchant services agreement, labelled as such on the page.
const CLAUSES = [
  { id: "2.1", text: "Supplier will process card payments for Customer at the business locations named in this Agreement." },
  {
    id: "4.2",
    text: "This Agreement renews automatically for successive three-year terms, and Customer will pay an early termination fee of $495 if it ends this Agreement before the end of a term.",
    flag: 2,
  },
  { id: "6.1", text: "Customer will pay each invoice within seven days of the invoice date.", flag: 3 },
  { id: "9.1", text: "The undersigned personally guarantees all of Customer's payment obligations under this Agreement.", flag: 1 },
  { id: "12.4", text: "Customer agrees to the Service Terms at brightline.example/terms.", flag: 5 },
  { id: "14.2", text: "This Agreement is governed by the laws of the State of Delaware.", flag: 4 },
];

const FLAGS = [
  {
    n: 1,
    severity: "dont",
    clause: "9.1",
    title: "Personal guarantee",
    basis: { kind: "redline", text: "Matches a Default Red line: personal guarantee." },
    says: "Whoever signs becomes personally liable for the business's payments.",
    counter: "Delete clause 9.1. Customer's payment obligations under this Agreement belong to Customer only.",
  },
  {
    n: 2,
    severity: "dont",
    clause: "4.2",
    title: "Three-year auto-renewal with a $495 exit fee",
    basis: { kind: "redline", text: "Matches a Default Red line: auto-renewal with an exit fee." },
    says: "The agreement renews for three years at a time, and ending it early costs $495.",
    counter:
      "This Agreement renews for successive one-year terms unless either party gives thirty days' notice, and Customer can end it at any time without a fee.",
  },
  {
    n: 3,
    severity: "negotiate",
    clause: "6.1",
    title: "Invoices due in seven days",
    basis: { kind: "judgment", text: "Shorter than the payment window usually offered in this kind of agreement." },
    says: "Each invoice is due seven days after its date.",
    counter: "Customer will pay each invoice within thirty days of the invoice date.",
  },
  {
    n: 4,
    severity: "know",
    clause: "14.2",
    title: "Delaware law",
    basis: null,
    says: "Disputes are decided under the laws of Delaware.",
    counter: null,
  },
];

// An Outside reference carries no Severity: OQ1 in PRD.md is still open.
const OUTSIDE = {
  n: 5,
  severity: null,
  clause: "12.4",
  title: "Service Terms at a web address",
  basis: null,
  says: "Part of this deal sits in a document that wasn't uploaded. Upload it or mark it reviewed before the review can be a Clean result.",
  counter: null,
};

const SEVERITIES = ["dont", "negotiate", "know"];
const ORDER = [1, 2, 3, 4, 5];
const STEP_MS = 520;

function sentenceFor(clauseId) {
  return CLAUSES.find((c) => c.id === clauseId)?.text ?? "";
}

export default function Demo({ children, signInHref }) {
  const [open, setOpen] = useState(1);
  const [ticked, setTicked] = useState(ORDER.length);
  const [withheldShown, setWithheldShown] = useState(true);
  // Starts unplayed so the server HTML carries no data-played and the html.motion hold applies from first paint.
  // Without motion, html.motion is never set and the finished state shows as rendered.
  const [played, setPlayed] = useState(false);
  const paneRef = useRef(null);

  // The one authored moment: each Risk flag's sentence is found in turn, then the withheld count appears.
  // The pre-paint state comes from the `motion` class an inline script sets on <html>, so nothing erases on load.
  useEffect(() => {
    const pane = paneRef.current;
    if (!document.documentElement.classList.contains("motion") || !pane) return;

    setTicked(0);
    setWithheldShown(false);
    setPlayed(false);
    const timers = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setPlayed(true);
        ORDER.forEach((_, i) => {
          timers.push(setTimeout(() => setTicked(i + 1), 300 + i * STEP_MS));
        });
        timers.push(setTimeout(() => setWithheldShown(true), 300 + ORDER.length * STEP_MS + 150));
      },
      { threshold: 0.3 }
    );
    io.observe(pane);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const openFlag = FLAGS.find((f) => f.n === open) || (open === OUTSIDE.n ? OUTSIDE : null);
  const litClause = openFlag?.clause;

  function showInContract(clauseId, n) {
    setOpen(n);
    document.getElementById(`clause-${clauseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showFlag(n) {
    setOpen(n);
    document.getElementById(`flag-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const doneCount = Math.min(ticked, ORDER.length);

  return (
    <div className="demo" data-played={played ? "" : undefined}>
      <section className="sheet hero" aria-label="Redline">
        <div className="wrap">
          <dl className="header-block">
            <div><dt>Document</dt><dd>Merchant services agreement <span className="sample">sample</span></dd></div>
            <div><dt>Counterparty</dt><dd>Brightline Payments <span className="sample">sample</span></dd></div>
            <div><dt>Reference</dt><dd className="ref">C-1</dd></div>
            <div><dt>Prepared by</dt><dd>Redline</dd></div>
            <div><dt>Reviewed by</dt><dd>You</dd></div>
          </dl>

          <div className="hero-grid">
            <div className="intro">{children}</div>

            <div className="pane" ref={paneRef} aria-labelledby="pane-title">
              <div className="pane-head">
                <h2 id="pane-title" className="pane-title">Risk flags</h2>
                <p className="pane-status" aria-live="polite">
                  <span className="status-pending">Finding sentences</span>
                  <span className="status-live">
                    {doneCount < ORDER.length
                      ? `Finding sentences: ${doneCount} of ${ORDER.length}`
                      : `${ORDER.length} sentences found in the contract`}
                  </span>
                </p>
              </div>

              <div className="key" aria-label="Key">
                <ul className="key-group">
                  {SEVERITIES.map((k) => (
                    <li key={k} className={`key-item sev-${k}`}>
                      <Glyph kind={k} />
                      <span>{SEVERITY_LABELS[k]}</span>
                    </li>
                  ))}
                </ul>
                <ul className="key-group key-group-other">
                  <li className="key-item sev-outside">
                    <Glyph kind="outside" />
                    <span>Outside reference</span>
                  </li>
                </ul>
                <ul className="key-group">
                  <li className="key-item key-tick">
                    <Tick />
                    <span>Sentence found in the contract</span>
                  </li>
                </ul>
              </div>

              <p className={`withheld ${withheldShown ? "is-shown" : ""}`}>
                <Glyph kind="withheld" />
                <span>
                  <strong>1 Risk flag withheld.</strong> It quoted a sentence the contract doesn&rsquo;t contain, so it
                  isn&rsquo;t shown.
                </span>
              </p>

              {SEVERITIES.map((sev) => {
                const items = FLAGS.filter((f) => f.severity === sev);
                return (
                  <div className={`group sev-${sev}`} key={sev}>
                    <h3 className="group-title">
                      <Glyph kind={sev} />
                      {SEVERITY_LABELS[sev]} <span className="count">{items.length}</span>
                    </h3>
                    <ol className="flags">
                      {items.map((f) => (
                        <FlagRow
                          key={f.n}
                          f={f}
                          isOpen={open === f.n}
                          isTicked={f.n <= ticked}
                          onToggle={() => setOpen(open === f.n ? 0 : f.n)}
                          onShow={() => showInContract(f.clause, f.n)}
                        />
                      ))}
                    </ol>
                  </div>
                );
              })}

              <div className="group group-outside sev-outside">
                <h3 className="group-title">
                  <Glyph kind="outside" />
                  Outside reference <span className="count">1</span>
                </h3>
                <ol className="flags">
                  <FlagRow
                    f={OUTSIDE}
                    isOpen={open === OUTSIDE.n}
                    isTicked={OUTSIDE.n <= ticked}
                    onToggle={() => setOpen(open === OUTSIDE.n ? 0 : OUTSIDE.n)}
                    onShow={() => showInContract(OUTSIDE.clause, OUTSIDE.n)}
                  />
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contract-section" id="contract" aria-labelledby="contract-title">
        <div className="wrap contract-grid">
          <div className="contract-aside">
            <h2 className="section-title" id="contract-title">The contract, as uploaded</h2>
            <p className="section-lede">
              A made-up agreement. Select a reference number to open its Risk flag. Every Risk flag points back to one
              sentence here.
            </p>
            <a className="cta cta-quiet" href={signInHref}>Try it on a document</a>
          </div>
          <ol className="clauses">
            {CLAUSES.map((c) => {
              const lit = litClause === c.id;
              return (
                <li key={c.id} id={`clause-${c.id}`} className={`clause ${lit ? "is-lit" : ""}`}>
                  <span className="clause-no">{c.id}</span>
                  <p className="clause-text">
                    <span className="sentence">{c.text}</span>
                    {c.flag ? (
                      <button
                        type="button"
                        className={`ref-chip ${c.flag <= ticked ? "is-ticked" : ""}`}
                        onClick={() => showFlag(c.flag)}
                        aria-label={`Open Risk flag ${c.flag}`}
                        aria-pressed={open === c.flag}
                      >
                        <Tick drawn={c.flag <= ticked} />
                        <span>C-1.{c.flag}</span>
                      </button>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}

function FlagRow({ f, isOpen, isTicked, onToggle, onShow }) {
  const panelId = `flag-panel-${f.n}`;
  const sentence = sentenceFor(f.clause);
  return (
    <li id={`flag-${f.n}`} className={`flag ${isOpen ? "is-open" : ""} ${isTicked ? "is-ticked" : ""}`}>
      <button type="button" className="flag-row" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle}>
        <span className="flag-no">{f.n}</span>
        {f.severity ? (
          <span className={`stamp stamp-${f.severity}`}>
            <Glyph kind={f.severity} />
            {SEVERITY_LABELS[f.severity]}
          </span>
        ) : (
          <span className="stamp stamp-outside">
            <Glyph kind="outside" />
            Not reviewed
          </span>
        )}
        <span className="flag-main">
          <span className="flag-title">{f.title}</span>
          <span className="flag-src">
            <span className="flag-src-clause">{f.clause}</span> {sentence}
          </span>
        </span>
        <span className="flag-ref">
          <Tick drawn={isTicked} />
          C-1.{f.n}
        </span>
      </button>
      <div className="flag-panel" id={panelId} hidden={!isOpen}>
        <p className="says">{f.says}</p>
        {f.basis ? (
          <p className={`basis basis-${f.basis.kind}`}>
            <span className="basis-label">{f.basis.kind === "redline" ? "Red line match" : "Redline's judgment"}</span>
            {f.basis.text}
          </p>
        ) : null}
        <figure className="source">
          <figcaption>Source sentence, clause {f.clause}</figcaption>
          <blockquote>{sentence}</blockquote>
        </figure>
        {f.counter ? (
          <figure className="counter">
            <figcaption>Counter-offer</figcaption>
            <p>{f.counter}</p>
          </figure>
        ) : null}
        <button type="button" className="show-link" onClick={onShow}>
          Show clause {f.clause} in the contract
        </button>
      </div>
    </li>
  );
}
