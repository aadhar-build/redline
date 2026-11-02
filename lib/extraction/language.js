// Is this document in English? ADR 0009: v1 reads English-language documents only and rejects the rest.
// Browser-safe and dependency-free, so the browser and the server apply the same rule.
//
// The heuristic, in two steps, deliberately lenient (a wrong rejection blocks a real contract):
//  1. Script. At least MIN_LATIN_SHARE of the letters must be Latin script. This rejects Hindi,
//     Marathi, Tamil and other documents in their own scripts, but lets through an English contract
//     with a Devanagari heading or a party's name in Hindi.
//  2. Words. In Latin-script text, at least MIN_FUNCTION_WORD_SHARE of the words must be common English
//     function words ("the", "of", "shall", ...). English contract prose runs at roughly 30 to 45 per
//     cent; French, Spanish, German and romanised Hindi run near zero on this list, because it leaves
//     out words those languages share with English ("a", "in", "on", "is", "die", "an").
// Text too short to judge (under MIN_WORDS words) is not rejected on step 2.

const MIN_LATIN_SHARE = 0.7;
const MIN_FUNCTION_WORD_SHARE = 0.12;
const MIN_WORDS = 30;

const ENGLISH_FUNCTION_WORDS = new Set(
  (
    "the of and to shall this that with which will be by for or any such not from are have has been " +
    "its it upon under other than these those their they them was were would should must each if as " +
    "at all no into within without between whether hereby herein thereof where when who whom whose " +
    "being only also may can our we you your he she his her"
  ).split(" "),
);

export function looksEnglish(text) {
  const letters = String(text).match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return true;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  if (latin / letters.length < MIN_LATIN_SHARE) return false;

  const words = String(text).toLowerCase().match(/\p{Script=Latin}+(?:'\p{Script=Latin}+)?/gu) ?? [];
  if (words.length < MIN_WORDS) return true;
  const common = words.filter((w) => ENGLISH_FUNCTION_WORDS.has(w)).length;
  return common / words.length >= MIN_FUNCTION_WORD_SHARE;
}
