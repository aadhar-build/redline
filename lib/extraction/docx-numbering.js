// Word's automatic list numbering, worked out the way Word shows it, so clause labels such as "12.3"
// or "(b)" stay in the extracted text. Pure: docx.js reads numbering.xml into the plain shapes below.
//
//   abstracts: Map<abstractId, { levels: Map<ilvl, Level> }>
//   nums:      Map<numId, { abstractId, overrides: Map<ilvl, { start?: number, level?: Level }> }>
//   Level:     { start, numFmt, lvlText, isLgl, restart? }   restart is w:lvlRestart's value
//
// Counters are kept per abstract list, as Word does, so two w:num entries that share an abstract
// list continue one sequence. A w:startOverride restarts the sequence the first time its w:num is used.

function letters(n, upper) {
  // Word's letter numbering: a..z, then aa..zz, then aaa..
  const ch = String.fromCharCode(97 + ((n - 1) % 26));
  const s = ch.repeat(Math.floor((n - 1) / 26) + 1);
  return upper ? s.toUpperCase() : s;
}

function roman(n, upper) {
  const table = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  for (const [value, sym] of table) while (n >= value) { out += sym; n -= value; }
  return upper ? out.toUpperCase() : out;
}

export function formatNumber(n, numFmt) {
  if (n <= 0 && /Letter|Roman/.test(numFmt)) return String(n);
  switch (numFmt) {
    case "lowerLetter": return letters(n, false);
    case "upperLetter": return letters(n, true);
    case "lowerRoman": return roman(n, false);
    case "upperRoman": return roman(n, true);
    case "decimalZero": return n < 10 ? `0${n}` : String(n);
    case "none": return "";
    default: return String(n); // decimal, and a plain number for formats Redline does not spell out
  }
}

export function createNumberer({ abstracts, nums }) {
  const counters = new Map(); // abstractId -> number[] (undefined = level not used yet)
  const started = new Set(); // numIds whose startOverride has been applied
  const levelStart = new Map(); // "numId:ilvl" -> start value from a w:startOverride

  const levelFor = (num, ilvl) => num.overrides.get(ilvl)?.level ?? abstracts.get(num.abstractId)?.levels.get(ilvl);

  /** Returns the label for the next paragraph in list numId at level ilvl, or "" for none. */
  return function next(numId, ilvl) {
    const num = nums.get(numId);
    if (!num || !abstracts.has(num.abstractId)) return "";
    const level = levelFor(num, ilvl);
    if (!level) return "";

    const counts = counters.get(num.abstractId) ?? [];
    counters.set(num.abstractId, counts);
    if (!started.has(numId)) {
      started.add(numId);
      for (const [l, o] of num.overrides) {
        if (typeof o.start === "number") {
          counts[l] = undefined;
          levelStart.set(`${numId}:${l}`, o.start);
        }
      }
    }

    const startOf = (l) => levelStart.get(`${numId}:${l}`) ?? levelFor(num, l)?.start ?? 1;
    counts[ilvl] = counts[ilvl] === undefined ? startOf(ilvl) : counts[ilvl] + 1;
    for (let deeper = ilvl + 1; deeper < 9; deeper++) {
      // w:lvlRestart n: restart after a level at or above n (1-based) is used; 0 means never.
      const restart = levelFor(num, deeper)?.restart ?? deeper;
      if (restart !== 0 && ilvl < restart) counts[deeper] = undefined;
    }

    if (level.numFmt === "bullet") return "";
    const label = String(level.lvlText ?? "").replace(/%([1-9])/g, (_, d) => {
      const l = Number(d) - 1;
      const value = counts[l] ?? startOf(l);
      const fmt = level.isLgl ? "decimal" : (levelFor(num, l)?.numFmt ?? "decimal");
      return formatNumber(value, fmt);
    });
    return label.trim();
  };
}
