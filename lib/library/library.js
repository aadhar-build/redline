import "server-only";

import { ask } from "../review/ask.js";
import { MAX_DOCUMENT_LENGTH, review, ReviewInputError } from "../review/review.js";
import { isSavable, reopenReview, toStoredReview } from "../review/saved.js";
import { readOcrRanges } from "../review/unreadable-amount.js";
import { readScannedPages } from "../review/scanned-pages.js";
import { storedWithMark } from "../review/outside-references.js";
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
 * Null when the document is not this account's.
 * @returns {Promise<null | { review: object, documentId: string, saved: boolean }>}
 */
export async function rerunSaved({ db, documentId, redLines = [], adapter }) {
  const stored = await loadDocument(db, documentId);
  if (!stored) return null;
  const result = await review({
    documentText: stored.extracted_text,
    redLines,
    adapter,
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

const REVIEW_COLUMNS = "id, summary, flags, withheld_count, withheld, red_lines, outside_references, created_at";

async function latestReview(db, documentId) {
  const { data, error } = await db
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new LibraryError("load-failed", error.message);
  return data;
}

/**
 * The Reviewer marks one Outside reference on a saved document's latest review as reviewed, or takes
 * the mark back (ticket 13). The mark is stored as the Reviewer's statement with the time they made it;
 * Redline checks nothing about the referenced document. The reference is named by its Source sentence
 * as shown. Never calls the model. Row Level Security decides which rows this account can read and
 * update, so another account's document reads as not found.
 * @returns {Promise<null | { review: object, documentId: string }>} null when the document, its review
 *   or that reference is not this account's.
 */
export async function markOutsideReference({ db, documentId, sourceSentence, reviewed, now = new Date() }) {
  const doc = await loadDocument(db, documentId);
  if (!doc) return null;
  const row = await latestReview(db, doc.id);
  if (!row) return null;
  // Found again from the stored text, exactly as the Reviewer sees the review, so the mark lands on a
  // reference they were shown.
  const current = reopenReview({ documentText: doc.extracted_text, stored: row });
  const outside = storedWithMark(current.outsideReferences, sourceSentence, reviewed, now.toISOString());
  if (!outside) return null;
  const updated = await db.from("reviews").update({ outside_references: outside }).eq("id", row.id).select("id");
  if (updated.error) throw new LibraryError("save-failed", updated.error.message);
  if (!updated.data || updated.data.length !== 1) return null;
  return {
    review: reopenReview({ documentText: doc.extracted_text, stored: { ...row, outside_references: outside } }),
    documentId: doc.id,
  };
}

/**
 * Opens a saved document and its latest review, without calling the model: there is no adapter here.
 * Null when the document is not this account's. currentRedLines as for listDocuments.
 */
export async function openSaved({ db, documentId, currentRedLines = null }) {
  const doc = await loadDocument(db, documentId);
  if (!doc) return null;
  const data = await latestReview(db, doc.id);
  return {
    document: { id: doc.id, title: doc.title, sourceKind: doc.source_kind, savedAt: doc.created_at },
    review: data ? reopenReview({ documentText: doc.extracted_text, stored: data, ocrRanges: doc.ocr_ranges, ocrPages: doc.ocr_pages, pageCount: doc.page_count }) : null,
    reviewedAt: data?.created_at ?? null,
    olderRedLines: data ? olderList(data.red_lines, currentRedLines) : null,
  };
}
