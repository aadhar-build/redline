// Severity glyphs: each state has its own shape, so colour never carries meaning alone.
const LABELS = {
  dont: "Don't sign as written",
  negotiate: "Negotiate",
  know: "Know this",
  outside: "Outside reference",
  withheld: "Withheld",
};

export function Glyph({ kind, className = "", title }) {
  const common = {
    className: `glyph glyph-${kind} ${className}`.trim(),
    viewBox: "0 0 20 20",
    width: 20,
    height: 20,
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
    focusable: "false",
  };
  const t = title ? <title>{title}</title> : null;

  switch (kind) {
    case "dont":
      return (
        <svg {...common}>
          {t}
          <rect x="3" y="3" width="14" height="14" fill="currentColor" />
        </svg>
      );
    case "negotiate":
      return (
        <svg {...common}>
          {t}
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
        </svg>
      );
    case "know":
      return (
        <svg {...common}>
          {t}
          <path d="M10 2.5 17.5 10 10 17.5 2.5 10z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "outside":
      return (
        <svg {...common}>
          {t}
          <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.2" />
          <path d="M8.2 8.1a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.7-.8 1.3v.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="13.9" r="1" fill="currentColor" />
        </svg>
      );
    case "withheld":
      return (
        <svg {...common}>
          {t}
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M5.4 14.6 14.6 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function Tick({ drawn = true, className = "" }) {
  return (
    <svg className={`tick ${drawn ? "tick-drawn" : ""} ${className}`.trim()} viewBox="0 0 24 20" width="22" height="18" aria-hidden="true" focusable="false">
      <path d="M2.5 11.5c2.2 1.2 3.8 3 5.2 5.4C11 10 15.6 5.1 21.5 2.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
    </svg>
  );
}

export { LABELS as SEVERITY_LABELS };
