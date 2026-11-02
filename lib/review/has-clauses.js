// Whether the stored text holds at least one clause Redline could have checked (ADR 0006 addendum,
// product owner, 2026-11-02). Worked out from the stored text, never from the model. It fails closed.
// Each candidate is judged as one unit: a line, plus following lines only when they start lowercase and
// so continue its sentence. A clause is a sentence of at least 6 words with an operative word that has
// a word before it and a word after it, so headings, stamp fields and a statutory alert do not count.
// Plain splits over capped input and set lookups, so the cost is linear.
const MAX_CHARS = 200_000;
const MAX_UNIT = 1_000;
const MIN_WORDS = 6;
const NUMBER = /^\s{0,8}(?:clause\s+)?(?:\(?[a-zA-Z0-9]{1,4}\)|\d{1,3}(?:\.\d{1,3}){0,3}[.)]?)\s+(?=\S)/i;
// A numbered line may use the wider list; a sentence with no number has to use a binding word.
const BINDING = new Set(["shall", "must", "agree", "agrees", "undertake", "undertakes", "covenant", "covenants", "hereby"]);
const OPERATIVE = new Set([...BINDING, "will", "may", "pay", "pays", "payable", "liable", "entitled", "terminate", "terminates", "governed", "applies", "apply", "subject"]);
// These close a sentence with no object: "The Act applies."
const ENDS_SENTENCE = new Set(["applies", "apply"]);
// The printed wording of a stamp paper is never a term of the contract.
const STAMP_WORDING = /\b(?:stamp|certificate|statutory alert)\b/i;

function isClause(sentence, list) {
  if (STAMP_WORDING.test(sentence)) return false;
  const words = sentence.trim().split(/\s+/);
  if (words.length < MIN_WORDS) return false;
  return words.some((word, i) => {
    // Lowercase only, so a title-case heading does not count.
    const bare = word.replace(/^[^a-z]+|[^a-z]+$/g, "");
    return list.has(bare) && i > 0 && (i < words.length - 1 || ENDS_SENTENCE.has(bare));
  });
}

export function hasClauses(documentText) {
  if (typeof documentText !== "string") return false;
  const lines = documentText.slice(0, MAX_CHARS).split("\n");
  for (let i = 0; i < lines.length; i++) {
    let unit = lines[i];
    while (unit.length < MAX_UNIT && /^\s*\p{Ll}/u.test(lines[i + 1] ?? "") && !NUMBER.test(lines[i + 1])) unit += ` ${lines[++i]}`;
    unit = unit.slice(0, MAX_UNIT);
    const numbered = NUMBER.test(unit);
    const list = numbered ? OPERATIVE : BINDING;
    if (unit.replace(NUMBER, "").split(/[.;!?]\s+/).some((s) => isClause(s.replace(/[.;!?]\s*$/, ""), list))) return true;
  }
  return false;
}
