// Renders text with each marked span wrapped in <mark>. Spans are character offsets, in order.
// Used for Redline's own words that break the hedge-word and verdict-word ban, and (kind "number") for
// numbers the contract doesn't contain (ticket 22).
export const isNumberMark = (m) => m.kind === "number";

export default function MarkedText({ text, marked }) {
  const parts = [];
  let at = 0;
  for (const m of marked) {
    const { start, end } = m;
    if (start < at || end > text.length) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className={isNumberMark(m) ? "unsupported-number" : "banned-word"} data-mark={isNumberMark(m) ? "number" : "word"}>
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return parts;
}
