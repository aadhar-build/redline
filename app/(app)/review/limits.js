// QUESTIONS.md 40 (settled by Fable advisor, 2026-10-31): the contract and its added documents share one
// cap. Plain code, safe to import from client code and from tests.

import { MAX_TEXT_LENGTH } from "../../../lib/extraction/result.js";

// A fixed locale, so the server and the browser write the number the same way.
const GROUPING = new Intl.NumberFormat("en-US");

/** The characters left under the cap, rounded down so it never reads as more than there is. */
export function charactersLeft(used) {
  const left = Math.max(0, MAX_TEXT_LENGTH - used);
  return GROUPING.format(left >= 1000 ? Math.floor(left / 1000) * 1000 : left);
}
