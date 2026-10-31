import { getModelAdapter } from "../../../lib/review/adapters/index.js";
import { guardModelRun } from "../../../lib/review/local-guard.js";
import { DEFAULT_RED_LINES } from "../../../lib/review/red-lines.js";
import { review, ReviewInputError } from "../../../lib/review/review.js";
import { LibraryError, saveAndReview, sourceKindFrom } from "../../../lib/library/library.js";
import { currentAccount } from "../../../lib/supabase/server.js";

// Server-side only. The browser posts extracted text here; it never sees or calls the model adapter.
//
// Signed in: the text is saved to the account first, read back by document id, and the review runs on
// that stored text and is saved with it (ticket 10). Signed out: the review runs on the posted text and
// nothing is saved.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status) => Response.json(body, { status });

export async function POST(request) {
  const adapter = getModelAdapter();
  if (!adapter) return json({ error: "unavailable" }, 503);
  // With the Claude Code CLI adapter, only same-origin requests to localhost run, one at a time.
  return guardModelRun(request, adapter, () => handle(request, adapter));
}

async function handle(request, adapter) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "empty-document" }, 400);
  }

  try {
    // Until the Reviewer can edit and save Red lines (ticket 12), every review runs against the defaults.
    // The Owner's side, when the Reviewer chose one with "Change" (ticket 22). Review checks it.
    const ownerParty = typeof body?.ownerParty === "string" ? body.ownerParty : null;
    const { db, user } = await currentAccount();
    if (user) {
      const { review: result, documentId } = await saveAndReview({
        db,
        text: body?.text,
        sourceKind: sourceKindFrom(body?.source),
        redLines: DEFAULT_RED_LINES,
        adapter,
        ownerParty,
      });
      return json({ review: result, documentId, saved: documentId ? "saved" : "incomplete" }, 200);
    }
    const result = await review({ documentText: body?.text, redLines: DEFAULT_RED_LINES, adapter, ownerParty });
    return json({ review: result, documentId: null, saved: "signed-out" }, 200);
  } catch (err) {
    if (err instanceof ReviewInputError) return json({ error: err.code }, 400);
    if (err?.code === "no-script") return json({ error: "no-script" }, 422);
    if (err instanceof LibraryError) {
      console.error(err);
      return json({ error: "save-failed" }, 502);
    }
    console.error(err);
    return json({ error: "failed" }, 502);
  }
}
