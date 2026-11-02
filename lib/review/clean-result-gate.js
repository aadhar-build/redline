// The gate on the Clean result (ticket 11, settled by the Fable advisor 2026-10-31).
//
// cleanResultOf (review.js) decides whether a review is a Clean result. Outside references (ticket 13)
// and Ambiguous clauses (ticket 07) are both found now and block it, so the gate is lifted:
// CLEAN_RESULT_READY is true and cleanResult comes straight from cleanResultOf.
//
// Text only, with no server imports.

export const CLEAN_RESULT_READY = true;

/**
 * @param {boolean | null} computed What cleanResultOf decided.
 * @returns {{ cleanResult: boolean | null, cleanResultHeld: boolean }}
 * cleanResultHeld is true only when the rule would have given a Clean result and the gate held it back.
 */
export function gateCleanResult(computed, ready = CLEAN_RESULT_READY) {
  if (ready) return { cleanResult: computed, cleanResultHeld: false };
  return { cleanResult: null, cleanResultHeld: computed === true };
}
