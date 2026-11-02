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
//   policy (QUESTIONS.md 28). Never after a statute with its year (QUESTIONS.md 27), general law or an
//   Act named without a year (QUESTIONS.md 44); those are kind "other".
// A mention preceded by "this" ("this Statement of Work") is the document naming itself, not a reference,
// and so is every mention of its own kind in an added text with a heading naming it (QUESTIONS.md 43).
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
// QUESTIONS.md 44: "... Act, 1908 and the rules made thereunder, as amended from time to time".
const RULES_THEREUNDER = "and\\s+the\\s+rules\\s+(?:(?:made|framed)\\s+)?thereunder";
const STATUTE_BEFORE = new RegExp(
  `\\b(?:Act|Rules|Regulations|Code|Ordinance),?\\s*(?:(?:of\\s+)?${YEAR}|\\(\\s*${YEAR}\\s*\\))\\s*(?:\\([^()\\n]{1,40}\\)\\s*)?(?:${RULES_THEREUNDER}\\s*)?,?\\s*\\(?\\s*$`,
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

// QUESTIONS.md 44 (settled by Fable advisor, 2026-10-31): general law ("any law for the time being in
// force", "applicable laws, rules and regulations ...") and an Act named without a year ("the Revenue
// Recovery Act for the time being in force") lose the Red line 3 match, as a dated statute does. They
// stay Outside references of kind "other" (Negotiate, blocking a Clean result until marked). Every check
// looks only at the STATUTE_WINDOW characters before the phrase, and each pattern has bounded repeats of
// whole words, so its time is linear in that window.
// The run starts on a modifier, never on "and" or "or" (security review of 43/44): "and"/"or" are allowed
// only after the first modifier ("any and all laws").
const LAW_MODIFIER = "(?:any|all|other|applicable|relevant|such|the|indian|central|state|local|statutory)";
const LAW_WORD = "(?:laws?|legislation|statutes?|enactments?)";
const LAW_TAIL =
  "(?:(?:\\s*,\\s*(?:(?:and|or)\\s+)?|\\s+(?:and|or)\\s+)(?:rules|regulations|statutes|ordinances|notifications|orders|guidelines|bye-laws|byelaws|circulars|directions)" +
  "|\\s+(?:of\\s+india|in\\s+india|made\\s+thereunder|framed\\s+thereunder|thereunder|applicable\\s+thereto|relating\\s+thereto))";
const GENERAL_LAW = new RegExp(`(?<![\\p{L}\\p{N}'’-])((?:${LAW_MODIFIER}\\s+(?:(?:${LAW_MODIFIER}|and|or)\\s+){0,3})?${LAW_WORD}(?![\\p{L}\\p{N}'’-])(?:${LAW_TAIL}(?![\\p{L}\\p{N}'’-])){0,6}),?\\s*$`, "iu");
// QUESTIONS.md 45 (product owner, 2026-11-02): a place qualifier may follow general law ("other applicable
// laws in Tamil Nadu"). "in", "of" or "within", then an optional "the", "State of" or "Union Territory of",
// then up to 4 capitalised words. Case-sensitive on purpose, so GENERAL_LAW's "i" flag cannot turn \p{Lu}
// into any letter. Words hold only letters and hyphens, so a possessive or abbreviation does not match. The
// words are separated by required whitespace and each is bounded, and the input is the STATUTE_WINDOW slice.
const PLACE_TAIL = /(?<=\p{L})\s+(?:in|of|within)\s+(?:the\s+)?(?:(?:State|Union\s+Territory)\s+of\s+)?\p{Lu}[\p{L}-]{0,40}(?:\s+\p{Lu}[\p{L}-]{0,40}){0,3},?\s*$/u;
// Words that name an organisation or the contract, never a place. Fails closed for a party the model did
// not list ("the laws of Acme Private Limited").
const NOT_A_PLACE = /(?<![\p{L}-])(?:Part(?:y|ies)|Counterpart(?:y|ies)|Agreement|Contract|Companies|Limited|Private|Group|Corporation|Affiliates?|Subsidiar(?:y|ies)|Licensee|Lessee|Seller|Buyer|Contractor)(?![\p{L}-])/u;

// An Act with no year (security review of 43/44): exempt only when it is one of these known Indian
// statutes, optionally after "Indian", "Central", "Integrated", "Union Territory" or a state or union
// territory name ("Maharashtra Rent Control Act"). Any other undated Act keeps the Red line 3 match, so a
// Counterparty cannot name its own rules "the Acme Act" (fail closed). Each name is fixed words joined
// by single whitespace runs, so the pattern is linear.
const KNOWN_ACTS = [
  "Revenue Recovery", "Companies", "Shops and Establishments", "Registration", "Contract", "Indian Contract",
  "Stamp", "Indian Stamp", "Transfer of Property", "Arbitration and Conciliation", "Information Technology",
  "Goods and Services Tax", "Income-tax", "Income Tax", "MSMED",
  "Micro, Small and Medium Enterprises Development", "Rent Control", "Consumer Protection", "Sale of Goods",
];
const ACT_PREFIXES = [
  "Indian", "Central", "Integrated", "Union Territory", "State", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Orissa", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Bombay", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
];
const words = (n) => n.split(" ").map(escapeRe).join("\\s+");
// Anchored (security review 3): the whole capitalised name run before "Act", leading "the", "of" and the
// like dropped, must be exactly a listed name with an optional prefix. "Acme Companies Act" is not exempt.
const KNOWN_ACT_NAME = new RegExp(
  `^(?:(?:${ACT_PREFIXES.map(words).join("|")})\\s+)?(?:${KNOWN_ACTS.map(words).join("|")})\\s*$`,
  "u",
);
// The name run before "Act": capitalised words (a trailing comma allowed, for "Micro, Small and ..."),
// with "of", "and", "the", "for" and "&". Bounded by STATUTE_WINDOW.
const ACT_NAME_RUN = /(?:(?:\p{Lu}[\p{L}\p{N}'’.&-]*,?|of|and|the|for|&)\s+)*$/u;
const LEADING_FILLER = /^(?:(?:of|and|the|for|&)\s+)+/i;
const UNDATED_ACT = new RegExp(`\\bActs?\\s*(?:\\([^()\\n]{1,40}\\)\\s*)?(?:[Aa]nd\\s+[Tt]he\\s+[Rr]ules\\s+(?:(?:made|framed)\\s+)?thereunder\\s*)?,?\\s*$`);
const possessive = (word) => /['’]s$/i.test(word);
const wordBefore = (text) => (text.match(/(\S+)\s*$/)?.[1] ?? "").replace(/[,;:]+$/, "");

// General law counts only when its run starts a clause (security review 3): at a sentence start, or right
// after one of these verbs or prepositions. Anything else before it (a list separator, a capitalised word,
// another noun) keeps the Red line 3 match.
const CLAUSE_OPENERS = new Set(["with", "under", "by", "of", "in", "to", "per", "follow", "follows", "comply", "complies", "applicable", "notwithstanding"]);
// Abbreviations whose full stop does not end a sentence ("M/s Acme Pvt. Ltd. laws ...").
const ABBREVIATION = /\b(?:Ltd|Pvt|Co|Inc|No|Nos|Corp|LLP|Mr|Mrs|Ms|Dr|St|viz|i\.e|e\.g|etc|cf|Sr|Jr)\.$/i;

// Security review 4: one strict gate for both exemptions, so they cannot drift apart. The run counts
// only when it starts a clause:
// - the stored text starts there, or the line starts with a clause number or "(a)" marker;
// - or the previous sentence ended (". ! ? :" after a word that is not an abbreviation);
// - or the word just before it is a clause opener above.
// A bare line break is not a start (a wrapped line is collapsed first). Whatever the start, the word
// before must not be "and"/"or"/"&", a possessive, end in a list separator, or be a party term.
function startsClause(lead, atTextStart, party) {
  if (/\n[^\S\n]*(?:\(\w{1,4}\)|\d{1,3}(?:\.\d{1,3})*\.?)\s+$/.test(lead)) return true;
  const flat = lead.replace(/\s+/g, " ");
  if (flat.trim() === "") return atTextStart;
  if (/[,;/&]\s*$/.test(flat)) return false;
  const word = flat.match(/(\S+)\s*$/)[1];
  if (/^(?:and|or|&)$/i.test(word) || possessive(word.replace(/[.!?:]+$/, "")) || party.test(word)) return false;
  if (/[!?:]$/.test(word)) return true;
  if (/\.$/.test(word)) return !ABBREVIATION.test(word);
  return CLAUSE_OPENERS.has(word.toLowerCase());
}

function generalLaw(stored, at, party) {
  const from = Math.max(0, at - STATUTE_WINDOW);
  const before = stored.slice(from, at);
  const place = PLACE_TAIL.exec(before);
  if (place && (party.test(place[0]) || NOT_A_PLACE.test(place[0]))) return false;
  const law = GENERAL_LAW.exec(place ? before.slice(0, place.index) : before);
  if (law) {
    if (/^(?:and|or|&)\b/i.test(law[0].trim())) return false;
    return startsClause(before.slice(0, law.index), from === 0, party) && !party.test(law[1]);
  }
  const act = UNDATED_ACT.exec(before);
  if (!act) return false;
  const lead = before.slice(0, act.index);
  const run = lead.match(ACT_NAME_RUN)[0];
  if (/^(?:and|or|&)\s/i.test(run)) return false;
  const name = run.replace(LEADING_FILLER, "").trim();
  if (!KNOWN_ACT_NAME.test(name) || party.test(name)) return false;
  // The words the name run took in ("of the") still belong to the lead: the opener is the word before
  // the name, so "under the provisions of the Companies Act" passes on "of". "the" is looked past.
  const filler = run.match(LEADING_FILLER)?.[0] ?? "";
  const rest = (lead.slice(0, lead.length - run.length) + filler).replace(/the\s+$/i, "");
  return startsClause(rest, from === 0 && rest === "", party);
}

// Not a change the Counterparty makes: a dated statute (QUESTIONS.md 27), general law or an undated Act
// (QUESTIONS.md 44).
const isLaw = (stored, at, party) => afterStatute(stored, at, party) || generalLaw(stored, at, party);
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

// The name in any case; the rest of the line case-sensitively, so a "capitalised title" needs a capital
// letter (under the "i" flag \p{Lu} matches any letter, and a wrapped body line such as "Schedule A and
// the Customer will pay the" would read as a heading). Lines over HEADING_LINE_MAX are never headings.
const SCHEDULE_REST = /^(?:[^\S\n]*$|[^\S\n]*[-–—:.)][^\S\n]*[^\n,]{0,80}$|[^\S\n]+\p{Lu}[^\n,]{0,80}$)/u;
function schedulePresentUncached(lines, word, label) {
  const name = new RegExp(`^[^\\S\\n]*${word}\\s+${label}`, "i");
  return lines.some((line) => {
    if (line.length > HEADING_LINE_MAX) return false;
    const m = name.exec(line);
    if (!m) return false;
    const rest = line.slice(m[0].length);
    return SCHEDULE_REST.test(rest) && !/[.;,]\s*$/.test(rest.replace(/^\./, ""));
  });
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
// Checked label by label, with no regular expression over the whole host (no backtracking).
function isStatePortal(host) {
  if (host.length > 253) return false;
  const labels = host.split(".");
  if (labels.length < 3 || labels.length > 10) return false;
  const [second, last] = labels.slice(-2);
  if (last !== "in" || (second !== "gov" && second !== "nic")) return false;
  return labels.slice(0, -2).some((l) => l.startsWith("igrs") || l.startsWith("egras"));
}

export function isVerificationAddress(address) {
  // Strict host: cut at the first / ? # \ @ or ":" (port), letters, digits, "." and "-" only. Anything
  // else ("shcilestamp.com@evil.com", "evil.com\\shcilestamp.com") is not a verification address.
  const bare = String(address).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const cut = bare.search(/[/?#\\@]/);
  const authority = cut === -1 ? bare : bare.slice(0, cut);
  if (cut !== -1 && bare[cut] === "@") return false;
  const host = authority.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  // Only a plain path is allowed after the host (letters, digits, "/", "_", "-"), then optionally a
  // plain query (letters, digits, "=", "&", "_", "-"). No dots, colons or fragment anywhere after it. Anything else ("…/verify?terms=provider-terms.com", "…/x/www.evil.com") is not a
  // verification address, so the whole address is raised (fail closed).
  if (cut !== -1 && !/^\/[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9=&_-]*)?$/.test(bare.slice(cut))) return false;
  if (VERIFICATION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  return isStatePortal(host);
}

// Every match of every pattern in the stored text, as { kind, label, from, to }, up to
// MAX_REFERENCE_MATCHES in all. Matches beyond the cap are counted in `overflow` and never worked
// through, so the caller withholds them (fail closed). A statute "as amended" is kind "other".
// QUESTIONS.md 43 (settled by Fable advisor, 2026-10-31): in an added text, a heading line naming the
// kind the text was added against means the text is that document, so its mentions of that kind are not
// references. Same shape as a schedule heading: the name at the start of the line, then nothing, or a
// dash, colon, full stop, bracket, "#" or "No." and up to 80 characters, or a capitalised or numeric title
// of up to 80 characters, with no comma and no sentence ending. Lines are cut to HEADING_LINE_MAX before
// the test, and each alternative has one bounded repeat, so the time is linear.
const SELF_KIND_NAMES = { "statement-of-work": "(?:statements?\\s+of\\s+work|sows?)", "order-form": "order\\s+forms?" };
export const SELF_KINDS = Object.freeze(Object.keys(SELF_KIND_NAMES));
const HEADING_LINE_MAX = 200;
// The kind's name in any case; the rest of the line is tested case-sensitively, so "capitalised" means a
// capital letter (under the "i" flag \p{Lu} would match any letter).
const SELF_NAME = Object.fromEntries(SELF_KINDS.map((k) => [k, new RegExp(`^[^\\S\\n]*${SELF_KIND_NAMES[k]}`, "i")]));
const SELF_REST = /^(?:[^\S\n]*$|[^\S\n]*(?:[-–—:.()#]|[Nn][Oo]\.)[^\n,]{0,80}$|[^\S\n]+[\p{Lu}\p{N}][^\n,]{0,80}$)/u;

// Only the title block counts (security review of 43/44): the first SELF_TITLE_LINES non-blank lines.
const SELF_TITLE_LINES = 3;
// A document identifier just after a name: "No. 3", "#3", "Number 3", or a bare number ("SOW 1"),
// optionally after a dash or colon. Bounded, so linear.
const SELF_ID = /^[^\S\n]*[-–—:]?[^\S\n]*(?:(?:no\.?|#|number)[^\S\n]*)?(\d[A-Za-z0-9/-]{0,20}|[A-Z](?![\p{L}]))/iu;
const idAfter = (text) => SELF_ID.exec(text)?.[1]?.toLowerCase() ?? null;

/**
 * The headings in the text's title block naming this kind, as the identifiers they carry (null for none),
 * or null when there is no such heading (QUESTIONS.md 43).
 */
export function selfTitleIds(lines, kind) {
  const name = SELF_NAME[kind];
  if (!name) return null;
  const ids = new Set();
  for (const raw of lines.filter((l) => l.trim() !== "").slice(0, SELF_TITLE_LINES)) {
    if (raw.length > HEADING_LINE_MAX) continue;
    const line = raw.replace(/\r$/, "");
    const m = name.exec(line);
    if (!m) continue;
    const rest = line.slice(m[0].length);
    if (SELF_REST.test(rest) && !/[.;,]\s*$/.test(rest.replace(/^\./, ""))) ids.add(idAfter(rest));
  }
  return ids.size > 0 ? ids : null;
}

const SELF_OTHER_BEFORE = /\b(?:other|prior|previous|each|any|every|separate|additional|further|future|dated|signed)\s+$/i;
const SELF_OTHER_AFTER = /^[^\S\n]*,?[^\S\n]*(?:dated|signed)\b/i;
const SELF_DEICTIC_BEFORE = /\b(?:this|the\s+above|the\s+present)\s+$/i;
const SELF_DEICTIC_AFTER = /^[^\S\n]*(?:above|herein|hereof|hereto)\b/i;

/** Whether the text's title block has a heading naming this kind (QUESTIONS.md 43). */
export const selfTitled = (lines, kind) => selfTitleIds(lines, kind) !== null;

function matches(stored, { parties = null, parentLines = null, selfKinds = [] } = {}) {
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
    if (isLaw(stored, m.index, party)) add("other", null, m);
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
  const cache = new Map();
  cache.lines = stored.split("\n");
  // A mention names the same document when it carries no identifier or the heading's own. One with
  // another identifier ("Order Form No. 5" under "ORDER FORM No. 3") is still raised (fail closed).
  const titles = new Map((Array.isArray(selfKinds) ? selfKinds : []).filter((k) => SELF_KINDS.includes(k)).map((k) => [k, selfTitleIds(cache.lines, k)]));
  const addUnlessSelf = (kind, label, m) => {
    const ids = titles.get(kind);
    if (ids) {
      const end = m.index + m[0].length;
      const pre = stored.slice(Math.max(0, m.index - 30), m.index);
      const post = stored.slice(end, end + 40);
      // Qualified as some other document: always raised (security review 3).
      const other = SELF_OTHER_BEFORE.test(pre) || SELF_OTHER_AFTER.test(post);
      const id = idAfter(post);
      if (!other) {
        if (id !== null && ids.has(id)) return;
        // No identifier: the same document only when the heading has none either, or it points at itself.
        if (id === null && (ids.has(null) || SELF_DEICTIC_BEFORE.test(pre) || SELF_DEICTIC_AFTER.test(post))) return;
      }
    }
    add(kind, label, m);
  };
  for (const m of stored.matchAll(SOW)) addUnlessSelf("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(SOW_SHORT)) addUnlessSelf("statement-of-work", "Statement of Work", m);
  for (const m of stored.matchAll(ORDER_FORM)) addUnlessSelf("order-form", "Order Form", m);
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
    if (isLaw(stored, m.index, party)) add("other", null, m);
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
export function findOutsideReferences(documentText, { parties = null, parentText = null, selfKinds = [] } = {}) {
  const stored = String(documentText ?? "").normalize("NFC");
  const check = sourceChecker(documentText);
  const checkedBySentence = new Map();
  // QUESTIONS.md 42 (settled by Fable advisor, 2026-10-31): parentText is the contract, given only when
  // documentText is a document the Reviewer added. A schedule named in the added text is not a reference
  // when the contract has its heading. The contract's own matches never look at an added text, and
  // added texts never look at each other.
  const parentLines = typeof parentText === "string" ? parentText.normalize("NFC").split("\n") : null;
  // QUESTIONS.md 43: selfKinds are the kinds the added text was added against (never for the contract).
  const raw = matches(stored, { parties, parentLines, selfKinds });
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
export function assembleOutsideReferences({ documentText, redLines, modelReferences = null, stored = null, own, parties = null, parentText = null, previousMarks = null, selfKinds = [] }) {
  const { found, failed } = findOutsideReferences(documentText, { parties, parentText, selfKinds });
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
