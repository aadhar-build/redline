import { LibraryError, markOutsideReference } from "../../../lib/library/library.js";
import { currentAccount } from "../../../lib/supabase/server.js";

// The Reviewer marks an Outside reference on a saved review as reviewed, or takes the mark back
// (ticket 13). Server-side only, with the Reviewer's own session: Row Level Security limits the read
// and the update to their rows. Never calls the model and never fetches the referenced address, so it
// works the same on Vercel.
//
// POST { documentId, sourceSentence, reviewed }: replies with the saved review as reopened, so whether
// it is a Clean result is decided on the server, never in the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status) => Response.json(body, { status });

export async function POST(request) {
  const { db, user } = await currentAccount();
  if (!user) return json({ error: "signed-out" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  if (typeof body?.sourceSentence !== "string" || typeof body?.reviewed !== "boolean") {
    return json({ error: "bad-request" }, 400);
  }
  try {
    const marked = await markOutsideReference({
      db,
      documentId: body.documentId,
      sourceSentence: body.sourceSentence,
      reviewed: body.reviewed,
    });
    if (!marked) return json({ error: "not-found" }, 404);
    return json({ review: marked.review }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof LibraryError ? "save-failed" : "failed" }, 502);
  }
}
