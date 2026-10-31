"use client";

// The Risk flags pane for a review that came back from the server. Every flag here has already passed
// the Source sentence check on the server; this component only shows what it was given. Flags arrive
// grouped by Severity, and inside a group they are in document order, not ranked.

import { useState } from "react";
import { Glyph, Tick, SEVERITY_LABELS } from "../../Glyph";
import { COPY } from "./copy";
import MarkedText, { isNumberMark } from "./MarkedText";
import OutsideReferences from "./OutsideReferences";
import CounterOffer from "./CounterOffer";

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
  const reasons = ["source-not-found", "unsupported-number", "no-source", "unreadable", "reference-not-citable"].filter((r) => by(r) > 0);
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
        {flag.redLineMatch ? (
          <p className="basis basis-redline" data-testid="flag-red-line">
            <span className="basis-label">{COPY.flags.redLineMatchLabel}</span>
            {COPY.flags.redLineMatched(flag.redLineMatch.number, flag.redLineMatch.name)}
          </p>
        ) : null}
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
        <CounterOffer counterOffer={flag.counterOffer} number={flag.number} quiet={flag.severity === "know-this"} />
      </div>
    </li>
  );
}

// The Red lines this review was checked against, each with its basis, as the server listed them.
// lede replaces the usual line under the title; empty is shown in place of an empty list.
function RedLinesChecked({ redLines, lede = COPY.redLines.lede, empty = null }) {
  if (redLines.length === 0) {
    if (!empty) return null;
    return (
      <div className="red-lines-checked" data-testid="red-lines-checked">
        <h3 className="group-title">{COPY.redLines.title}</h3>
        <p className="basis" data-testid="no-red-lines">{empty}</p>
      </div>
    );
  }
  return (
    <div className="red-lines-checked" data-testid="red-lines-checked">
      <h3 className="group-title">{COPY.redLines.title}</h3>
      <p className="basis">{lede}</p>
      <ol className="red-lines">
        {redLines.map((r) => (
          <li key={r.id} className="red-line" data-testid="red-line-checked" data-red-line={r.id}>
            <span className="red-line-name"><span className="flag-no">{r.number}</span> {r.name}</span>
            {r.catches ? <span className="red-line-catches">{r.catches}</span> : null}
            {r.basis ? (
              <span className="basis red-line-basis" data-testid="red-line-basis">
                <span className="basis-label">{COPY.redLines.basisLabel}</span>
                <strong data-testid="red-line-basis-label">{r.basis.label}.</strong> {r.basis.note}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

// One Severity group, in document order.
function Group({ severity, kind, flags, closed, toggle, lede = null, empty = COPY.flags.emptyGroup }) {
  const items = flags.filter((f) => f.severity === severity);
  return (
    <div className={`group sev-${kind}`} data-testid={`group-${severity}`}>
      <h3 className="group-title">
        <Glyph kind={kind} />
        {SEVERITY_LABELS[kind]} <span className="count">{items.length}</span>
      </h3>
      {lede && items.length > 0 ? <p className="group-empty">{lede}</p> : null}
      {items.length > 0 ? (
        <ul className="flags">
          {items.map((f) => (
            <FlagItem key={f.number} flag={f} kind={kind} isOpen={!closed.has(f.number)} onToggle={() => toggle(f.number)} />
          ))}
        </ul>
      ) : (
        <p className="group-empty">{empty}</p>
      )}
    </div>
  );
}

// A Clean result, as the server decided it: the plain statement, every Red line checked, then any Know
// this flags beneath (ADR 0006). The browser never works out whether a review is a Clean result.
function CleanResult({ review, flags, closed, toggle, outside }) {
  return (
    <div className="clean-result" data-testid="clean-result">
      <div className="clean-statement">
        <h3 className="group-title">{COPY.clean.title}</h3>
        <p className="flags-message" data-testid="clean-statement">{COPY.clean.statement}</p>
      </div>
      <RedLinesChecked redLines={review.redLinesChecked ?? []} lede={COPY.clean.checkedLede} empty={COPY.clean.noRedLines} />
      <Group
        severity="know-this"
        kind="know"
        flags={flags}
        closed={closed}
        toggle={toggle}
        lede={COPY.clean.knowThisLede}
        empty={COPY.clean.noKnowThis}
      />
      {(review.outsideReferences ?? []).length > 0 ? (
        <p className="flags-message" data-testid="clean-outside-note">{COPY.clean.outsideReviewed}</p>
      ) : null}
      {outside}
    </div>
  );
}

// above: shown under the pane heading, before the flags (the Owner line, ticket 22).
// documentId and onReview: set when the review is saved, so the Reviewer can mark Outside references
// as reviewed; onReview takes the review the server sends back.
export default function RiskFlags({ review, above = null, documentId = null, onReview = null }) {
  const flags = review.riskFlags ?? [];
  const references = review.outsideReferences ?? [];
  // Every flag starts open, so each Source sentence is on screen without a click.
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (n) =>
    setClosed((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const unreadable = review.riskFlagsStatus !== "checked";
  // Strictly true: anything else, including a missing value, is not a Clean result.
  const clean = !unreadable && review.cleanResult === true;
  // The Outside reference group, numbered after the flags so every number in the pane is unique.
  const outside = (
    <OutsideReferences references={references} firstNumber={flags.length + 1} documentId={documentId} onReview={onReview} />
  );
  const marks = [...flags, ...references].flatMap((f) => [f.title, f.says, f.judgment].flatMap((p) => p?.marked ?? []));
  const anyMarked = marks.some((m) => !isNumberMark(m));
  const anyNumber = marks.some(isNumberMark);
  // Counter-offer marks get their own notes: a changed figure there can be a legitimate tightening.
  const counterMarks = flags.flatMap((f) => f.counterOffer?.marked ?? []);
  const anyCounterOffer = flags.some((f) => f.counterOffer);

  return (
    <section className="pane flags-pane" aria-labelledby="flags-title" data-testid="risk-flags">
      <div className="pane-head">
        <h2 className="pane-title" id="flags-title">{COPY.flags.title}</h2>
        {!unreadable && <p className="pane-status">{COPY.flags.status(flags.length + references.length)}</p>}
      </div>
      {above}

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
            <ul className="key-group key-group-other">
              <li className="key-item sev-outside">
                <Glyph kind="outside" />
                <span>{COPY.outside.keyLabel}</span>
              </li>
            </ul>
            <ul className="key-group">
              <li className="key-item key-tick">
                <Tick />
                <span>{COPY.flags.foundKey}</span>
              </li>
            </ul>
          </div>

          <p className="severity-note" data-testid="severity-note">{COPY.flags.severityNote}</p>

          <Withheld count={review.withheldCount ?? 0} withheld={review.withheld ?? []} />

          {!clean && review.cleanResultHeld === true ? (
            <p className="flags-message" data-testid="clean-result-held">{COPY.clean.held}</p>
          ) : null}

          {clean ? (
            <CleanResult review={review} flags={flags} closed={closed} toggle={toggle} outside={outside} />
          ) : flags.length === 0 && references.length === 0 && review.withheldCount === 0 ? (
            <p className="flags-message" data-testid="no-flags">{COPY.flags.none}</p>
          ) : (
            <>
              {GROUPS.map(({ severity, kind }) => (
                <Group key={severity} severity={severity} kind={kind} flags={flags} closed={closed} toggle={toggle} />
              ))}
              {outside}
            </>
          )}

          {anyMarked && <p className="marked-note flags-note" data-testid="flags-marked-note">{COPY.markedNote}</p>}
          {anyNumber && <p className="marked-note flags-note" data-testid="flags-number-note">{COPY.numberNote}</p>}
          {anyCounterOffer && <p className="marked-note flags-note" data-testid="counter-offer-note">{COPY.counterOffer.note}</p>}
          {counterMarks.some((m) => !isNumberMark(m)) && (
            <p className="marked-note flags-note" data-testid="counter-offer-marked-note">{COPY.counterOffer.markedNote}</p>
          )}
          {counterMarks.some(isNumberMark) && (
            <p className="marked-note flags-note" data-testid="counter-offer-number-note">{COPY.counterOffer.numberNote}</p>
          )}

          {clean ? null : <RedLinesChecked redLines={review.redLinesChecked ?? []} />}
        </>
      )}
    </section>
  );
}
