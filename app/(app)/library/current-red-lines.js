import "server-only";

import { forReview, loadRedLines } from "../../../lib/library/red-lines.js";

// The Reviewer's current Red lines, to compare saved reviews against (OQ17). Null when they cannot be
// loaded, so the library still opens and simply marks nothing.
export async function currentRedLinesOrNull(db) {
  try {
    return forReview((await loadRedLines({ db })).redLines);
  } catch (err) {
    console.error(err);
    return null;
  }
}
