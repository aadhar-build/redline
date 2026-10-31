// The safe set of text normalisations from ADR 0010, and nothing else.
// Applied identically to model output and stored document text before comparing them.
// Never: rejoining line-end hyphens, stripping footnote markers, case folding, full NFKC,
// or ignoring digits, punctuation or accents.

const LIGATURES = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};

export function normalise(text) {
  return (
    String(text)
      .normalize("NFC")
      // Zero-width and other format characters (Unicode category Cf, which includes the soft hyphen).
      .replace(/\p{Cf}/gu, "")
      // Curly quotes fold to straight.
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      // Hyphen and dash variants fold to "-".
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
      .replace(/[\uFB00-\uFB06]/g, (ch) => LIGATURES[ch])
      // Every run of whitespace, including no-break and other Unicode spaces, becomes one space.
      .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/gu, " ")
      .trim()
  );
}
