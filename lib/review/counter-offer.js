// Counter-offers (tickets 08 and 17): replacement wording for a flagged clause that the Reviewer can
// send to the Counterparty. Every flag gets one, Know this included (spec-gaps 04).
//
// The rules (product owner, 2026-10-31, spec-gaps 03):
// - A Counter-offer may only restate or tighten terms already in the document; it adds no term the
//   document does not contain. Code cannot check that, so the prompt states it and a person reads the
//   output (PRD criterion 17).
// - The hedge-word and verdict-word ban covers the proposed wording too, so "may" is not allowed
//   ("Customer is entitled to…", not "Customer may…"). Only the two context exemptions apply: "fine"
//   next to an amount and "May" the month. The usual excuse for text reproduced word for word from the
//   document does not apply here, because a Counter-offer is wording the Owner would sign: a "may"
//   copied from the document is still a "may" in the proposed clause. A breach is marked, like the
//   summary, never withheld.
// - A number the document does not contain is marked too (ticket 22's check). It is not withheld,
//   because tightening a term can legitimately change a figure. Whether a changed figure is closer to
//   the Owner's interest depends on the clause (a lower fee helps the Owner, a lower cap on the
//   Counterparty's liability hurts), so code does not judge it (QUESTIONS 24, settled by Fable advisor
//   2026-10-31). Only numbers written in digits are seen; "thirty days" in words is never marked.

import { findBannedWording, findUnsupportedNumbers } from "./wording.js";

/**
 * Checks a Counter-offer's wording. Returns null when there is none to show.
 * @param {unknown} raw the model's (or the stored) Counter-offer text
 * @param {Set<string>} numbers the document's numbers, from documentNumbers
 * @returns {{ text: string, marked: { phrase: string, start: number, end: number, kind?: "number" }[] } | null}
 */
export function checkCounterOffer(raw, numbers) {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const text = raw.trim();
  // No documentText: nothing is excused for being in the document (see above).
  const marked = findBannedWording(text).map((h) => ({ phrase: h.phrase, start: h.index, end: h.index + h.match.length }));
  for (const n of findUnsupportedNumbers(text, numbers)) {
    marked.push({ phrase: n.match, kind: "number", start: n.index, end: n.index + n.match.length });
  }
  marked.sort((a, b) => a.start - b.start);
  return { text, marked };
}

/** The prompt lines for the "counterOffer" field. ownerParty: the Owner's term when the Reviewer fixed it. */
export function counterOfferPromptPart(ownerParty = null) {
  const side = ownerParty ? `${ownerParty} (the Owner)` : 'the Owner, the party you give as "ownerParty"';
  return [
    `- "counterOffer": replacement wording for the clause that the Reviewer can send to the Counterparty. Every flag gets one, "know-this" included. It protects ${side}. Write it as the clause the Owner would sign, not as advice and not as a quote of the original clause.`,
    "- A Counter-offer only restates or tightens terms already in the document. Add no term, party, right, duty, amount or period that the document does not contain.",
    '- Never use "may" or any other word from the banned list below in a Counter-offer, even where contracts usually say "may". Write "Customer is entitled to terminate", not "Customer may terminate".',
  ];
}
