// Copy all as text (ticket 20): the whole review as plain text, built from the same review object and
// the same COPY strings the screen uses, in the order the screen shows them. It copies only what is
// displayed: the key, the question box and the controls are left out, and nothing the screen doesn't
// show is added, except the one line explaining the square brackets.
//
// Marked words and numbers (the hedge-word and verdict-word ban, and numbers the contract doesn't
// contain) are highlighted on screen. Plain text has no highlight, so each marked span is wrapped in
// [square brackets], and the bracket line says so. Source sentences are never marked; they are copied
// exactly as stored.

import { SEVERITY_LABELS } from "../../severity-labels";
import { formatSavedAt } from "../library/format";
import { COPY } from "./copy";

const GROUPS = [
  { severity: "dont-sign-as-written", kind: "dont" },
  { severity: "negotiate", kind: "negotiate" },
  { severity: "know-this", kind: "know" },
];
const KIND = { "dont-sign-as-written": "dont", negotiate: "negotiate", "know-this": "know" };
const isNumberMark = (m) => m.kind === "number";

// Same span rules as MarkedText: overlapping or out-of-range spans are skipped, not bracketed.
export function bracketMarks(text, marked = []) {
  let out = "";
  let at = 0;
  for (const { start, end } of marked) {
    if (start < at || end > text.length) continue;
    out += `${text.slice(at, start)}[${text.slice(start, end)}]`;
    at = end;
  }
  return out + text.slice(at);
}

const own = (part) => bracketMarks(part.text, part.marked ?? []);

function withheldLine(review) {
  const count = review.withheldCount ?? 0;
  if (count === 0) return null;
  const withheld = review.withheld ?? [];
  const by = (reason) => withheld.filter((w) => w.reason === reason).length;
  const reasons = ["source-not-found", "unsupported-number", "no-source", "unreadable", "reference-not-citable"].filter((r) => by(r) > 0);
  return `${COPY.flags.withheldTitle(count)} ${reasons.map((r) => COPY.flags.withheldReason[r](by(r), count)).join(" ")} ${COPY.flags.withheldTail}`;
}

function sources(sentences) {
  const total = sentences.length;
  return sentences.flatMap((s, i) => [total === 1 ? COPY.flags.sourceCaption : COPY.flags.sourceCaptionOf(i + 1, total), `"${s.text}"`]);
}

function counterOffer(c) {
  if (!c) return [COPY.counterOffer.missing];
  return [COPY.counterOffer.caption, bracketMarks(c.text, c.marked ?? [])];
}

function flagBlock(flag, kind) {
  const j = COPY.flags.judgmentLabel;
  const lines = [`${flag.number}. ${SEVERITY_LABELS[kind]}: ${own(flag.title)}${flag.title.isJudgment ? ` (${j})` : ""}`];
  lines.push(flag.says.isJudgment ? `${j}: ${own(flag.says)}` : own(flag.says));
  if (flag.redLineMatch) lines.push(`${COPY.flags.redLineMatchLabel}: ${COPY.flags.redLineMatched(flag.redLineMatch.number, flag.redLineMatch.name)}`);
  if (flag.judgment) lines.push(`${j}: ${own(flag.judgment)}`);
  if (flag.readings) {
    lines.push(`${COPY.ambiguous.label}: ${COPY.ambiguous.lede}`);
    flag.readings.forEach((r, i) => lines.push(`${COPY.ambiguous.readingCaption(i + 1, flag.readings.length)}: ${own(r)}`));
  }
  if (flag.referencedDocument) lines.push(COPY.outside.fromReferenced(flag.referencedDocument.title));
  lines.push(...sources(flag.sourceSentences), ...counterOffer(flag.counterOffer));
  return lines.join("\n");
}

function group(flags, severity, kind, { lede = null, empty = COPY.flags.emptyGroup } = {}) {
  const items = flags.filter((f) => f.severity === severity);
  const head = `${SEVERITY_LABELS[kind]} (${items.length})`;
  if (items.length === 0) return [`${head}\n${empty}`];
  return [lede ? `${head}\n${lede}` : head, ...items.map((f) => flagBlock(f, kind))];
}

function referenceBlock(r, number) {
  const c = COPY.outside;
  const kind = KIND[r.severity] ?? "negotiate";
  const reviewed = r.reviewed !== null && r.reviewed !== undefined;
  const tag = r.referencedDocument ? c.addedTag : reviewed ? c.reviewedTag : c.notReviewedTag;
  const lines = [`${number}. ${SEVERITY_LABELS[kind]}: ${own(r.title)} (${tag})`, own(r.says)];
  if (r.redLineMatch) lines.push(`${COPY.flags.redLineMatchLabel}: ${COPY.flags.redLineMatched(r.redLineMatch.number, r.redLineMatch.name)}`);
  if (r.judgment) lines.push(`${COPY.flags.judgmentLabel}: ${own(r.judgment)}`);
  lines.push(...sources(r.sourceSentences.slice(0, 1)), ...counterOffer(r.counterOffer ?? null));
  if (r.referencedDocument) lines.push(c.added(r.referencedDocument.title));
  else lines.push(reviewed ? `${c.statementLabel}: ${c.statement(formatSavedAt(r.reviewed.at))}` : c.notReviewed);
  if (r.redLineMatch) lines.push(c.stillBlocks);
  return lines.join("\n");
}

function outsideSection(references, firstNumber, inReferenced = []) {
  const blocks = [];
  if (references.length > 0) {
    blocks.push(`${COPY.outside.title} (${references.length})\n${COPY.outside.lede}`, ...references.map((r, i) => referenceBlock(r, firstNumber + i)));
  }
  // Ticket 18: sentences in an added document that bring in yet another document.
  if (inReferenced.length > 0) {
    blocks.push(
      `${COPY.outside.inReferencedTitle} (${inReferenced.length})\n${COPY.outside.inReferencedLede}`,
      ...inReferenced.map((r) => [COPY.outside.fromReferenced(r.referencedDocument?.title), ...sources(r.sourceSentences.slice(0, 1))].join("\n")),
    );
  }
  return blocks;
}

function redLinesSection(redLines, { lede = COPY.redLines.lede, empty = null } = {}) {
  if (redLines.length === 0) return empty ? [`${COPY.redLines.title}\n${empty}`] : [];
  const items = redLines.map((r) => {
    let line = `${r.number}. ${r.name}`;
    if (r.catches) line += `\n${r.catches}`;
    if (r.basis) line += `\n${COPY.redLines.basisLabel}: ${r.basis.label}. ${r.basis.note}`;
    return line;
  });
  return [`${COPY.redLines.title}\n${lede}`, ...items];
}

function ownerLine(review) {
  if (review.ownerParty) return `${COPY.owner.label} ${review.ownerParty.term}`;
  // On screen the unknown line shows only when Change is offered, which is right after a review.
  return null;
}

function anyMarks(parts) {
  return parts.flatMap((p) => p?.marked ?? []);
}

/**
 * The review as plain text, in screen order.
 * @param {object} review the review as ReviewResult shows it
 * @param {{ ownerUnknownShown?: boolean }} [options] ownerUnknownShown: the "couldn't tell which party"
 * line is on screen (only right after a review, when the Reviewer can change the Owner).
 */
export function reviewAsText(review, { ownerUnknownShown = false } = {}) {
  const blocks = [];
  const summaryMarks = review.summary.marked ?? [];
  const flags = review.riskFlags ?? [];
  const references = review.outsideReferences ?? [];
  const unreadable = review.riskFlagsStatus !== "checked";
  const flagMarks = anyMarks([...flags, ...references].flatMap((f) => [f.title, f.says, f.judgment, ...(f.readings ?? [])]));
  const counterMarks = flags.flatMap((f) => f.counterOffer?.marked ?? []);
  const shownMarks = [...summaryMarks, ...(unreadable ? [] : [...flagMarks, ...counterMarks])];
  if (shownMarks.length > 0) blocks.push(COPY.copyAll.bracketKey);

  // The summary pane.
  const summary = [COPY.summaryCaption];
  if (review.scanned) summary.push(COPY.scannedNote(review.scanned));
  if (review.template) summary.push(COPY.templateNote);
  summary.push(bracketMarks(review.summary.text, summaryMarks));
  if (summaryMarks.some((m) => !isNumberMark(m))) summary.push(COPY.markedNote);
  if (summaryMarks.some(isNumberMark)) summary.push(COPY.numberNote);
  summary.push(COPY.summaryNote);
  blocks.push(summary.join("\n"));

  // The Risk flags pane.
  const head = [COPY.flags.title];
  if (!unreadable) head.push(COPY.flags.status(flags.length + references.length));
  const owner = ownerLine(review) ?? (ownerUnknownShown ? COPY.owner.unknown : null);
  if (owner) head.push(owner);
  if (unreadable) {
    head.push(COPY.flags.unreadable);
    blocks.push(head.join("\n"));
    return blocks.join("\n\n") + "\n";
  }
  head.push(COPY.flags.severityNote);
  const withheld = withheldLine(review);
  if (withheld) head.push(withheld);
  blocks.push(head.join("\n"));

  const clean = review.cleanResult === true;
  const outside = outsideSection(references, flags.length + 1, review.referencedOutsideReferences ?? []);
  if (clean) {
    blocks.push(`${COPY.clean.title}\n${COPY.clean.statement}`);
    blocks.push(...redLinesSection(review.redLinesChecked ?? [], { lede: COPY.clean.checkedLede, empty: COPY.clean.noRedLines }));
    blocks.push(...group(flags, "know-this", "know", { lede: COPY.clean.knowThisLede, empty: COPY.clean.noKnowThis }));
    if (references.length > 0) blocks.push(COPY.clean.outsideNote(references));
    blocks.push(...outside);
  } else if (flags.length === 0 && references.length === 0 && review.withheldCount === 0) {
    blocks.push(COPY.flags.none);
  } else {
    for (const { severity, kind } of GROUPS) blocks.push(...group(flags, severity, kind));
    blocks.push(...outside);
  }

  const notes = [];
  if (flagMarks.some((m) => !isNumberMark(m))) notes.push(COPY.markedNote);
  if (flagMarks.some(isNumberMark)) notes.push(COPY.numberNote);
  if (flags.some((f) => f.counterOffer)) notes.push(COPY.counterOffer.note);
  if (counterMarks.some((m) => !isNumberMark(m))) notes.push(COPY.counterOffer.markedNote);
  if (counterMarks.some(isNumberMark)) notes.push(COPY.counterOffer.numberNote);
  if (notes.length > 0) blocks.push(notes.join("\n"));

  if (!clean) blocks.push(...redLinesSection(review.redLinesChecked ?? []));
  return blocks.join("\n\n") + "\n";
}
