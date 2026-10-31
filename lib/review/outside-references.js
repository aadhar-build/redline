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
// - "as-amended": terms that can change after signing: "as amended from time to time" and the other
//   wordings in AS_AMENDED, and "then-current" or "current version" beside a named document, terms or a
//   policy (QUESTIONS.md 28). Never after a statute with its year (QUESTIONS.md 27).
// A mention preceded by "this" ("this Statement of Work") is the document naming itself, not a reference.
// "other" is kept for a reference the model adds that none of these patterns names.
//
// One reference per referenced document (QUESTIONS.md 30, ADR 0007 addendum), with all its sentences.
// An "as amended" sentence joins the document it names, or stands alone when it names none. Severity
// (spec-gaps 12 and 13): Negotiate, except that an "as amended" reference matches Default Red line 3 and
// is Don't sign as written, when that Red line is in the list Review was given in its original wording
// (QUESTIONS.md 29). The Reviewer can mark a reference as reviewed: that is stored as the Reviewer's
// statement (with when they made it), never as something Redline checked. A reference is resolved only
// when it is marked reviewed and is not a Red line match, so a Red line 3 match never stops blocking a
// Clean result.
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
// QUESTIONS.md 28 (settled by Fable advisor, 2026-10-31): other wordings of "as amended", as a bounded
// alternation with no free text between its parts except a short "by ..." in the third form.
const VERBS = "amended|updated|revised|modified|varied|supplemented|replaced|changed";
const AS_AMENDED = new RegExp(
  [
    `\\bas\\s+(?:(?:may|might)\\s+be\\s+)?(?:${VERBS})(?:\\s+(?:or|and)\\s+(?:${VERBS}))?\\s+from\\s+time\\s+to\\s+time\\b`,
    "\\bas\\s+in\\s+(?:force|effect)\\s+from\\s+time\\s+to\\s+time\\b",
    // Ticket 14c, bug 3: "for the time being in force".
    "\\bfor\\s+the\\s+time\\s+being\\s+in\\s+force\\b",
    "\\bas\\s+(?:amended|updated|revised|modified|published|posted)\\s+(?:by\\s+[^,.;\\n]{1,40}?\\s+)?from\\s+time\\s+to\\s+time\\b",
  ].join("|"),
  "gi",
);
// "then-current" or "current version": only when the same sentence names a document kind the patterns
// find, or terms or a policy (QUESTIONS.md 28).
const CURRENT = /\bthen[- ]current\b|\bcurrent\s+version\b/gi;
const CURRENT_CONTEXT = /\b(?:terms|polic(?:y|ies))\b/i;

// QUESTIONS.md 27 (settled by Fable advisor, 2026-10-31; security review): a statute or its rules "as
// amended" is Parliament's change, not the Counterparty's. Matched on the text just before the phrase: an
// Act, Rules, Regulations, Code or Ordinance, a year (bare, in brackets or "of YYYY"), an optional
// bracketed alias, and nothing else. It fails closed: such a phrase is still an Outside reference (kind
// "other", so Negotiate and blocking a Clean result until marked), only without the Red line 3 match.
// And the exemption never applies when the name before Act, Rules or Code has a possessive ("'s") or a
// party term (one the document's parties use, or a common one such as Provider), since a Counterparty
// can name its own terms "Service Code, 2024".
const YEAR = "(?:1[89]\\d\\d|20\\d\\d)";
const STATUTE_BEFORE = new RegExp(
  `\\b(?:Act|Rules|Regulations|Code|Ordinance),?\\s*(?:(?:of\\s+)?${YEAR}|\\(\\s*${YEAR}\\s*\\))\\s*(?:\\([^()\\n]{1,40}\\)\\s*)?,?\\s*\\(?\\s*$`,
  "i",
);
const STATUTE_WINDOW = 120;
export const PARTY_TERMS = Object.freeze(["Provider", "Supplier", "Vendor", "Company", "Licensor", "Lessor", "Customer", "Client"]);
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function partyPattern(parties) {
  const names = [...PARTY_TERMS, ...(Array.isArray(parties) ? parties : [])]
    .filter((p) => typeof p === "string" && p.trim().length >= 2 && p.trim().length <= 100)
    .map((p) => escapeRe(p.trim().replace(/^the\s+/i, "")));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

const NAME_RUN = /(?:(?:\p{Lu}[\p{L}\p{N}'’.&-]*|of|and|the|for|&|\([^()\n]{0,80}\))\s+)*$/u;

function afterStatute(stored, at, party) {
  const before = stored.slice(Math.max(0, at - STATUTE_WINDOW), at);
  const m = STATUTE_BEFORE.exec(before);
  if (!m) return false;
  // The statute's name: the run of capitalised words (with "of", "and", "the" and bracketed parts)
  // just before the keyword.
  const name = before.slice(0, m.index).match(NAME_RUN)[0];
  if (/['’]s\b/i.test(name)) return false;
  return !party.test(name);
}
const phraseOf = (text) => text.replace(/\s+/g, " ");


// Each label of a bare domain needs a letter ("4.in" is not one). Checked in code, not in the pattern,
// so the pattern has no ambiguous repetition (no catastrophic backtracking).
const labelsHaveLetters = (domain) => domain.split("/")[0].split(".").every((l) => /[a-z]/.test(l));

const DOCUMENT_KINDS = ["web-address", "statement-of-work", "order-form", "schedule"];

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

// One heading cache per contract text, kept for the call.
const parentCaches = new WeakMap();
function parentCache(lines) {
  if (!parentCaches.has(lines)) {
    const c = new Map();
    c.lines = lines;
    parentCaches.set(lines, c);
  }
  return parentCaches.get(lines);
}

const trimUrl = (u) => u.replace(/[.,;:!?\]]+$/, "");

// Ticket 14c, bug 2 (ADR 0007 addendum): government e-stamping and registration verification sites
// printed on stamp certificates. A web address whose host is one of these, or a subdomain of one, is
// not an Outside reference. The list is fixed; every other web address is still raised (fail closed).
export const VERIFICATION_HOSTS = Object.freeze(["shcilestamp.com"]);
// State IGRS (registration) and eGRAS (government receipts) portals, only on government-only suffixes:
// a host label starting "igrs" or "egras" under .gov.in or .nic.in ("igrs.telangana.gov.in",
// "igrsup.gov.in", "egras.raj.nic.in", "egrashry.nic.in").
const STATE_PORTAL = /^(?:[a-z0-9-]+\.)*(?:igrs|egras)[a-z0-9-]*\.(?:[a-z0-9-]+\.)*(?:gov|nic)\.in$/;

export function isVerificationAddress(address) {
  // Strict host: cut at the first / ? # \ @ or ":" (port), letters, digits, "." and "-" only. Anything
  // else ("shcilestamp.com@evil.com", "evil.com\\shcilestamp.com") is not a verification address.
  const bare = String(address).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const cut = bare.search(/[/?#\\@]/);
  const authority = cut === -1 ? bare : bare.slice(0, cut);
  if (cut !== -1 && bare[cut] === "@") return false;
  const host = authority.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  // A path, query or fragment that carries another domain ("…/verify?terms=provider-terms.com") is not
  // a verification address: the whole address is raised (fail closed).
  if (cut !== -1 && /[a-z0-9-]\.(?:com|in|org|net|io|co|gov|biz|info|uk|us)(?![a-z0-9-])/i.test(bare.slice(cut))) return false;
  if (VERIFICATION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  return STATE_PORTAL.test(host);
}

// Every match of every pattern in the stored text, as { kind, label, from, to }, up to
// MAX_REFERENCE_MATCHES in all. Matches beyond the cap are counted in `overflow` and never worked
// through, so the caller withholds them (fail closed). A statute "as amended" is kind "other".
function matches(stored, { parties = null, parentLines = null } = {}) {
  const found = [];
  found.overflow = 0;
  const party = partyPattern(parties);
  const full = () => found.length >= MAX_REFERENCE_MATCHES;
  const add = (kind, label, m) => {
    if (SELF.test(stored.slice(Math.max(0, m.index - 8), m.index))) return;
    if (full()) {
      found.overflow += 1;
      return;
    }
    found.push({ kind, label, from: m.index, to: m.index + m[0].length });
  };
  for (const m of stored.matchAll(AS_AMENDED)) {
    if (afterStatute(stored, m.index, party)) add("other", null, m);
    else add("as-amended", phraseOf(m[0]), m);
  }
  for (const m of stored.matchAll(WEB)) {
    if (!isVerificationAddress(trimUrl(m[0]))) add("web-address", trimUrl(m[0]), m);
  }
  for (const m of stored.matchAll(BARE_DOMAIN)) {
    if (!labelsHaveLetters(m[0])) continue;
    // Already part of an address found above ("www.example.com").
    if (found.some((f) => f.kind === "web-address" && m.index >= f.from && m.index < f.to)) continue;
    if (isVerificationAddress(trimUrl(m[0]))) continue;
    add("web-address", trimUrl(m[0]), m);
  }
  for (const m of stored.matchAll(SOW)) add("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(SOW_SHORT)) add("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(ORDER_FORM)) add("order-form", "Order Form", m);
  const cache = new Map();
  cache.lines = stored.split("\n");
  for (const m of stored.matchAll(SCHEDULE)) {
    if (full()) {
      found.overflow += 1;
      continue;
    }
    if (schedulePresent(stored, m[1], m[2], cache)) continue;
    // QUESTIONS.md 42: in an added text, a heading in the contract counts too (never the reverse).
    if (parentLines && schedulePresent(stored, m[1], m[2], parentCache(parentLines))) continue;
    add("schedule", `${capitalise(m[1])} ${m[2]}`, m);
  }
  // The document matches so far, sorted by position, so a sentence's are found by binary search.
  const docs = found.filter((f) => DOCUMENT_KINDS.includes(f.kind)).sort((a, b) => a.from - b.from);
  const namesDocument = (s) => {
    let lo = 0;
    let hi = docs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (docs[mid].from < s.start) lo = mid + 1;
      else hi = mid;
    }
    return lo < docs.length && docs[lo].from < s.end && docs[lo].to <= s.end;
  };
  let last = null;
  for (const m of stored.matchAll(CURRENT)) {
    if (full()) {
      found.overflow += 1;
      continue;
    }
    const to = m.index + m[0].length;
    // One sentenceAt per sentence: matches come in order, so the last sentence is the cache.
    const s = last && m.index >= last.start && to <= last.end ? last : sentenceAt(stored, m.index, to);
    if (s) last = s;
    // No sentence to judge by: kept, so it fails the check later and is withheld (fail closed).
    if (s && !namesDocument(s) && !CURRENT_CONTEXT.test(s.text)) continue;
    if (afterStatute(stored, m.index, party)) add("other", null, m);
    else add("as-amended", phraseOf(m[0]), m);
  }
  return found;
}

const byKind = (a, b) => OUTSIDE_REFERENCE_KINDS.indexOf(a) - OUTSIDE_REFERENCE_KINDS.indexOf(b);

// A web address as a group key (QUESTIONS.md 30): no scheme, no "www.", the host in lower case, no
// trailing "/" or punctuation, the path kept as written.
export function webAddressKey(address) {
  const bare = String(address).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const slash = bare.indexOf("/");
  const host = (slash === -1 ? bare : bare.slice(0, slash)).toLowerCase();
  const rest = slash === -1 ? "" : bare.slice(slash);
  return `${host}${rest}`.replace(/[/.,;:!?)\]]+$/, "");
}

// The key of the referenced document a match names, or null for one that names none.
function documentKey(kind, label) {
  if (kind === "statement-of-work" || kind === "order-form") return kind;
  if (kind === "web-address" && label) return `web-address:${webAddressKey(label)}`;
  if (kind === "schedule" && label) return `schedule:${label.toLowerCase()}`;
  return null;
}

// One reference per sentence for an "as amended" sentence that names no document, and for one the
// model adds.
const sentenceKey = (text) => `sentence:${normalise(text)}`;

/** The group key of a reference from its kinds, label and first Source sentence (as stored). */
export function referenceKey(kinds, label, firstSentence) {
  const kind = (kinds ?? []).find((k) => DOCUMENT_KINDS.includes(k));
  return (kind && documentKey(kind, label)) || sentenceKey(firstSentence);
}

function addSentence(list, source) {
  if (!list.some((s) => s.start === source.start && s.end === source.end)) list.push(source);
}

/**
 * The Outside references Redline's patterns find in the stored text, one per referenced document
 * (QUESTIONS.md 30), in order of first appearance. Each group holds all of its Source sentences in
 * document order. failed counts matches whose sentence could not be cut or did not pass the Source
 * sentence check: the caller withholds them (so they block a Clean result), never drops them silently.
 * MAX_REFERENCE_MATCHES applies to raw matches, before grouping.
 * @returns {{ found: { key: string, kinds: string[], label: string | null, labels: string[], sourceSentences: { text: string, start: number, end: number }[] }[], failed: number }}
 */
export function findOutsideReferences(documentText, { parties = null, parentText = null } = {}) {
  const stored = String(documentText ?? "").normalize("NFC");
  const check = sourceChecker(documentText);
  const checkedBySentence = new Map();
  // QUESTIONS.md 42 (settled by Fable advisor, 2026-10-31): parentText is the contract, given only when
  // documentText is a document the Reviewer added. A schedule named in the added text is not a reference
  // when the contract has its heading. The contract's own matches never look at an added text, and
  // added texts never look at each other.
  const parentLines = typeof parentText === "string" ? parentText.normalize("NFC").split("\n") : null;
  const raw = matches(stored, { parties, parentLines });
  const all = [...raw].sort((a, b) => a.from - b.from);
  // Over the cap: counted as failed, so withheld and blocking a Clean result (fail closed).
  let failed = raw.overflow + Math.max(0, all.length - MAX_REFERENCE_MATCHES);
  const cited = [];
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
    cited.push({ ...m, source: checked.sources[0] });
  }

  const groups = new Map();
  const join = (key, m, label) => {
    const g = groups.get(key) ?? { key, kinds: [], label: label ?? null, labels: [], sourceSentences: [] };
    if (!g.kinds.includes(m.kind)) g.kinds.push(m.kind);
    if (m.label && !g.labels.includes(m.label)) g.labels.push(m.label);
    addSentence(g.sourceSentences, m.source);
    groups.set(key, g);
  };
  // The documents each sentence names, so an "as amended" in the same sentence joins them.
  const documentsIn = new Map();
  const sentenceLevel = (m) => m.kind === "as-amended" || m.kind === "other";
  for (const m of cited) {
    if (sentenceLevel(m)) continue;
    const key = documentKey(m.kind, m.label);
    join(key, m, m.label);
    const at = `${m.source.start}:${m.source.end}`;
    documentsIn.set(at, [...new Set([...(documentsIn.get(at) ?? []), key])]);
  }
  for (const m of cited) {
    if (!sentenceLevel(m)) continue;
    const named = documentsIn.get(`${m.source.start}:${m.source.end}`);
    // A statute "as amended" (kind "other") in a sentence that names a document adds nothing: that
    // document's reference already stands for the sentence.
    if (named) {
      if (m.kind === "as-amended") for (const key of named) join(key, m, null);
    } else join(sentenceKey(m.source.text), m, m.label);
  }
  const found = [...groups.values()]
    .map((g) => ({ ...g, kinds: g.kinds.sort(byKind), sourceSentences: g.sourceSentences.sort((a, b) => a.start - b.start) }))
    .sort((a, b) => a.sourceSentences[0].start - b.sourceSentences[0].start);
  return { found, failed };
}

/** The kinds Redline's patterns name in one sentence, or ["other"]. */
export function kindsIn(sentence) {
  const kinds = [...new Set(matches(String(sentence).normalize("NFC")).map((m) => m.kind))].sort(byKind);
  return kinds.length > 0 ? kinds : ["other"];
}

// The first label Redline's patterns give a kind in these sentences: the matched words for "as amended",
// the address for a web address, the name for a schedule.
function labelFor(kind, sentences, fallback) {
  for (const s of sentences) {
    const own = matches(String(s.text).normalize("NFC")).find((m) => m.kind === kind && m.label);
    if (own) return own.label;
  }
  return fallback ?? null;
}

const TITLES = {
  "as-amended": (phrase) => `Terms "${phrase ?? "as amended from time to time"}"`,
  "web-address": () => "Terms at a web address",
  "statement-of-work": () => "Terms in a Statement of Work",
  "order-form": () => "Terms in an Order Form",
  schedule: (label) => (label ? `Terms in ${label}` : "Terms in a schedule"),
  other: () => "Terms in another document",
};

// The count in a title, when a reference has more than one Source sentence (QUESTIONS.md 30).
const countIn = (n) => (n > 1 ? ` (${n} sentences)` : "");

// "This sentence brings" or "These sentences bring".
const brings = (n) => (n > 1 ? "These sentences bring" : "This sentence brings");

// How many of a reference's sentences apply changeable terms, said plainly.
function applies(amended, n) {
  if (n <= 1) return "This sentence applies";
  if (amended >= n) return "These sentences apply";
  if (amended === 1) return "One of these sentences applies";
  return `${amended} of these sentences apply`;
}

const SAYS = {
  "as-amended": (phrase, { n, amended }) =>
    `${applies(amended, n)} terms "${phrase ?? "as amended from time to time"}", so they can change after signing.`,
  "web-address": (label, { n }) =>
    label
      ? `${brings(n)} in terms from ${label}. Redline doesn't open web addresses, so it hasn't read them.`
      : `${brings(n)} in terms from a web address. Redline doesn't open web addresses, so it hasn't read them.`,
  "statement-of-work": (_, { n }) => `${brings(n)} in terms from a Statement of Work, which isn't in the text Redline was given.`,
  "order-form": (_, { n }) => `${brings(n)} in terms from an Order Form, which isn't in the text Redline was given.`,
  schedule: (label, { n }) => `${brings(n)} in ${label ?? "a schedule"}, which isn't in the text Redline was given.`,
  other: (_, { n }) => `${brings(n)} in terms from another document, which isn't in the text Redline was given.`,
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
 * @param {{ key?: string, kinds: string[], label?: string | null, labels?: string[], sourceSentences: { text: string, start: number, end: number }[] }} found
 * @param {{ id: string, number: number, name: string, catches?: string | null }[]} redLines The list Review was given.
 * @param {{ at: string } | null} reviewed The Reviewer's statement that they reviewed it, if they made one.
 * @param {(text: string, opts?: object) => object} own Turns Redline's text into the { text, marked, isJudgment } shape.
 */
export function buildOutsideReference(found, redLines, reviewed, own) {
  const kinds = found.kinds.length > 0 ? found.kinds : ["other"];
  const sentences = found.sourceSentences;
  const n = sentences.length;
  // The referenced document names the reference; "as amended" alone does when it names none.
  const primary = kinds.find((k) => k !== "as-amended") ?? kinds[0];
  const label = primary === "as-amended" || !found.label ? labelFor(primary, sentences, found.label) : found.label;
  // QUESTIONS.md 29 (settled by Fable advisor, 2026-10-31): Default Red line 3 matches only as written,
  // with its "catches" text, which names the "as amended" wording. Reworded, it has no catches.
  const rl3 = kinds.includes("as-amended")
    ? redLines.find((r) => r && r.id === ONE_SIDED_CHANGES_ID && typeof r.catches === "string" && r.catches.trim() !== "")
    : null;
  const redLineMatch = rl3 ? { id: rl3.id, number: rl3.number, name: rl3.name } : null;
  const severity = redLineMatch ? "dont-sign-as-written" : "negotiate";
  const amended = sentences.filter((s) => kindsIn(s.text).includes("as-amended")).length;
  const ctx = { n, amended: Math.max(1, amended) };
  const ordered = [primary, ...kinds.filter((k) => k !== primary)];
  const says = ordered.map((k) => SAYS[k](k === primary ? label : labelFor(k, sentences, null), ctx)).join(" ");
  const statement = reviewed && typeof reviewed.at === "string" ? { at: reviewed.at } : null;
  return {
    key: found.key ?? referenceKey(kinds, found.label ?? null, sentences[0].text),
    kinds,
    label: found.label ?? null,
    severity,
    redLineMatch,
    title: own(`${TITLES[primary](label)}${countIn(n)}`),
    says: own(says),
    judgment: kinds.includes("as-amended") ? own(AS_AMENDED_JUDGMENT, { alwaysJudgment: true }) : null,
    sourceSentences: sentences,
    counterOffer: { text: outsideReferenceCounterOffer(primary, label) },
    // The Reviewer's statement, never something Redline checked (ADR 0007).
    reviewed: statement,
    resolved: statement !== null && redLineMatch === null && severity === "negotiate",
  };
}

const key = (text) => normalise(text);

/**
 * Puts together the Outside references for a review: Redline's own finds, one per referenced document,
 * plus any the model adds (each checked like a flag, one per sentence), plus, on reopen, any stored
 * reference the patterns no longer find. A stored reference keeps the Reviewer's mark when at least one
 * of its sentences still passes the check, and lists only the sentences that pass.
 * @param {{ documentText: string, redLines: object[], modelReferences?: unknown, stored?: unknown, own: Function }} input
 * @returns {{ outsideReferences: object[], withheld: { reason: string }[] }}
 */
export function assembleOutsideReferences({ documentText, redLines, modelReferences = null, stored = null, own, parties = null, parentText = null, previousMarks = null }) {
  const { found, failed } = findOutsideReferences(documentText, { parties, parentText });
  // A match Redline cannot cut into a sentence the check accepts (a contents line with dot leaders, which
  // the check reads as an ellipsis, or no boundary in reach). The patterns find it again whenever the
  // review is reopened, so the saved withheld list leaves it out (saved.js) and it is counted once.
  const withheld = Array.from({ length: failed }, () => ({ reason: NOT_CITABLE }));
  const groups = new Map(found.map((f) => [f.key, f]));
  const cited = new Set(found.flatMap((f) => f.sourceSentences.map((s) => key(s.text))));

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
    const source = checked.sources[0];
    if (cited.has(key(source.text))) continue;
    cited.add(key(source.text));
    const gk = sentenceKey(source.text);
    groups.set(gk, { key: gk, kinds: kindsIn(source.text), label: null, labels: [], sourceSentences: [source] });
  }

  // QUESTIONS.md 38 (settled by Fable advisor, 2026-10-31): on a new review of a saved document, the marks
  // on its previous latest review, by key. Only marks travel: a group the patterns no longer find is not
  // carried, so its mark is dropped. A carried mark is still only the Reviewer's statement, so it never
  // resolves a Red line 3 match (buildOutsideReference).
  const marks = new Map(previousMarks instanceof Map ? [...previousMarks].filter(([, m]) => m && typeof m.at === "string") : []);
  // On reopen: the Reviewer's marks, and any stored reference the patterns no longer find.
  for (const s of Array.isArray(stored) ? stored : []) {
    if (!s || !Array.isArray(s.source_sentences)) continue;
    const texts = s.source_sentences.filter((t) => typeof t === "string" && t.trim() !== "");
    if (texts.length === 0) continue;
    const passing = [];
    for (const t of texts) {
      const checked = checkSources(documentText, [t]);
      if (checked.found) addSentence(passing, checked.sources[0]);
    }
    const kinds = Array.isArray(s.kinds) ? [...new Set(s.kinds.filter((x) => OUTSIDE_REFERENCE_KINDS.includes(x)))].sort(byKind) : [];
    const label = typeof s.label === "string" && s.label.trim() !== "" ? s.label : null;
    const gk = referenceKey(kinds, label, passing[0]?.text ?? texts[0]);
    if (passing.length === 0) {
      if (!groups.has(gk)) withheld.push({ reason: "source-not-found" });
      continue;
    }
    if (s.reviewed === true && typeof s.reviewed_at === "string") marks.set(gk, { at: s.reviewed_at });
    if (groups.has(gk)) continue;
    passing.sort((a, b) => a.start - b.start);
    groups.set(gk, { key: gk, kinds: kinds.length > 0 ? kinds : kindsIn(passing[0].text), label, labels: [], sourceSentences: passing });
  }

  const outsideReferences = [...groups.values()]
    .sort((a, b) => a.sourceSentences[0].start - b.sourceSentences[0].start)
    .map((f, i) => ({ number: i + 1, ...buildOutsideReference(f, redLines, marks.get(f.key) ?? null, own) }));
  return { outsideReferences, withheld };
}

/**
 * The outside_references column after the Reviewer marks one reference as reviewed (or takes the mark
 * back). The mark is per reference, so it covers all of its sentences. The reference is named by its
 * key, or, without one, by any of its Source sentences as shown. Null when the review has no such
 * reference.
 * @param {object[]} outsideReferences The references of the review as reopened.
 * @param {string} sourceSentence
 * @param {boolean} reviewed
 * @param {string} at When the Reviewer made the statement (ISO time).
 * @param {string | null} [referenceKey] The reference's key, which tells apart two references that share a sentence.
 */
export function storedWithMark(outsideReferences, sourceSentence, reviewed, at, referenceKeyOf = null, inDocumentId = null) {
  if (typeof reviewed !== "boolean") return null;
  // QUESTIONS.md 36: a reference is named within the text it sits in (null for the contract), so the same
  // sentence in the contract and in an added document are two references with two marks.
  const list = Array.isArray(outsideReferences) ? outsideReferences : [];
  const inText = list.filter((r) => (r.referencedDocument?.id ?? null) === (inDocumentId ?? null));
  let target;
  if (typeof referenceKeyOf === "string") target = inText.find((r) => r.key === referenceKeyOf);
  else if (typeof sourceSentence === "string") {
    const k = key(sourceSentence);
    target = inText.find((r) => r.sourceSentences.some((s) => key(s.text) === k));
  }
  if (!target) return null;
  return toStoredOutsideReferences(list.map((r) => (r === target ? { ...r, reviewed: reviewed ? { at } : null } : r)));
}

/** The outside_references column: kinds, label, every Source sentence's text and the Reviewer's mark. */
export function toStoredOutsideReferences(outsideReferences) {
  return (Array.isArray(outsideReferences) ? outsideReferences : []).map((r) => ({
    kinds: r.kinds.filter((k) => OUTSIDE_REFERENCE_KINDS.includes(k)),
    label: typeof r.label === "string" && r.label.trim() !== "" ? r.label : null,
    source_sentences: r.sourceSentences.map((s) => s.text),
    reviewed: r.reviewed !== null && r.reviewed !== undefined,
    reviewed_at: r.reviewed?.at ?? null,
    // QUESTIONS.md 36: the added document the reference sits in, or null for the contract.
    referenced_document_id: r.referencedDocument?.id ?? null,
  }));
}

/** The key a mark travels by (QUESTIONS.md 38): the text the reference sits in, then its key. */
export const markKey = (inDocumentId, referenceKeyOf) => `${inDocumentId ?? "main"}|${referenceKeyOf}`;

/** The Reviewer's marks on a review's Outside references, by markKey, to carry to the next review. */
export function marksOf(outsideReferences) {
  const marks = new Map();
  for (const r of Array.isArray(outsideReferences) ? outsideReferences : []) {
    if (r && typeof r.key === "string" && r.reviewed && typeof r.reviewed.at === "string") marks.set(markKey(r.referencedDocument?.id ?? null, r.key), { at: r.reviewed.at });
  }
  return marks;
}

/**
 * QUESTIONS.md 31 (settled by Fable advisor, 2026-10-31): a model Risk flag that only repeats an Outside
 * reference is dropped. Both must hold: it matches the same Red line as the reference, and every one of
 * its Source sentences is among the reference's. A dropped flag is not withheld and is not stored. It can
 * never make a review Clean: the reference it merges into is a Red line match, so it always blocks.
 * @param {object[]} flags The checked Risk flags.
 * @param {object[]} outsideReferences
 * @returns {{ flags: object[], mergedCount: number }}
 */
export function mergeIntoOutsideReferences(flags, outsideReferences) {
  const refs = (Array.isArray(outsideReferences) ? outsideReferences : []).filter((r) => r?.redLineMatch?.id);
  const kept = [];
  let mergedCount = 0;
  for (const f of Array.isArray(flags) ? flags : []) {
    const id = f?.redLineMatch?.id;
    const repeats =
      id &&
      Array.isArray(f.sourceSentences) &&
      f.sourceSentences.length > 0 &&
      refs.some((r) => {
        if (r.redLineMatch.id !== id) return false;
        const own = new Set(r.sourceSentences.map((s) => key(s.text)));
        return f.sourceSentences.every((s) => own.has(key(s.text)));
      });
    if (repeats) mergedCount += 1;
    else kept.push(f);
  }
  return { flags: kept, mergedCount };
}

/** The raw pattern matches, capped at MAX_REFERENCE_MATCHES, and how many were over the cap (for tests). */
export function rawReferenceMatches(documentText, { parties = null } = {}) {
  const found = matches(String(documentText ?? "").normalize("NFC"), { parties });
  return { matched: found.length, overflow: found.overflow };
}
