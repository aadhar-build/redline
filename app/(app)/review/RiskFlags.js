"use client";

// The Risk flags pane for a review that came back from the server. Every flag here has already passed
// the Source sentence check on the server; this component only shows what it was given. Flags arrive
// grouped by Severity, and inside a group they are in document order, not ranked.

import { useState } from "react";
import { Glyph, Tick, SEVERITY_LABELS } from "../../Glyph";
import { COPY } from "./copy";
import MarkedText from "./MarkedText";

// Review's Severity ids, in their fixed group order, and the glyph each one uses.
const GROUPS = [
  { severity: "dont-sign-as-written", kind: "dont" },
  { severity: "negotiate", kind: "negotiate" },
  { severity: "know-this", kind: "know" },
];

function JudgmentLabel() {
  return <span className="basis-label">{COPY.flags.judgmentLabel}</span>;
}

function OwnText({ part }) {
  return <MarkedText text={part.text} marked={part.marked ?? []} />;
}

function Withheld({ count, withheld }) {
  if (count === 0) return null;
  const by = (reason) => withheld.filter((w) => w.reason === reason).length;
  const reasons = ["source-not-found", "no-source", "unreadable"].filter((r) => by(r) > 0);
  return (
    <p className="withheld is-shown" data-testid="withheld">
      <Glyph kind="withheld" />
      <span>
        <strong data-testid="withheld-count">{COPY.flags.withheldTitle(count)}</strong>{" "}
        {reasons.map((r) => COPY.flags.withheldReason[r](by(r), count)).join(" ")} {COPY.flags.withheldTail}
      </span>
    </p>
  );
}

function FlagItem({ flag, kind, isOpen, onToggle }) {
  const panelId = `flag-panel-${flag.number}`;
  const total = flag.sourceSentences.length;
  return (
    <li className={`flag is-ticked ${isOpen ? "is-open" : ""}`} data-testid="risk-flag" data-severity={flag.severity}>
      <button type="button" className="flag-row" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle}>
        <span className="flag-no">{flag.number}</span>
        <span className={`stamp stamp-${kind}`}>
          <Glyph kind={kind} />
          {SEVERITY_LABELS[kind]}
        </span>
        <span className="flag-main">
          <span className="flag-title" data-testid="flag-title">
            <OwnText part={flag.title} />
            {flag.title.isJudgment ? <> <JudgmentLabel /></> : null}
          </span>
          <span className="flag-src">{flag.sourceSentences[0].text}</span>
        </span>
        <span className="flag-ref">
          <Tick drawn />
          <span className="sr-only">{COPY.flags.foundKey}</span>
        </span>
      </button>
      <div className="flag-panel" id={panelId} hidden={!isOpen}>
        {flag.says.isJudgment ? (
          <p className="basis basis-judgment says" data-testid="flag-says">
            <JudgmentLabel />
            <OwnText part={flag.says} />
          </p>
        ) : (
          <p className="says" data-testid="flag-says">
            <OwnText part={flag.says} />
          </p>
        )}
        {flag.judgment ? (
          <p className="basis basis-judgment" data-testid="flag-judgment">
            <JudgmentLabel />
            <OwnText part={flag.judgment} />
          </p>
        ) : null}
        {flag.sourceSentences.map((s, i) => (
          <figure className="source" key={s.start}>
            <figcaption>{total === 1 ? COPY.flags.sourceCaption : COPY.flags.sourceCaptionOf(i + 1, total)}</figcaption>
            <blockquote data-testid="source-sentence">{s.text}</blockquote>
          </figure>
        ))}
      </div>
    </li>
  );
}

export default function RiskFlags({ review }) {
  const flags = review.riskFlags ?? [];
  // Every flag starts open, so each Source sentence is on screen without a click.
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (n) =>
    setClosed((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const unreadable = review.riskFlagsStatus !== "checked";
  const anyMarked = flags.some((f) => [f.title, f.says, f.judgment].some((p) => p && p.marked?.length > 0));

  return (
    <section className="pane flags-pane" aria-labelledby="flags-title" data-testid="risk-flags">
      <div className="pane-head">
        <h2 className="pane-title" id="flags-title">{COPY.flags.title}</h2>
        {!unreadable && <p className="pane-status">{COPY.flags.status(flags.length)}</p>}
      </div>

      {unreadable ? (
        <p className="flags-message" role="alert" data-testid="flags-unreadable">{COPY.flags.unreadable}</p>
      ) : (
        <>
          <div className="key" aria-label={COPY.flags.keyLabel}>
            <ul className="key-group">
              {GROUPS.map(({ kind }) => (
                <li key={kind} className={`key-item sev-${kind}`}>
                  <Glyph kind={kind} />
                  <span>{SEVERITY_LABELS[kind]}</span>
                </li>
              ))}
            </ul>
            <ul className="key-group">
              <li className="key-item key-tick">
                <Tick />
                <span>{COPY.flags.foundKey}</span>
              </li>
            </ul>
          </div>

          <Withheld count={review.withheldCount ?? 0} withheld={review.withheld ?? []} />

          {flags.length === 0 && review.withheldCount === 0 ? (
            <p className="flags-message" data-testid="no-flags">{COPY.flags.none}</p>
          ) : (
            GROUPS.map(({ severity, kind }) => {
              const items = flags.filter((f) => f.severity === severity);
              return (
                <div className={`group sev-${kind}`} key={severity} data-testid={`group-${severity}`}>
                  <h3 className="group-title">
                    <Glyph kind={kind} />
                    {SEVERITY_LABELS[kind]} <span className="count">{items.length}</span>
                  </h3>
                  {items.length > 0 ? (
                    <ul className="flags">
                      {items.map((f) => (
                        <FlagItem
                          key={f.number}
                          flag={f}
                          kind={kind}
                          isOpen={!closed.has(f.number)}
                          onToggle={() => toggle(f.number)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="group-empty">{COPY.flags.emptyGroup}</p>
                  )}
                </div>
              );
            })
          )}

          {anyMarked && <p className="marked-note flags-note" data-testid="flags-marked-note">{COPY.markedNote}</p>}
        </>
      )}
    </section>
  );
}
