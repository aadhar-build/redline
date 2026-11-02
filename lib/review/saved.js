import { hasClauses } from "./has-clauses.js";
import "server-only";

import { ambiguousClausesOf, charactersUsedBy, checkFlagText, cleanResultOf, inGroups, ownText, partyTermIn, SEVERITIES, shownSeverity } from "./review.js";
import { gateCleanResult } from "./clean-result-gate.js";
import { checkSources } from "./source-check.js";
import { NOT_CITABLE, toStoredOutsideReferences } from "./outside-references.js";
import { checkCounterOffer } from "./counter-offer.js";
import { readScannedPages, scannedNote } from "./scanned-pages.js";
import { citesUnreadableAmount, readOcrRanges, UNREADABLE_AMOUNT } from "./unreadable-amount.js";
import { documentNumbers, looksLikeTemplate } from "./wording.js";
import { normalise } from "./normalise.js";
import { outsideReferencesFor, referencedDocumentOf, reviewTexts, textForId } from "./referenced.js";

// A saved review (ticket 10): how a review is written to the reviews table and how it is opened again.
//
// Opening a saved review never calls the model: reopenReview takes no adapter, so it cannot re-analyse
// (OQ17). It does re-run the Source sentence check on every stored sentence against the stored
// document text before anything is shown (CLAUDE.md trust rules): a stored row is not proof either.
//
// What is stored: the summary text, each shown flag with the exact text of its Source sentences (and,
// for an Ambiguous clause, the text of each reading), the
// withheld count and each withheld flag's reason code only ({"reason": code}, never model text; the
// database checks this). Offsets, marked words and judgment labels are worked out again from the
// stored text on reopen, with the same code Review uses, so a reopened review reads like a fresh one.
//
// Only a complete review is saved: one whose summary was shown and whose Risk flags list was read
// (settled by Fable advisor, 2026-10-31). Withheld flags never make a review incomplete. Otherwise
// there is nothing honest to reopen, because "no flags" and "unreadable flags" would look the same.

// QUESTIONS.md 37: a flag on an earlier review that came from a document the Reviewer later removed.
export const REFERENCED_DOCUMENT_REMOVED = "referenced-document-removed";

// The database allows the same codes (migrations 20261031000200, 20261031002200, 20261031002300 and
// 20261031003700).
export const WITHHELD_REASONS = Object.freeze(["source-not-found", "no-source", "unreadable", "unsupported-number", UNREADABLE_AMOUNT, REFERENCED_DOCUMENT_REMOVED]);

export function isSavable(review) {
  return review?.summary?.status === "shown" && review?.riskFlagsStatus === "checked";
}

const keptWithheld = (withheld) => withheld.filter((w) => w.reason !== NOT_CITABLE);

/** The columns of a reviews row for a complete review. */
export function toStoredReview(review) {
  if (!isSavable(review)) throw new Error("only a complete review is saved");
  return {
    red_lines: review.redLinesChecked ?? [],
    summary: review.summary.text,
    flags: review.riskFlags.map((f) => ({
      severity: f.severity,
      title: f.title.text,
      says: f.says.text,
      judgment: f.judgment ? f.judgment.text : null,
      source_sentences: f.sourceSentences.map((s) => s.text),
      // Only the id: the match is rebuilt on reopen from the stored Red line list, never from model text.
      red_line: f.redLineMatch ? f.redLineMatch.id : null,
      // The wording only; its marks are worked out again on reopen (tickets 08 and 17).
      counter_offer: f.counterOffer ? f.counterOffer.text : null,
      // Ticket 08b: the term the document lacks, shown as Redline's judgment; null when there is none.
      counter_offer_note: f.counterOffer?.newTermNote ? f.counterOffer.newTermNote.text : null,
      // An Ambiguous clause's readings, as text only, in order; null for an ordinary flag (ticket 07).
      readings: f.readings ? f.readings.map((r) => r.text) : null,
      // Ticket 18: the referenced document its Source sentences come from, or null for the document.
      referenced_document_id: f.referencedDocument?.id ?? null,
    })),
    // Ticket 18: the referenced documents this review was run together with.
    referenced_document_ids: (review.referencedDocuments ?? []).map((d) => d.id),
    // Reason codes only, so no model text is ever stored with a withheld flag. An Outside reference
    // Redline's patterns found but could not cite is left out: reopening finds it again and counts it.
    withheld: keptWithheld(review.withheld).map((w) => ({ reason: WITHHELD_REASONS.includes(w.reason) ? w.reason : "unreadable" })),
    withheld_count: keptWithheld(review.withheld).length,
    // Ticket 13: each Outside reference's kinds, its Source sentence's text and the Reviewer's mark.
    // Redline's wording and Counter-offer are rebuilt from the kinds on reopen, so no prose is stored.
    outside_references: toStoredOutsideReferences(review.outsideReferences),
    // Ticket 24 ruling 23(b): whose side the review was for, and how many judgments were dropped.
    owner_party: review.ownerParty?.term ?? null,
    owner_fixed: review.ownerParty?.fixed === true,
    judgments_dropped: Number.isInteger(review.judgmentsDropped) && review.judgmentsDropped > 0 ? review.judgmentsDropped : 0,
    // Ticket 24 part 2 (settled by Fable advisor, 2026-10-31): the party terms the review showed.
    parties: (Array.isArray(review.parties) ? review.parties : []).filter((p) => typeof p === "string" && p.trim() !== ""),
  };
}

// The stored party terms (ticket 24 part 2): only those the stored text still uses, by the same rule as a
// fresh review, each once, with the Owner first when it is missing. A row saved before they were stored
// has [] and reopens with the Owner alone.
function storedParties(stored, documentText, owner) {
  const doc = normalise(String(documentText ?? "")).toLowerCase();
  const seen = new Set();
  const parties = [];
  for (const p of Array.isArray(stored?.parties) ? stored.parties : []) {
    const term = partyTermIn(p, doc);
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      parties.push(term);
    }
  }
  if (owner && !seen.has(owner.term.toLowerCase())) parties.unshift(owner.term);
  return parties;
}

// The stored Owner, kept only when the stored text still names it (ticket 24 ruling 23(b)).
function storedOwner(stored, documentText) {
  const term = text(stored?.owner_party);
  if (!term || !String(documentText ?? "").toLowerCase().includes(term.toLowerCase())) return null;
  return { term, fixed: stored?.owner_fixed === true };
}

const storedDropped = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

const text = (v) => (typeof v === "string" ? v.trim() : "");

// The Red line a stored flag matched, looked up in the list the review was checked against.
function redLineMatchFor(id, redLines) {
  if (typeof id !== "string") return null;
  const line = redLines.find((r) => r && r.id === id);
  return line ? { id: line.id, number: line.number, name: line.name } : null;
}

/**
 * Rebuilds the review shape the interface shows from a stored reviews row and the stored document text.
 * ocrRanges are the document's stored OCR ranges: the unreadable-amount rule is applied again too.
 * @param {{ documentText: string, stored: { summary: string, flags: object[], withheld_count: number, withheld: { reason: string }[], red_lines: unknown[] }, ocrRanges?: [number, number][] }} input
 */
// Ticket 18: the referenced documents a stored review was run with, as given by the caller (rows read
// back under Row Level Security). Only those whose id the review lists are used, in the review's order.
// One that is listed but not given (another account's, or deleted) is left out, so the flags citing it
// are withheld and the reference it was added against is not resolved.
export function referencedFor(stored, referencedDocuments) {
  const ids = Array.isArray(stored?.referenced_document_ids) ? stored.referenced_document_ids : [];
  const given = Array.isArray(referencedDocuments) ? referencedDocuments : [];
  return ids.map((id) => given.find((d) => d && d.id === id)).filter((d) => d && typeof d.text === "string" && d.text.length > 0);
}

export function reopenReview({ documentText, stored, ocrRanges = [], ocrPages = [], pageCount = null, referencedDocuments = [] }) {
  // The same ticket 22 checks as a fresh review: numbers the document lacks, dropped judgments, and
  // the template note, all worked out again from the stored text.
  const numbers = documentNumbers(documentText);
  const summaryText = text(stored?.summary);
  const summary = summaryText
    ? { status: "shown", text: summaryText, marked: ownText(summaryText, documentText, { numbers }).marked }
    : { status: "withheld", reason: "unreadable-output" };

  const storedRedLines = Array.isArray(stored?.red_lines) ? stored.red_lines : [];
  const shown = [];
  const failedNow = [];
  let judgmentsDropped = 0;
  // Ranges that do not fit the stored text mark all of it as OCR text, erring toward withholding.
  const storedPages = readScannedPages(ocrPages, pageCount);
  const ocr = readOcrRanges(ocrRanges, String(documentText ?? "").length) ?? [[0, String(documentText ?? "").length]];
  const texts = reviewTexts(documentText, ocr, referencedFor(stored, referencedDocuments));
  // Ticket 18: as in a fresh review, the summary covers the referenced texts too.
  if (texts.length > 1 && summary.status === "shown") {
    const allText = texts.map((t) => t.text).join("\n\n");
    summary.marked = ownText(summaryText, allText, { numbers: documentNumbers(allText) }).marked;
  }
  const listedIds = Array.isArray(stored?.referenced_document_ids) ? stored.referenced_document_ids : [];
  for (const f of Array.isArray(stored?.flags) ? stored.flags : []) {
    // Ticket 18: checked against the text it cites, the document or one referenced document.
    const cited = textForId(texts, f?.referenced_document_id ?? null);
    // QUESTIONS.md 37: the review lists the document, but it is no longer there: the Reviewer removed it.
    if (!cited && typeof f?.referenced_document_id === "string" && listedIds.includes(f.referenced_document_id)) {
      failedNow.push({ reason: REFERENCED_DOCUMENT_REMOVED });
      continue;
    }
    const checked = cited && SEVERITIES.includes(f?.severity) && text(f.title) && text(f.says)
      ? checkSources(cited.text, Array.isArray(f.source_sentences) ? f.source_sentences : [])
      : { found: false };
    if (!checked.found) {
      failedNow.push({ reason: "source-not-found" });
      continue;
    }
    if (citesUnreadableAmount(cited.text, checked.sources, cited.ocr)) {
      failedNow.push({ reason: UNREADABLE_AMOUNT });
      continue;
    }
    // A row saved before ticket 07 has no readings and reopens as an ordinary flag.
    const own = checkFlagText({ title: f.title, says: f.says, judgment: f.judgment, readings: f.readings ?? null }, cited.text, cited.numbers);
    if (own.withheld) {
      failedNow.push({ reason: own.withheld });
      continue;
    }
    if (own.judgmentDropped) judgmentsDropped += 1;
    const redLineMatch = redLineMatchFor(f.red_line, storedRedLines);
    shown.push({
      // The same Severity rules as a fresh review, applied again to what is shown.
      severity: shownSeverity(f.severity, { redLineMatch, readings: own.readings }),
      title: own.title,
      says: own.says,
      judgment: own.judgment,
      readings: own.readings,
      sourceSentences: checked.sources,
      redLineMatch,
      // A row saved before Counter-offers existed has none, and reopens with null.
      counterOffer: checkCounterOffer(f.counter_offer, cited.numbers, { documentText: cited.text, needsNewTerm: f.counter_offer_note != null, newTermNote: f.counter_offer_note ?? null }),
      referencedDocument: referencedDocumentOf(cited),
    });
  }

  const storedWithheld = (Array.isArray(stored?.withheld) ? stored.withheld : []).map((w) => ({
    reason: WITHHELD_REASONS.includes(w?.reason) ? w.reason : "unreadable",
  }));
  // Ticket 13: Outside references are found again in each stored text with the same patterns, so a row
  // saved before they were stored still shows them, and a stored one the patterns no longer find is
  // checked like a flag. The Reviewer's "reviewed" marks are carried over by key, within the text the
  // reference sits in (QUESTIONS.md 36); a mark on a document no longer given is dropped.
  const owner = storedOwner(stored, documentText);
  const parties = storedParties(stored, documentText, owner);
  // A reference the patterns find but cannot cite is not in the stored withheld list (toStoredReview
  // leaves it out, because it is found again here), so it is counted once.
  // QUESTIONS.md 31, applied again on reopen, so a row saved before the merge shows the sentence once.
  const refs = outsideReferencesFor({
    texts,
    redLines: storedRedLines,
    flags: shown,
    stored: Array.isArray(stored?.outside_references) ? stored.outside_references : [],
    own: (t) => (x, opts) => ownText(x, t, opts),
    parties,
  });
  const withheld = [...storedWithheld, ...failedNow, ...refs.withheld];
  const riskFlags = inGroups(refs.flags);
  const reopened = {
    summary,
    template: looksLikeTemplate(documentText),
    // QUESTIONS 18: from the document's stored page list; a list that does not read marks it unknown.
    scanned: storedPages ? scannedNote(storedPages, ocr) : { pages: null, pageCount: null },
    // Stored since ticket 24 (ruling 23(b)); a row saved before then reopens with no Owner. The parties
    // are stored since ticket 24 part 2; a row saved before then lists only the stored Owner.
    ownerParty: owner,
    parties,
    // The count stored with the review plus any dropped again on reopen.
    judgmentsDropped: storedDropped(stored?.judgments_dropped) + judgmentsDropped,
    riskFlagsStatus: "checked",
    riskFlags,
    outsideReferences: refs.outsideReferences,
    referencedDocuments: texts.slice(1).map((t) => ({ id: t.id, title: t.title })),
    charactersUsed: charactersUsedBy(texts),
    mergedCount: refs.mergedCount,
    ambiguousClauses: ambiguousClausesOf(riskFlags),
    // A stored flag that fails the check on reopen is withheld as source-not-found.
    withheld,
    withheldCount: withheld.length,
    hasClauses: hasClauses(documentText),
    cleanResult: null,
    cleanResultHeld: false,
    redLinesChecked: Array.isArray(stored?.red_lines) ? stored.red_lines : [],
  };
  // Worked out again with the same rule Review uses, from what reopening shows: a stored flag that now
  // fails the Source sentence check is withheld, so it blocks a Clean result here too.
  Object.assign(reopened, gateCleanResult(cleanResultOf(reopened)));
  return reopened;
}
