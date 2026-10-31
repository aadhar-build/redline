import { addRedLine, editRedLine, loadRedLines, RedLineError, removeRedLine } from "../../../lib/library/red-lines.js";
import { currentAccount } from "../../../lib/supabase/server.js";

// The signed-in Reviewer's Red lines (ticket 12). Server-side only, with the Reviewer's own session:
// Row Level Security limits every read and write to their rows. Never calls the model, so it works the
// same on Vercel. Every reply carries the whole list as it now stands.
//
// GET: the list (seeded with the four Default Red lines on first use).
// POST { text }: adds a Red line. PATCH { id, text }: rewords one. DELETE { id }: removes one.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status) => Response.json(body, { status });

const publicList = ({ redLines, removedDefaults }) => ({ redLines, removedDefaults });

async function withAccount(request, act) {
  const { db, user } = await currentAccount();
  if (!user) return json({ error: "signed-out" }, 401);
  let body = {};
  if (request.method !== "GET") {
    try {
      body = await request.json();
    } catch {
      return json({ error: "empty-red-line" }, 400);
    }
  }
  try {
    const list = await act(db, body ?? {});
    if (!list) return json({ error: "not-found" }, 404);
    return json(publicList(list), 200);
  } catch (err) {
    if (err instanceof RedLineError && ["empty-red-line", "red-line-too-long", "too-many-red-lines"].includes(err.code)) {
      return json({ error: err.code }, 400);
    }
    console.error(err);
    return json({ error: "failed" }, 502);
  }
}

export const GET = (request) => withAccount(request, (db) => loadRedLines({ db }));
export const POST = (request) => withAccount(request, (db, body) => addRedLine({ db, text: body.text }));
export const PATCH = (request) => withAccount(request, (db, body) => editRedLine({ db, rowId: body.id, text: body.text }));
export const DELETE = (request) => withAccount(request, (db, body) => removeRedLine({ db, rowId: body.id }));
