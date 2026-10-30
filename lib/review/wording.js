// The hedge-word and verdict-word check (ADR 0005, ADR 0006, PRD section 4 criterion 8).
//
// Redline's own text may not contain these words or phrases, matched whole-word and case-insensitive.
// Text reproduced word for word from the document is excluded: a hit is excused only when the
// quoted span or the sentence that contains it is found in the document text, after the ADR 0010
// normalisations. A bare quoted word is not excused, so quoting "may" on its own still counts.

import { normalise } from "./normalise.js";

export const BANNED_PHRASES = Object.freeze([
  // Hedge words (ADR 0005).
  "may",
  "could potentially",
  "consider consulting a lawyer",
  // Verdict words (ADR 0006).
  "safe",
  "fine",
  "good to sign",
]);

const WORD_CHAR = "[\\p{L}\\p{N}_]";

function phrasePattern(phrase) {
  const words = phrase.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<!${WORD_CHAR})${words.join("\\s+")}(?!${WORD_CHAR})`, "giu");
}

const PATTERNS = BANNED_PHRASES.map((phrase) => ({ phrase, re: phrasePattern(phrase) }));

// Spans between paired double quotes, straight or curly.
function quotedSpans(text) {
  const spans = [];
  const re = /\u201C([^\u201D]*)\u201D|"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const inner = m[1] ?? m[2];
    const start = m.index + 1;
    spans.push({ start, end: start + inner.length, text: inner });
  }
  return spans;
}

// Sentence spans. Splitting is deliberately simple: a wrong split only makes an excuse harder to earn.
function sentenceSpans(text) {
  const spans = [];
  const re = /[^.!?]+(?:[.!?]+|$)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!m[0].trim()) continue;
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return spans;
}

function wordCount(s) {
  return (s.match(new RegExp(`${WORD_CHAR}+`, "gu")) || []).length;
}

function excusedBy(span, hit, normalisedDocument) {
  if (hit.index < span.start || hit.index + hit.match.length > span.end) return false;
  // The span has to carry more than the banned phrase itself.
  if (wordCount(span.text) <= wordCount(hit.match)) return false;
  const needle = normalise(span.text);
  return needle.length > 0 && normalisedDocument.includes(needle);
}

/**
 * Finds banned hedge and verdict wording in Redline's own text.
 * @param {string} text Redline's text, such as a summary.
 * @param {{ documentText?: string }} [options] The stored document text, for the word-for-word exclusion.
 * @returns {{ phrase: string, match: string, index: number }[]} Every hit that is not excused, in text order.
 */
export function findBannedWording(text, { documentText = "" } = {}) {
  const source = String(text ?? "");
  const normalisedDocument = normalise(documentText);
  const quotes = quotedSpans(source);
  const sentences = sentenceSpans(source);

  const hits = [];
  for (const { phrase, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source))) {
      const hit = { phrase, match: m[0], index: m.index };
      const excused =
        normalisedDocument.length > 0 &&
        (quotes.some((s) => excusedBy(s, hit, normalisedDocument)) ||
          sentences.some((s) => excusedBy(s, hit, normalisedDocument)));
      if (!excused) hits.push(hit);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}
