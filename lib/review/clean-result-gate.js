// The gate on the Clean result (ticket 11, settled by the Fable advisor 2026-10-31).
//
// cleanResultOf (review.js) decides whether a review would be a Clean result. Redline cannot yet find
// Outside references (ticket 13) or Ambiguous clauses (ticket 07), so both lists are always empty and
// a Clean result could clear terms Redline never looked for (ADR 0007, spec-gaps 15). Until both
// tickets land, the Clean result is held back: cleanResult is null in fresh and reopened reviews, and
// cleanResultHeld tells the interface to say why.
//
// Remove this module, and set cleanResult from cleanResultOf directly, together with tickets 13 and 07.
// Lift the gate only once a no-flags fixture with a Statement of Work, web address or "as amended"
// reference is not a Clean result until every reference is marked reviewed, and a no-flags fixture
// with one Ambiguous clause is not a Clean result.
//
// Text only, with no server imports.

export const CLEAN_RESULT_READY = false;

/**
 * @param {boolean | null} computed What cleanResultOf decided.
 * @returns {{ cleanResult: boolean | null, cleanResultHeld: boolean }}
 * cleanResultHeld is true only when the rule would have given a Clean result and the gate held it back.
 */
export function gateCleanResult(computed, ready = CLEAN_RESULT_READY) {
  if (ready) return { cleanResult: computed, cleanResultHeld: false };
  return { cleanResult: null, cleanResultHeld: computed === true };
}
