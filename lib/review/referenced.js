// Referenced documents (ticket 18, ADR 0007, spec-gaps 14): the text of a document an Outside reference
// brings in, added by the Reviewer against that reference. It is reviewed together with the document
// that referenced it, as one review, against the same Red lines. Each flag cites sentences from one of
// the texts and is checked against that text alone, never against the texts joined together.
//
// Text and code only, with no server imports, so Review and reopening a saved review share it.

import { normalise } from "./normalise.js";
import { assembleOutsideReferences, markKey, mergeIntoOutsideReferences } from "./outside-references.js";
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
  const texts = [{ key: MAIN_DOCUMENT, index: 0, id: null, title: null, referenceSentence: null, inReferencedDocumentId: null, text: documentText, numbers: documentNumbers(documentText), ocr }];
  (Array.isArray(referenced) ? referenced : []).forEach((r, i) => {
    const text = String(r.text);
    texts.push({
      key: `R${i + 1}`,
      index: i + 1,
      id: r.id,
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : null,
      referenceSentence: r.referenceSentence,
      // QUESTIONS.md 36: the added document whose reference this text was added against, or null when
      // it was added against one of the contract's own references.
      inReferencedDocumentId: typeof r.inReferencedDocumentId === "string" ? r.inReferencedDocumentId : null,
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
 * Marks each Outside reference that a referenced text was added against (addedDocument), and resolves it
 * when nothing else keeps it open. A reference is named by any of its Source sentences and by the text it
 * sits in (QUESTIONS.md 36), so the same sentence in the contract and in an added document are two
 * references. A Red line match (an "as amended" reference) stays unresolved: adding today's version of
 * the terms does not stop them changing (ADR 0004, ADR 0007, QUESTIONS.md 39).
 */
export function withReferencedDocuments(outsideReferences, texts) {
  const referenced = texts.slice(1);
  return outsideReferences.map((r) => {
    const sentences = new Set(r.sourceSentences.map((s) => sentenceKey(s.text)));
    const inId = r.referencedDocument?.id ?? null;
    const t = referenced.find((x) => x.inReferencedDocumentId === inId && sentences.has(sentenceKey(x.referenceSentence)));
    if (!t) return { ...r, addedDocument: null };
    return {
      ...r,
      addedDocument: referencedDocumentOf(t),
      resolved: r.resolved === true || (r.redLineMatch === null && r.severity === "negotiate"),
    };
  });
}

/**
 * The Outside references of a whole review (QUESTIONS.md 36, settled by Fable advisor, 2026-10-31): the
 * contract's own, then each added document's, in the order of the texts, numbered on from one. Each says
 * which text it sits in (referencedDocument, null for the contract) and is found and checked against that
 * text alone, with the same severity rules. An added text's schedules count as present when the contract
 * has their heading (QUESTIONS.md 42).
 *
 * A flag that only repeats a Red line 3 reference is merged into it (QUESTIONS.md 31) only when both sit
 * in the same text.
 * @param {{ texts: object[], redLines: object[], flags: object[], own: (text: string) => Function, parties?: string[], modelReferences?: unknown, stored?: unknown, previousMarks?: Map<string, { at: string }> | null }} input
 */
export function outsideReferencesFor({ texts, redLines, flags, own, parties = [], modelReferences = null, stored = null, previousMarks = null }) {
  const storedList = Array.isArray(stored) ? stored : null;
  const all = [];
  const withheld = [];
  const kept = [];
  let mergedCount = 0;
  for (const t of texts) {
    const prefix = markKey(t.id, "");
    const marks = previousMarks instanceof Map
      ? new Map([...previousMarks].filter(([k]) => k.startsWith(prefix)).map(([k, m]) => [k.slice(prefix.length), m]))
      : null;
    const refs = assembleOutsideReferences({
      documentText: t.text,
      redLines,
      modelReferences: t.index === 0 ? modelReferences : null,
      stored: storedList ? storedList.filter((s) => (typeof s?.referenced_document_id === "string" ? s.referenced_document_id : null) === t.id) : null,
      own: own(t.text),
      parties,
      parentText: t.index === 0 ? null : texts[0].text,
      previousMarks: marks,
    });
    withheld.push(...refs.withheld);
    const located = refs.outsideReferences.map((r) => ({ ...r, referencedDocument: referencedDocumentOf(t) }));
    const merged = mergeIntoOutsideReferences(flags.filter((f) => (f.referencedDocument?.id ?? null) === t.id), located);
    kept.push(...merged.flags);
    mergedCount += merged.mergedCount;
    all.push(...located);
  }
  const numbered = all.map((r, i) => ({ ...r, number: i + 1 }));
  return { outsideReferences: withReferencedDocuments(numbered, texts), withheld, flags: kept, mergedCount };
}

/**
 * Whether a sentence is one of the Outside references a referenced text can be added against. inDocumentId
 * names the text the reference sits in: null for the contract, or an added document's id (QUESTIONS.md 36).
 */
export function canAttachTo(outsideReferences, referenceSentence, inDocumentId = null) {
  const k = sentenceKey(referenceSentence);
  if (!k) return null;
  return (
    (Array.isArray(outsideReferences) ? outsideReferences : []).find(
      (r) =>
        (r.referencedDocument?.id ?? null) === (inDocumentId ?? null) &&
        r.sourceSentences.some((s) => sentenceKey(s.text) === k) &&
        r.kinds.some((x) => x !== "as-amended"),
    ) ?? null
  );
}

/** The Source sentence of a reference that matches the Reviewer's choice, as cut from the stored text. */
export function matchingSentence(reference, referenceSentence) {
  const k = sentenceKey(referenceSentence);
  return reference.sourceSentences.find((s) => sentenceKey(s.text) === k)?.text ?? null;
}
