// Whether the stored text holds at least one clause Redline could have checked (ADR 0006 addendum,
// product owner, 2026-11-02). Worked out from the stored text, never from the model. It fails closed:
// a clause needs a lowercase operative word in a run of at least 6 words, so headings, stamp-certificate
// fields and a statutory alert do not count, and a contract that never uses one is not Clean.
// Plain line and sentence splits over capped input, with fixed-word patterns, so the cost is linear.
const MAX_CHARS = 200_000;
const MAX_LINE = 1_000;
const MIN_WORDS = 6;
const NUMBERED = /^\s{0,8}(?:clause\s+)?(?:\(?[a-zA-Z0-9]{1,4}\)|\d{1,3}(?:\.\d{1,3}){0,3}[.)]?)\s+\S/i;
// A numbered line may use the weaker words; a sentence with no number has to use a binding one.
const BINDING = /\b(?:shall|must|agrees?|undertakes?|covenants?|hereby)\b/;
const OPERATIVE = /\b(?:shall|must|agrees?|undertakes?|covenants?|hereby|will|may|pays?|payable|liable|entitled|terminates?|governed|applies|apply|subject)\b/;
// The printed wording of a stamp paper is never a term of the contract.
const STAMP_WORDING = /\b(?:stamp|certificate|statutory alert)\b/i;

const clauseLike = (text, words) => words.test(text) && !STAMP_WORDING.test(text) && text.trim().split(/\s+/).length >= MIN_WORDS;

export function hasClauses(documentText) {
  if (typeof documentText !== "string") return false;
  const text = documentText.slice(0, MAX_CHARS);
  const lines = text.split("\n").map((line) => line.slice(0, MAX_LINE));
  for (let i = 0; i < lines.length; i++) {
    // The next line too: a clause wraps, or a numbered heading has its clause beneath it.
    if (NUMBERED.test(lines[i]) && clauseLike(`${lines[i]} ${lines[i + 1] ?? ""}`, OPERATIVE)) return true;
  }
  return text.split(/[.;!?]\s+/).some((sentence) => clauseLike(sentence.slice(0, MAX_LINE), BINDING));
}
