// Referenced documents (ticket 18, ADR 0007, spec-gaps 14): the text of a document an Outside reference
// brings in, added by the Reviewer against that reference. It is reviewed together with the document
// that referenced it, as one review, against the same Red lines. Each flag cites sentences from one of
// the texts and is checked against that text alone, never against the texts joined together.
//
// Text and code only, with no server imports, so Review and reopening a saved review share it.

import { normalise } from "./normalise.js";
import { findOutsideReferences } from "./outside-references.js";
import { readOcrRanges } from "./unreadable-amount.js";
import { documentNumbers } from "./wording.js";

// The key the model gives for the uploaded document itself; referenced ones are "R1", "R2", ...
export const MAIN_DOCUMENT = "main";

const sentenceKey = (s) => normalise(String(s ?? "")).trim();

/**
 * The texts of one review: the document itself first, then each referenced document in the order
 * given. Each has its own numbers and OCR ranges, so every check on a flag uses the text it cites.
 * Ranges that do not fit a referenced text mark all of it as OCR text, erring toward withholding.
 * @param {string} documentText
 * @param {[number, number][]} ocr The main text's checked OCR ranges.
 * @param {{ id: string, title?: string, text: string, referenceSentence: string, ocrRanges?: unknown }[]} referenced
 */
export function reviewTexts(documentText, ocr, referenced = []) {
  const texts = [{ key: MAIN_DOCUMENT, index: 0, id: null, title: null, referenceSentence: null, text: documentText, numbers: documentNumbers(documentText), ocr }];
  (Array.isArray(referenced) ? referenced : []).forEach((r, i) => {
    const text = String(r.text);
    texts.push({
      key: `R${i + 1}`,
      index: i + 1,
      id: r.id,
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : null,
      referenceSentence: r.referenceSentence,
      text,
      numbers: documentNumbers(text),
      ocr: readOcrRanges(r.ocrRanges ?? [], text.length) ?? [[0, text.length]],
    });
  });
  return texts;
}

/** The text a flag cites, by the key the model gave (missing means the document itself), or null. */
export function textFor(texts, key) {
  if (key == null) return texts[0];
  if (typeof key !== "string") return null;
  return texts.find((t) => t.key === key.trim()) ?? null;
}

/** The text a stored flag cites, by its stored referenced document id (null means the document itself). */
export function textForId(texts, id) {
  if (id == null) return texts[0];
  return texts.find((t) => t.id !== null && t.id === id) ?? null;
}

/** What a flag shows about the referenced document it came from, or null for the document itself. */
export const referencedDocumentOf = (t) => (t && t.id !== null ? { id: t.id, title: t.title, index: t.index } : null);

/** The prompt part that hands the model the referenced texts. Empty when there are none. */
export function referencedPromptPart(texts) {
  const referenced = texts.slice(1);
  if (referenced.length === 0) return [];
  return [
    "",
    "The document refers to other documents, and the Reviewer has added them below. Review them together with the document, as one review, for the same Owner and against the same Red lines.",
    '- Give each risk flag "document": "main" when its sourceSentences come from the document, or the id of the referenced document they come from (for example "R1"). All sourceSentences of one flag come from that one text.',
    ...referenced.flatMap((t) => ["", `<referenced-document id="${t.key}">`, t.text, "</referenced-document>"]),
  ];
}

/**
 * Marks each Outside reference that a referenced text was added against, and resolves it when nothing
 * else keeps it open. A reference is named by any of its Source sentences, so this reads the same whether
 * a reference has one sentence or several. A Red line match (an "as amended" reference) stays unresolved:
 * adding today's version of the terms does not stop them changing (ADR 0004, ADR 0007).
 */
export function withReferencedDocuments(outsideReferences, texts) {
  const referenced = texts.slice(1);
  return outsideReferences.map((r) => {
    const sentences = new Set(r.sourceSentences.map((s) => sentenceKey(s.text)));
    const t = referenced.find((x) => sentences.has(sentenceKey(x.referenceSentence)));
    if (!t) return { ...r, referencedDocument: null };
    return {
      ...r,
      referencedDocument: referencedDocumentOf(t),
      resolved: r.resolved === true || (r.redLineMatch === null && r.severity === "negotiate"),
    };
  });
}

/**
 * Sentences in a referenced text that bring in yet another document. Redline has not read that one
 * either, so each blocks a Clean result (ADR 0007). Found with the same patterns and Source sentence
 * check; one that cannot be cited is counted in failed, and blocks too.
 */
export function referencesInReferenced(texts) {
  const found = [];
  let failed = 0;
  for (const t of texts.slice(1)) {
    const r = findOutsideReferences(t.text);
    failed += r.failed;
    for (const f of r.found) found.push({ referencedDocument: referencedDocumentOf(t), kinds: f.kinds, sourceSentences: f.sourceSentences });
  }
  return { found, failed };
}

/** Whether a sentence is one of the Outside references a referenced text can be added against. */
export function canAttachTo(outsideReferences, referenceSentence) {
  const k = sentenceKey(referenceSentence);
  if (!k) return null;
  return (
    (Array.isArray(outsideReferences) ? outsideReferences : []).find(
      (r) => r.sourceSentences.some((s) => sentenceKey(s.text) === k) && r.kinds.some((x) => x !== "as-amended"),
    ) ?? null
  );
}

/** The Source sentence of a reference that matches the Reviewer's choice, as cut from the stored text. */
export function matchingSentence(reference, referenceSentence) {
  const k = sentenceKey(referenceSentence);
  return reference.sourceSentences.find((s) => sentenceKey(s.text) === k)?.text ?? null;
}
