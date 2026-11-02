// Renders text with each marked span wrapped in <mark>. Spans are character offsets, in order.
// Used for Redline's own words that break the hedge-word and verdict-word ban, and (kind "number") for
// numbers the contract doesn't contain (ticket 22).
export const isNumberMark = (m) => m.kind === "number";
// Ticket 08b: a Counter-offer word the contract doesn't use.
export const isNewTermMark = (m) => m.kind === "new-term";
const markClass = (m) => (isNumberMark(m) ? "unsupported-number" : isNewTermMark(m) ? "new-term" : "banned-word");
const markKind = (m) => (isNumberMark(m) ? "number" : isNewTermMark(m) ? "new-term" : "word");

export default function MarkedText({ text, marked }) {
  const parts = [];
  let at = 0;
  for (const m of marked) {
    const { start, end } = m;
    if (start < at || end > text.length) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className={markClass(m)} data-mark={markKind(m)}>
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return parts;
}
