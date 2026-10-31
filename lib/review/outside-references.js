// Outside references (ticket 13, ADR 0007, CONTEXT.md): sentences that bring in terms from a document
// that was not uploaded.
//
// Redline's own code finds them, with patterns over the stored text, so every one has a real Source
// sentence: the whole sentence around the match, cut on the same boundaries the Source sentence check
// uses (sentenceAt in source-check.js), and then put through that check like any flag. The kinds:
// - "web-address": a web address (with http(s)://, www., or a bare domain with a common ending; never
//   an email address);
// - "statement-of-work": a Statement of Work (or "SOW");
// - "order-form": an Order Form;
// - "schedule": a Schedule, Annexure, Annex, Exhibit or Appendix named by a number or letter, when no
//   heading line in the text names it (so it was not uploaded);
// - "as-amended": terms "as amended from time to time", matched exactly (other wordings are an open
//   question in QUESTIONS.md).
// A mention preceded by "this" ("this Statement of Work") is the document naming itself, not a reference.
// "other" is kept for a reference the model adds that none of these patterns names.
//
// One reference per sentence, whatever kinds it has. Severity (spec-gaps 12 and 13): Negotiate, except
// that an "as amended" reference matches Default Red line 3 and is Don't sign as written, when that Red
// line is in the list Review was given. The Reviewer can mark a reference as reviewed: that is stored as
// the Reviewer's statement (with when they made it), never as something Redline checked. A reference is
// resolved only when it is marked reviewed and is not a Red line match, so an "as amended" reference
// never stops blocking a Clean result.
//
// Every string here is copy the Reviewer reads: run it through the humanizer skill before commit
// (CLAUDE.md). Text and code only, with no server imports.

import { normalise } from "./normalise.js";
import { checkSources, sentenceAt, sourceChecker } from "./source-check.js";

export const OUTSIDE_REFERENCE_KINDS = Object.freeze(["as-amended", "web-address", "statement-of-work", "order-form", "schedule", "other"]);

// The withheld reason for a reference the patterns found but could not cite. Never stored.
export const NOT_CITABLE = "reference-not-citable";

// Default Red line 3 (lib/review/red-lines.js). spec-gaps 12: "as amended from time to time" matches it.
export const ONE_SIDED_CHANGES_ID = "default-one-sided-changes";

// A few characters of text before a match, to spot "this Statement of Work".
const SELF = /\bthis\s+$/i;

// With a scheme or "www.", any case. A bare domain only in lower case, with a letter in each part, so
// "time.In" (a missing space in extracted text) or "4.in" is not read as one.
const WEB = /\b(?:https?:\/\/|www\.)[^\s<>"'()]+/gi;
const BARE_DOMAIN =
  /(?<![@\w.\-/])(?:[a-z0-9-]{1,63}\.)+(?:com|in|org|net|io|co|gov|biz|info|uk|us)(?:\/[^\s<>"'()]*)?(?![\w@-])/g;
const SOW = /\bstatements?\s+of\s+work\b/gi;
const SOW_SHORT = /\bSOWs?\b/g;
const ORDER_FORM = /\border\s+forms?\b/gi;
const SCHEDULE =
  /\b([Ss]chedule|SCHEDULE|[Aa]nnexure|ANNEXURE|[Aa]nnex|ANNEX|[Ee]xhibit|EXHIBIT|[Aa]ppendix|APPENDIX)\s+(\d{1,3}|[A-Z]{1,2}|[IVXLC]{1,6})(?![\p{L}\p{N}])/gu;
const AS_AMENDED = /\bas\s+amended\s+from\s+time\s+to\s+time\b/gi;

// Each label of a bare domain needs a letter ("4.in" is not one). Checked in code, not in the pattern,
// so the pattern has no ambiguous repetition (no catastrophic backtracking).
const labelsHaveLetters = (domain) => domain.split("/")[0].split(".").every((l) => /[a-z]/.test(l));

// At most this many pattern matches are worked through per document. Any beyond it are counted as
// failed, so they are withheld and block a Clean result rather than being dropped (fail closed).
export const MAX_REFERENCE_MATCHES = 300;

const capitalise = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

// Is the schedule named `word label` in the text? Yes when some line starts with that name and reads as
// a heading: nothing else on it, or a title after a dash, colon, full stop or bracket, or a capitalised
// title, with no comma and no sentence ending. Errs toward "not present", so toward flagging (ADR 0005).
function schedulePresent(stored, word, label, cache) {
  const key = `${word.toLowerCase()} ${label}`;
  if (cache?.has(key)) return cache.get(key);
  const result = schedulePresentUncached(cache?.lines ?? stored.split("\n"), word, label);
  cache?.set(key, result);
  return result;
}

function schedulePresentUncached(lines, word, label) {
  const name = `${word}\\s+${label}`;
  const heading = new RegExp(`^[^\\S\\n]*${name}[^\\S\\n]*(?:$|[-–—:.)][^\\S\\n]*[^\\n,]{0,80}$|[^\\S\\n]+\\p{Lu}[^\\n,]{0,80}$)`, "imu");
  return lines.some((line) => heading.test(line) && !/[.;,]\s*$/.test(line.replace(new RegExp(`^\\s*${name}\\.?`, "i"), "")));
}

const trimUrl = (u) => u.replace(/[.,;:!?\]]+$/, "");

// Every match of every pattern in the stored text, as { kind, label, from, to }.
function matches(stored) {
  const found = [];
  const add = (kind, label, m) => {
    if (SELF.test(stored.slice(Math.max(0, m.index - 8), m.index))) return;
    found.push({ kind, label, from: m.index, to: m.index + m[0].length });
  };
  for (const m of stored.matchAll(AS_AMENDED)) add("as-amended", null, m);
  for (const m of stored.matchAll(WEB)) add("web-address", trimUrl(m[0]), m);
  for (const m of stored.matchAll(BARE_DOMAIN)) {
    if (!labelsHaveLetters(m[0])) continue;
    // Already part of an address found above ("www.example.com").
    if (found.some((f) => f.kind === "web-address" && m.index >= f.from && m.index < f.to)) continue;
    add("web-address", trimUrl(m[0]), m);
  }
  for (const m of stored.matchAll(SOW)) add("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(SOW_SHORT)) add("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(ORDER_FORM)) add("order-form", "Order Form", m);
  const cache = new Map();
  cache.lines = stored.split("\n");
  for (const m of stored.matchAll(SCHEDULE)) {
    if (schedulePresent(stored, m[1], m[2], cache)) continue;
    add("schedule", `${capitalise(m[1])} ${m[2]}`, m);
  }
  return found;
}

const byKind = (a, b) => OUTSIDE_REFERENCE_KINDS.indexOf(a) - OUTSIDE_REFERENCE_KINDS.indexOf(b);

/**
 * The Outside references Redline's patterns find in the stored text, one per sentence, in document order.
 * failed counts matches whose sentence could not be cut or did not pass the Source sentence check: the
 * caller withholds them (so they block a Clean result), never drops them silently.
 * @returns {{ found: { kinds: string[], labels: string[], sourceSentences: { text: string, start: number, end: number }[] }[], failed: number }}
 */
export function findOutsideReferences(documentText) {
  const stored = String(documentText ?? "").normalize("NFC");
  const bySentence = new Map();
  const check = sourceChecker(documentText);
  const checkedBySentence = new Map();
  const all = matches(stored).sort((a, b) => a.from - b.from);
  // Over the cap: counted as failed, so withheld and blocking a Clean result (fail closed).
  let failed = Math.max(0, all.length - MAX_REFERENCE_MATCHES);
  for (const m of all.slice(0, MAX_REFERENCE_MATCHES)) {
    const sentence = sentenceAt(stored, m.from, m.to);
    let checked = { found: false };
    if (sentence) {
      const k = `${sentence.start}:${sentence.end}:${sentence.text}`;
      if (!checkedBySentence.has(k)) checkedBySentence.set(k, check([sentence.text]));
      checked = checkedBySentence.get(k);
    }
    if (!checked.found) {
      failed += 1;
      continue;
    }
    const source = checked.sources[0];
    const key = `${source.start}:${source.end}`;
    const entry = bySentence.get(key) ?? { kinds: [], labels: [], sourceSentences: [source] };
    if (!entry.kinds.includes(m.kind)) entry.kinds.push(m.kind);
    if (m.label && !entry.labels.includes(m.label)) entry.labels.push(m.label);
    bySentence.set(key, entry);
  }
  const found = [...bySentence.values()]
    .map((e) => ({ ...e, kinds: e.kinds.sort(byKind) }))
    .sort((a, b) => a.sourceSentences[0].start - b.sourceSentences[0].start);
  return { found, failed };
}

/** The kinds Redline's patterns name in one sentence, or ["other"]. */
export function kindsIn(sentence) {
  const kinds = [...new Set(matches(String(sentence).normalize("NFC")).map((m) => m.kind))].sort(byKind);
  return kinds.length > 0 ? kinds : ["other"];
}

// Redline's own wording for each reference. Fixed text, so it never carries model prose.
function labelFor(kind, labels, sentence) {
  const own = matches(String(sentence).normalize("NFC")).filter((m) => m.kind === kind && m.label);
  return own[0]?.label ?? labels.find(Boolean) ?? null;
}

const TITLES = {
  "as-amended": () => 'Terms "as amended from time to time"',
  "web-address": () => "Terms at a web address",
  "statement-of-work": () => "Terms in a Statement of Work",
  "order-form": () => "Terms in an Order Form",
  schedule: (label) => (label ? `Terms in ${label}` : "Terms in a schedule"),
  other: () => "Terms in another document",
};

const SAYS = {
  "as-amended": () => 'This sentence applies terms "as amended from time to time", so they can change after signing.',
  "web-address": (label) =>
    label
      ? `This sentence brings in terms from ${label}. Redline doesn't open web addresses, so it hasn't read them.`
      : "This sentence brings in terms from a web address. Redline doesn't open web addresses, so it hasn't read them.",
  "statement-of-work": () => "This sentence brings in terms from a Statement of Work, which isn't in the text Redline was given.",
  "order-form": () => "This sentence brings in terms from an Order Form, which isn't in the text Redline was given.",
  schedule: (label) => `This sentence brings in ${label ?? "a schedule"}, which isn't in the text Redline was given.`,
  other: () => "This sentence brings in terms from another document, which isn't in the text Redline was given.",
};

const COUNTER_OFFER_DOCUMENT = {
  "as-amended": () => "the terms this sentence refers to",
  "web-address": (label) => (label ? `the terms at ${label}` : "the terms at that web address"),
  "statement-of-work": () => "each Statement of Work",
  "order-form": () => "the Order Form",
  schedule: (label) => label ?? "that schedule",
  other: () => "the document this sentence refers to",
};

const AS_AMENDED_JUDGMENT = "Redline can only check these terms as they stand today. It can't check later versions.";

/**
 * TICKET 08 HOOK: the Counter-offer for an Outside reference (spec-gaps 26), as fixed text from Redline.
 * Ticket 08 is building Counter-offers for model flags in parallel; when it lands, give this text through
 * the field it uses on a flag. Until then it is `counterOffer: { text }` on each Outside reference.
 */
export function outsideReferenceCounterOffer(kind, label) {
  const what = (COUNTER_OFFER_DOCUMENT[kind] ?? COUNTER_OFFER_DOCUMENT.other)(label);
  return `Attach ${what} to this agreement as a schedule. The terms in it are fixed as they stand on the date this agreement is signed, and change only by written agreement of both parties.`;
}

/**
 * One Outside reference as Review returns it.
 * @param {{ kinds: string[], labels?: string[], sourceSentences: { text: string, start: number, end: number }[] }} found
 * @param {{ id: string, number: number, name: string }[]} redLines The list Review was given.
 * @param {{ at: string } | null} reviewed The Reviewer's statement that they reviewed it, if they made one.
 * @param {(text: string, opts?: object) => object} own Turns Redline's text into the { text, marked, isJudgment } shape.
 */
export function buildOutsideReference(found, redLines, reviewed, own) {
  const kinds = found.kinds.length > 0 ? found.kinds : ["other"];
  const primary = kinds[0];
  const sentence = found.sourceSentences[0].text;
  const label = labelFor(primary, found.labels ?? [], sentence);
  const rl3 = kinds.includes("as-amended") ? redLines.find((r) => r && r.id === ONE_SIDED_CHANGES_ID) : null;
  const redLineMatch = rl3 ? { id: rl3.id, number: rl3.number, name: rl3.name } : null;
  const severity = redLineMatch ? "dont-sign-as-written" : "negotiate";
  const says = kinds.map((k) => SAYS[k](labelFor(k, found.labels ?? [], sentence))).join(" ");
  const statement = reviewed && typeof reviewed.at === "string" ? { at: reviewed.at } : null;
  return {
    kinds,
    severity,
    redLineMatch,
    title: own(TITLES[primary](label)),
    says: own(says),
    judgment: kinds.includes("as-amended") ? own(AS_AMENDED_JUDGMENT, { alwaysJudgment: true }) : null,
    sourceSentences: found.sourceSentences,
    counterOffer: { text: outsideReferenceCounterOffer(primary, label) },
    // The Reviewer's statement, never something Redline checked (ADR 0007).
    reviewed: statement,
    resolved: statement !== null && redLineMatch === null && severity === "negotiate",
  };
}

const key = (text) => normalise(text);

/**
 * Puts together the Outside references for a review: Redline's own finds, plus any the model adds (each
 * checked like a flag), plus, on reopen, any stored entry the patterns no longer find. Reviewed marks are
 * carried over by Source sentence text.
 * @param {{ documentText: string, redLines: object[], modelReferences?: unknown, stored?: unknown, own: Function }} input
 * @returns {{ outsideReferences: object[], withheld: { reason: string }[] }}
 */
export function assembleOutsideReferences({ documentText, redLines, modelReferences = null, stored = null, own }) {
  const { found, failed } = findOutsideReferences(documentText);
  // A match Redline cannot cut into a sentence the check accepts (a contents line with dot leaders, which
  // the check reads as an ellipsis, or no boundary in reach). The patterns find it again whenever the
  // review is reopened, so the saved withheld list leaves it out (saved.js) and it is counted once.
  const withheld = Array.from({ length: failed }, () => ({ reason: NOT_CITABLE }));
  const entries = new Map(found.map((f) => [key(f.sourceSentences[0].text), f]));

  // Ones the model adds: optional in its reply, and the prompt does not ask for them yet (ticket 13
  // report). Each must cite one sentence that passes the check, or it is withheld.
  for (const raw of Array.isArray(modelReferences) ? modelReferences : []) {
    const quotes = Array.isArray(raw?.sourceSentences) ? raw.sourceSentences : typeof raw?.sourceSentence === "string" ? [raw.sourceSentence] : [];
    if (quotes.length !== 1) {
      withheld.push({ reason: quotes.length === 0 ? "no-source" : "unreadable" });
      continue;
    }
    const checked = checkSources(documentText, quotes);
    if (!checked.found) {
      withheld.push({ reason: "source-not-found" });
      continue;
    }
    const k = key(checked.sources[0].text);
    if (!entries.has(k)) entries.set(k, { kinds: kindsIn(checked.sources[0].text), labels: [], sourceSentences: checked.sources });
  }

  // On reopen: the Reviewer's marks, and any stored reference the patterns no longer find.
  const marks = new Map();
  for (const s of Array.isArray(stored) ? stored : []) {
    if (!s || typeof s.source_sentence !== "string") continue;
    const k = key(s.source_sentence);
    if (s.reviewed === true && typeof s.reviewed_at === "string") marks.set(k, { at: s.reviewed_at });
    if (entries.has(k)) continue;
    const checked = checkSources(documentText, [s.source_sentence]);
    if (!checked.found) {
      withheld.push({ reason: "source-not-found" });
      continue;
    }
    const kinds = Array.isArray(s.kinds) ? s.kinds.filter((x) => OUTSIDE_REFERENCE_KINDS.includes(x)).sort(byKind) : [];
    entries.set(k, { kinds: kinds.length > 0 ? kinds : kindsIn(checked.sources[0].text), labels: [], sourceSentences: checked.sources });
  }

  const outsideReferences = [...entries.entries()]
    .sort(([, a], [, b]) => a.sourceSentences[0].start - b.sourceSentences[0].start)
    .map(([k, f], i) => ({ number: i + 1, ...buildOutsideReference(f, redLines, marks.get(k) ?? null, own) }));
  return { outsideReferences, withheld };
}

/**
 * The outside_references column after the Reviewer marks one reference as reviewed (or takes the mark
 * back). The reference is named by its Source sentence's text, as shown. Null when the review has no
 * such reference.
 * @param {object[]} outsideReferences The references of the review as reopened.
 * @param {string} sourceSentence
 * @param {boolean} reviewed
 * @param {string} at When the Reviewer made the statement (ISO time).
 */
export function storedWithMark(outsideReferences, sourceSentence, reviewed, at) {
  if (typeof sourceSentence !== "string" || typeof reviewed !== "boolean") return null;
  const k = key(sourceSentence);
  const list = Array.isArray(outsideReferences) ? outsideReferences : [];
  if (!list.some((r) => key(r.sourceSentences[0].text) === k)) return null;
  return toStoredOutsideReferences(
    list.map((r) => (key(r.sourceSentences[0].text) === k ? { ...r, reviewed: reviewed ? { at } : null } : r)),
  );
}

/** The outside_references column for a review: kinds, the Source sentence's text and the Reviewer's mark. */
export function toStoredOutsideReferences(outsideReferences) {
  return (Array.isArray(outsideReferences) ? outsideReferences : []).map((r) => ({
    kinds: r.kinds.filter((k) => OUTSIDE_REFERENCE_KINDS.includes(k)),
    source_sentence: r.sourceSentences[0].text,
    reviewed: r.reviewed !== null && r.reviewed !== undefined,
    reviewed_at: r.reviewed?.at ?? null,
  }));
}
