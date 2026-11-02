import { getModelAdapter } from "../../../lib/review/adapters/index.js";
import { guardModelRun } from "../../../lib/review/local-guard.js";
import { ReviewInputError } from "../../../lib/review/review.js";
import { addReferencedDocument, LibraryError, removeReferencedDocument, sourceKindFrom } from "../../../lib/library/library.js";
import { forReview, loadRedLines, RedLineError } from "../../../lib/library/red-lines.js";
import { currentAccount } from "../../../lib/supabase/server.js";

// Ticket 18: the Reviewer adds the text of a document an Outside reference brings in. Server-side only.
// The browser read the file and posts only its text. The text is saved to the Reviewer's account, and
// the saved document is reviewed again together with it as one review, so this calls the model: it goes
// through the same guard as /api/review and, like it, is unavailable where there is no adapter.
//
// POST { documentId, referenceSentence, inDocumentId?, text, source, ocrRanges, ocrPages, pageCount }
//   inDocumentId: the added document the reference sits in, or null for the contract (QUESTIONS.md 36).
// DELETE { documentId, referencedDocumentId }: removes an added document (QUESTIONS.md 37). This reviews
//   the document again with the remaining ones, so it calls the model and goes through the same guard.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status) => Response.json(body, { status });

export async function POST(request) {
  const adapter = getModelAdapter();
  if (!adapter) return json({ error: "unavailable" }, 503);
  return guardModelRun(request, adapter, () => handle(request, adapter));
}

export async function DELETE(request) {
  const adapter = getModelAdapter();
  if (!adapter) return json({ error: "unavailable" }, 503);
  return guardModelRun(request, adapter, () => handleRemove(request, adapter));
}

async function handleRemove(request, adapter) {
  const { db, user } = await currentAccount();
  if (!user) return json({ error: "signed-out" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  if (typeof body?.referencedDocumentId !== "string") return json({ error: "bad-request" }, 400);
  try {
    const { redLines } = await loadRedLines({ db });
    const removed = await removeReferencedDocument({ db, documentId: body.documentId, referencedDocumentId: body.referencedDocumentId, redLines: forReview(redLines), adapter });
    if (!removed) return json({ error: "not-found" }, 404);
    return json({ review: removed.review, documentId: removed.documentId, saved: removed.saved ? "saved" : "incomplete" }, 200);
  } catch (err) {
    return failure(err);
  }
}

function failure(err) {
  if (err instanceof ReviewInputError) return json({ error: err.code }, 400);
  if (err?.code === "no-script") return json({ error: "no-script" }, 422);
  console.error(err);
  if (err instanceof RedLineError) return json({ error: "red-lines-failed" }, 502);
  if (err instanceof LibraryError) return json({ error: "save-failed" }, 502);
  return json({ error: "failed" }, 502);
}

async function handle(request, adapter) {
  const { db, user } = await currentAccount();
  if (!user) return json({ error: "signed-out" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  if (typeof body?.referenceSentence !== "string") return json({ error: "bad-request" }, 400);
  if (body.inDocumentId != null && typeof body.inDocumentId !== "string") return json({ error: "bad-request" }, 400);
  try {
    const { redLines } = await loadRedLines({ db });
    const sourceKind = sourceKindFrom(body?.source);
    const added = await addReferencedDocument({
      db,
      documentId: body.documentId,
      referenceSentence: body.referenceSentence,
      inDocumentId: body.inDocumentId ?? null,
      text: body.text,
      sourceKind,
      ocrRanges: sourceKind === "pdf" ? body?.ocrRanges ?? [] : [],
      ocrPages: sourceKind === "pdf" ? body?.ocrPages ?? [] : [],
      pageCount: sourceKind === "pdf" ? body?.pageCount ?? null : null,
      redLines: forReview(redLines),
      adapter,
    });
    if (!added) return json({ error: "not-found" }, 404);
    return json({ review: added.review, documentId: added.documentId, saved: added.saved ? "saved" : "incomplete" }, 200);
  } catch (err) {
    return failure(err);
  }
}
