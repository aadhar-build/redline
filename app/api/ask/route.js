import { getModelAdapter } from "../../../lib/review/adapters/index.js";
import { ask } from "../../../lib/review/ask.js";
import { ReviewInputError } from "../../../lib/review/review.js";
import { askAboutSaved } from "../../../lib/library/library.js";
import { currentAccount } from "../../../lib/supabase/server.js";

// Server-side only. The browser never sees or calls the model adapter.
//
// A saved document is asked about by its id: the server reads its text from the database and answers
// and checks Source sentences against that stored text. Any text the browser also sends is ignored.
// A document that is not the signed-in account's, or no account at all, reads as not found; there is
// no fallback to posted text. An unsaved paste (signed out) still posts its text.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status) => Response.json(body, { status });

export async function POST(request) {
  const adapter = getModelAdapter();
  if (!adapter) return json({ error: "unavailable" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "empty-question" }, 400);
  }

  try {
    if (body?.documentId != null) {
      const { db, user } = await currentAccount();
      if (!user) return json({ error: "not-found" }, 404);
      const answer = await askAboutSaved({ db, documentId: body.documentId, question: body?.question, adapter });
      if (answer === null) return json({ error: "not-found" }, 404);
      return json({ answer }, 200);
    }
    const answer = await ask({ documentText: body?.text, question: body?.question, adapter });
    return json({ answer }, 200);
  } catch (err) {
    if (err instanceof ReviewInputError) return json({ error: err.code }, 400);
    if (err?.code === "no-script") return json({ error: "no-script" }, 422);
    console.error(err);
    return json({ error: "failed" }, 502);
  }
}
