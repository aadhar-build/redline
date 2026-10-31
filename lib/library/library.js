import "server-only";

import { ask } from "../review/ask.js";
import { MAX_DOCUMENT_LENGTH, review, ReviewInputError } from "../review/review.js";
import { isSavable, reopenReview, toStoredReview } from "../review/saved.js";
import { readOcrRanges } from "../review/unreadable-amount.js";
import { readScannedPages } from "../review/scanned-pages.js";
import { storedWithMark } from "../review/outside-references.js";
import { canAttachTo, matchingSentence } from "../review/referenced.js";
import { looksEnglish } from "../extraction/language.js";
import { sameRedLineList } from "./red-lines.js";

// The saved library (ticket 10): each signed-in account's documents and their reviews.
//
// Every function takes `db`, a Supabase client signed in as the Reviewer with the public anon key.
// Row Level Security decides what that account can see; nothing here filters by owner itself, and
// nothing here ever uses the service-role key. Another account's document reads as not found.
//
// The trust rule: once a document is saved, the text the review and the question box check against is
// the extracted text read back from the database by document id, never text the browser sent.

export class LibraryError extends Error {
  constructor(code, message) {
    super(`redline-library: ${message}`);
    this.name = "LibraryError";
    this.code = code;
  }
}

// Extraction's source ("pdf", "docx" or "paste", lib/extraction/result.js) as the documents.source_kind
// value. Anything else is stored as pasted text: the browser's claim can only pick among the three.
export function sourceKindFrom(source) {
  if (source === "pdf" || source === "docx") return source;
  return "pasted";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The first line of the document, as written, shortened to a list-sized title.
export function titleFrom(documentText) {
  const line = String(documentText).split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

async function loadDocument(db, documentId) {
  if (typeof documentId !== "string" || !UUID.test(documentId)) return null;
  const { data, error } = await db
    .from("documents")
    .select("id, title, source_kind, extracted_text, ocr_ranges, ocr_pages, page_count, created_at")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new LibraryError("load-failed", error.message);
  return data;
}

// Ticket 18: the referenced documents added to a saved document, oldest first, read under Row Level
// Security, as Review takes them.
async function loadReferenced(db, documentId) {
  const { data, error } = await db
    .from("referenced_documents")
    .select("id, title, reference_sentence, extracted_text, ocr_ranges, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new LibraryError("load-failed", error.message);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, referenceSentence: r.reference_sentence, text: r.extracted_text, ocrRanges: r.ocr_ranges }));
}

async function removeDocument(db, documentId) {
  await db.from("documents").delete().eq("id", documentId);
}

/**
 * Saves the text (and where OCR read it, ADR 0008), reads both back by id, reviews the stored text and
 * saves the review with its withheld count. A review that is not complete (summary withheld, Risk flags unreadable) is returned but not
 * kept, and the document is removed again, so the library only lists documents it can reopen.
 * @returns {Promise<{ review: object, documentId: string | null }>}
 */
export async function saveAndReview({ db, text, sourceKind = "pasted", redLines = [], adapter, ownerParty = null, ocrRanges = [], ocrPages = [], pageCount = null }) {
  const documentText = typeof text === "string" ? text : "";
  // Review's own input rules, checked first, so text Review would refuse is never stored.
  if (documentText.trim().length === 0) throw new ReviewInputError("empty-document", "the document text is empty");
  if (documentText.length > MAX_DOCUMENT_LENGTH) {
    throw new ReviewInputError("document-too-long", "the document text is too long");
  }
  // OCR ranges only come with a PDF's text.
  const ocr = sourceKind === "pdf" ? readOcrRanges(ocrRanges, documentText.length) : readOcrRanges(ocrRanges, 0);
  if (ocr === null || (sourceKind !== "pdf" && ocr.length > 0)) {
    throw new ReviewInputError("bad-ocr-ranges", "the OCR ranges are not valid for this text");
  }
  const scanned = readScannedPages(ocrPages, pageCount);
  if (scanned === null || (sourceKind !== "pdf" && scanned.pages.length > 0)) {
    throw new ReviewInputError("bad-ocr-pages", "the OCR pages are not valid");
  }

  const inserted = await db
    .from("documents")
    .insert({ title: titleFrom(documentText), source_kind: sourceKind, extracted_text: documentText, ocr_ranges: ocr, ocr_pages: scanned.pages, page_count: scanned.pages.length > 0 ? scanned.pageCount : null })
    .select("id")
    .single();
  if (inserted.error) throw new LibraryError("save-failed", inserted.error.message);
  const documentId = inserted.data.id;

  let result;
  try {
    const stored = await loadDocument(db, documentId);
    if (!stored) throw new LibraryError("load-failed", "the saved document could not be read back");
    // The ranges read back from the database, never the ones the browser sent.
    result = await review({ documentText: stored.extracted_text, redLines, adapter, ownerParty,
      ocrRanges: stored.ocr_ranges,
      ocrPages: stored.ocr_pages,
      pageCount: stored.page_count,
    });
  } catch (err) {
    await removeDocument(db, documentId);
    throw err;
  }

  if (!isSavable(result)) {
    await removeDocument(db, documentId);
    return { review: result, documentId: null };
  }

  const saved = await db.from("reviews").insert({ document_id: documentId, ...toStoredReview(result) });
  if (saved.error) {
    await removeDocument(db, documentId);
    throw new LibraryError("save-failed", saved.error.message);
  }
  return { review: result, documentId };
}

/**
 * Reviews a saved document's stored text again, against the Red lines given (the Reviewer's current
 * list), and saves the result as a new review of the same document. The earlier reviews are kept. Only
 * the Reviewer starts this (OQ17: no automatic re-analysis). Unlike saveAndReview, nothing is ever
 * removed: a re-run that fails or is incomplete saves nothing and leaves the document and its earlier
 * reviews as they were.
 * ownerParty: the Owner the Reviewer chose with Change (ticket 24), or null to let Review work it out.
 * Null when the document is not this account's.
 * @returns {Promise<null | { review: object, documentId: string, saved: boolean }>}
 */
export async function rerunSaved({ db, documentId, redLines = [], adapter, ownerParty = null }) {
  const stored = await loadDocument(db, documentId);
  if (!stored) return null;
  const result = await review({
    // Ticket 18: every referenced document added to it is reviewed together with it again.
    referencedDocuments: await loadReferenced(db, stored.id),
    documentText: stored.extracted_text,
    redLines,
    adapter,
    // Ticket 24 ruling 23(a): Change on a saved document re-runs it with that party as the Owner.
    ownerParty,
    ocrRanges: stored.ocr_ranges,
    ocrPages: stored.ocr_pages,
    pageCount: stored.page_count,
  });
  if (!isSavable(result)) return { review: result, documentId: stored.id, saved: false };
  const saved = await db.from("reviews").insert({ document_id: stored.id, ...toStoredReview(result) });
  if (saved.error) throw new LibraryError("save-failed", saved.error.message);
  return { review: result, documentId: stored.id, saved: true };
}

// Whether a review was checked against a list other than the Reviewer's current one (OQ17). Null when
// the current list is not known, so nothing is marked on a guess.
function olderList(storedRedLines, currentRedLines) {
  if (!Array.isArray(currentRedLines)) return null;
  return !sameRedLineList(storedRedLines, currentRedLines);
}

/** Answers a question from a saved document's stored text. Null when the document is not this account's. */
export async function askAboutSaved({ db, documentId, question, adapter }) {
  const stored = await loadDocument(db, documentId);
  if (!stored) return null;
  return ask({ documentText: stored.extracted_text, question, adapter });
}

/**
 * The account's saved documents, newest first, with what the list shows of each one's latest review.
 * currentRedLines (the list forReview returns): when given, each document says whether its latest
 * review was checked against an older list.
 */
export async function listDocuments({ db, currentRedLines = null }) {
  const { data, error } = await db
    .from("documents")
    .select("id, title, source_kind, created_at, reviews(flags, withheld_count, red_lines, created_at)")
    .order("created_at", { ascending: false });
  if (error) throw new LibraryError("load-failed", error.message);
  return data.map((d) => {
    const latest = [...(d.reviews ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: d.id,
      title: d.title,
      sourceKind: d.source_kind,
      savedAt: d.created_at,
      flagCount: latest ? latest.flags.length : null,
      olderRedLines: latest ? olderList(latest.red_lines, currentRedLines) : null,
    };
  });
}

const REVIEW_COLUMNS = "id, summary, flags, withheld_count, withheld, red_lines, outside_references, owner_party, owner_fixed, judgments_dropped, referenced_document_ids, created_at";

async function latestReview(db, documentId) {
  const { data, error } = await db
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new LibraryError("load-failed", error.message);
  return data;
}

/**
 * The Reviewer marks one Outside reference on a saved document's latest review as reviewed, or takes
 * the mark back (ticket 13). The mark is stored as the Reviewer's statement with the time they made it;
 * Redline checks nothing about the referenced document. The reference is named by its Source sentence
 * as shown, or by its key (which tells apart two references that share a sentence); the mark covers
 * every sentence of the reference. Never calls the model. Row Level Security decides which rows this account can read and
 * update, so another account's document reads as not found.
 * @returns {Promise<null | { review: object, documentId: string }>} null when the document, its review
 *   or that reference is not this account's.
 */
export async function markOutsideReference({ db, documentId, sourceSentence, referenceKey = null, reviewed, now = new Date() }) {
  const doc = await loadDocument(db, documentId);
  if (!doc) return null;
  const row = await latestReview(db, doc.id);
  if (!row) return null;
  // Found again from the stored text, exactly as the Reviewer sees the review, so the mark lands on a
  // reference they were shown.
  const referencedDocuments = await loadReferenced(db, doc.id);
  const current = reopenReview({ documentText: doc.extracted_text, stored: row, referencedDocuments });
  const outside = storedWithMark(current.outsideReferences, sourceSentence, reviewed, now.toISOString(), referenceKey);
  if (!outside) return null;
  const updated = await db.from("reviews").update({ outside_references: outside }).eq("id", row.id).select("id");
  if (updated.error) throw new LibraryError("save-failed", updated.error.message);
  if (!updated.data || updated.data.length !== 1) return null;
  return {
    review: reopenReview({ documentText: doc.extracted_text, stored: { ...row, outside_references: outside }, referencedDocuments }),
    documentId: doc.id,
  };
}

/**
 * Opens a saved document and one of its reviews, without calling the model: there is no adapter here.
 * reviewId (ticket 24 ruling 24): an earlier review of this document, opened read-only through the same
 * reopen path; omitted, the latest. Null when the document, or that review of it, is not this account's.
 * history lists the document's reviews newest first, the first one marked latest. currentRedLines as
 * for listDocuments.
 */
export async function openSaved({ db, documentId, currentRedLines = null, reviewId = null }) {
  const doc = await loadDocument(db, documentId);
  if (!doc) return null;
  const { data: rows, error } = await db
    .from("reviews")
    .select("id, flags, red_lines, created_at")
    .eq("document_id", doc.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new LibraryError("load-failed", error.message);
  const history = (rows ?? []).map((r, i) => ({
    id: r.id,
    reviewedAt: r.created_at,
    flagCount: Array.isArray(r.flags) ? r.flags.length : 0,
    olderRedLines: olderList(r.red_lines, currentRedLines),
    latest: i === 0,
  }));
  let data;
  if (reviewId == null) {
    data = history.length > 0 ? await reviewById(db, doc.id, history[0].id) : null;
  } else {
    if (typeof reviewId !== "string" || !UUID.test(reviewId)) return null;
    data = await reviewById(db, doc.id, reviewId);
    if (!data) return null;
  }
  return {
    document: { id: doc.id, title: doc.title, sourceKind: doc.source_kind, savedAt: doc.created_at },
    review: data
      ? reopenReview({ documentText: doc.extracted_text, stored: data, ocrRanges: doc.ocr_ranges, ocrPages: doc.ocr_pages, pageCount: doc.page_count,
          referencedDocuments: await loadReferenced(db, doc.id) })
      : null,
    reviewId: data?.id ?? null,
    reviewedAt: data?.created_at ?? null,
    latest: data ? data.id === history[0]?.id : false,
    olderRedLines: data ? olderList(data.red_lines, currentRedLines) : null,
    history,
  };
}

// One review, only if it is of this document. Row Level Security hides another account's.
async function reviewById(db, documentId, reviewId) {
  const { data, error } = await db
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("document_id", documentId)
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw new LibraryError("load-failed", error.message);
  return data;
}

/**
 * Ticket 18 (ADR 0007, spec-gaps 14): the Reviewer adds the text of a document an Outside reference brings
 * in. The reference is named by its Source sentence, as shown on the saved document's latest review, and
 * must be one that names a document ("as amended from time to time" alone names none). The text is
 * saved for the same account, then the saved document is reviewed again together with every referenced
 * text added to it, as one review, and that review is saved as a new review of the document.
 *
 * Fails closed: if the review fails or is not complete, the added text is removed again and nothing is
 * saved, so the reference stays unresolved. Only the Reviewer starts this. Null when the document, its
 * review or that reference is not this account's.
 * @returns {Promise<null | { review: object, documentId: string, saved: boolean }>}
 */
export async function addReferencedDocument({ db, documentId, referenceSentence, text, sourceKind = "pasted", ocrRanges = [], ocrPages = [], pageCount = null, redLines = [], adapter }) {
  const doc = await loadDocument(db, documentId);
  if (!doc) return null;
  const row = await latestReview(db, doc.id);
  if (!row) return null;
  const existing = await loadReferenced(db, doc.id);
  const current = reopenReview({ documentText: doc.extracted_text, stored: row, referencedDocuments: existing });
  const reference = canAttachTo(current.outsideReferences, referenceSentence);
  if (!reference) return null;
  if (reference.referencedDocument) throw new ReviewInputError("already-added", "a document was already added for this reference");

  const t = typeof text === "string" ? text : "";
  if (t.trim().length === 0) throw new ReviewInputError("empty-document", "the document text is empty");
  if (t.length > MAX_DOCUMENT_LENGTH) throw new ReviewInputError("document-too-long", "the document text is too long");
  if (!looksEnglish(t)) throw new ReviewInputError("not-english", "the document is not in English");
  const ocr = sourceKind === "pdf" ? readOcrRanges(ocrRanges, t.length) : readOcrRanges(ocrRanges, 0);
  if (ocr === null || (sourceKind !== "pdf" && ocr.length > 0)) throw new ReviewInputError("bad-ocr-ranges", "the OCR ranges are not valid for this text");
  const scanned = readScannedPages(ocrPages, pageCount);
  if (scanned === null || (sourceKind !== "pdf" && scanned.pages.length > 0)) throw new ReviewInputError("bad-ocr-pages", "the OCR pages are not valid");

  const inserted = await db
    .from("referenced_documents")
    .insert({
      document_id: doc.id,
      // The sentence as shown, read from the stored text, never the browser's string.
      reference_sentence: matchingSentence(reference, referenceSentence),
      title: titleFrom(t),
      source_kind: sourceKind,
      extracted_text: t,
      ocr_ranges: ocr,
      ocr_pages: scanned.pages,
      page_count: scanned.pages.length > 0 ? scanned.pageCount : null,
    })
    .select("id")
    .single();
  if (inserted.error) throw new LibraryError("save-failed", inserted.error.message);
  const addedId = inserted.data.id;
  const remove = () => db.from("referenced_documents").delete().eq("id", addedId);

  try {
    // Read back from the database, so the review runs on the stored text, never the posted one.
    const referencedDocuments = await loadReferenced(db, doc.id);
    if (!referencedDocuments.some((r) => r.id === addedId)) throw new LibraryError("load-failed", "the added document could not be read back");
    const owner = row.owner_fixed === true && typeof row.owner_party === "string" ? row.owner_party : null;
    const result = await review({
      documentText: doc.extracted_text,
      redLines,
      adapter,
      ownerParty: owner,
      ocrRanges: doc.ocr_ranges,
      ocrPages: doc.ocr_pages,
      pageCount: doc.page_count,
      referencedDocuments,
    });
    if (!isSavable(result)) {
      await remove();
      return { review: result, documentId: doc.id, saved: false };
    }
    const saved = await db.from("reviews").insert({ document_id: doc.id, ...toStoredReview(result) });
    if (saved.error) throw new LibraryError("save-failed", saved.error.message);
    return { review: result, documentId: doc.id, saved: true };
  } catch (err) {
    await remove();
    throw err;
  }
}
