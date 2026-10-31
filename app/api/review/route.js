import { getModelAdapter } from "../../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../../lib/review/red-lines.js";
import { review, ReviewInputError } from "../../../lib/review/review.js";

// Server-side only. The browser posts extracted text here; it never sees or calls the model adapter.
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
    return json({ error: "empty-document" }, 400);
  }

  try {
    // Until the Reviewer can edit and save Red lines (ticket 12), every review runs against the defaults.
    const result = await review({ documentText: body?.text, redLines: DEFAULT_RED_LINES, adapter });
    return json({ review: result }, 200);
  } catch (err) {
    if (err instanceof ReviewInputError) return json({ error: err.code }, 400);
    if (err?.code === "no-script") return json({ error: "no-script" }, 422);
    console.error(err);
    return json({ error: "failed" }, 502);
  }
}
