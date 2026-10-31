// The gate on the Clean result (ticket 11, settled by the Fable advisor 2026-10-31).
//
// cleanResultOf (review.js) decides whether a review would be a Clean result. Outside references are
// found now (ticket 13), but Redline cannot yet find Ambiguous clauses (ticket 07), so that list is
// always empty and a Clean result could clear terms Redline never looked for (spec-gaps 15). Until
// ticket 07 lands, the Clean result is held back: cleanResult is null in fresh and reopened reviews,
// and cleanResultHeld tells the interface to say why.
//
// Remove this module, and set cleanResult from cleanResultOf directly, together with ticket 07.
// Ticket 13's half of the lifting condition is met: tests/unit/outside-references.test.js shows a
// no-flags fixture with Statement of Work, web address and Order Form references is not a Clean result
// until every reference is marked reviewed, and one with an "as amended" reference never is. Still
// needed (ticket 07): a no-flags fixture with one Ambiguous clause is not a Clean result.
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
