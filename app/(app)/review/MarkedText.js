// Renders text with each marked span wrapped in <mark>. Spans are character offsets, in order.
// Used for Redline's own words that break the hedge-word and verdict-word ban.
export default function MarkedText({ text, marked }) {
  const parts = [];
  let at = 0;
  for (const { start, end } of marked) {
    if (start < at || end > text.length) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="banned-word">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return parts;
}
