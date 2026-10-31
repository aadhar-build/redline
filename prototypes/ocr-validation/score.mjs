// Score OCR output against hand transcriptions.
//
//   node score.mjs <truth-dir> <run.json> [--detail]
//
// truth-dir holds <ID>-p<n>.txt (one visual line per line, reference reading
// order) and entities.json ({ "<ID>-p<n>": { amounts, lakhCrore, sections,
// dates, parties } }). Truth files live outside the repo; nothing here embeds
// document text.
//
// Metrics per page:
//   cerOrdered   edit distance between the whole OCR text (in ppu's output
//                order) and the whole reference, / reference length.
//   cerOrderFree each reference line is matched to its best approximate
//                substring anywhere in the OCR text; summed distance / ref
//                length. Ignores reading order and extra text (handwriting,
//                seals), so cerOrdered - cerOrderFree is the order penalty.
//   orderKept    share of adjacent reference-line pairs whose best matches
//                appear in the same order in the OCR text.
//   numeric      whitespace tokens containing a digit, exact multiset match.
//   rupee        count of the ₹ glyph in reference vs OCR output.
//   entity lists exact (whitespace-insensitive) presence, multiset counts.
import fs from 'node:fs';
import path from 'node:path';

const [truthDir, runFile, flag] = process.argv.slice(2);
const detail = flag === '--detail';
const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
const entities = JSON.parse(fs.readFileSync(path.join(truthDir, 'entities.json'), 'utf8'));

const norm = (s) =>
  s
    .normalize('NFC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
const squash = (s) => norm(s).replace(/\s+/g, '');

function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = new Uint32Array(n + 1), cur = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const c = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
// Best approximate occurrence of pattern p anywhere in text t (Sellers).
function bestSubstring(p, t) {
  const m = p.length, n = t.length;
  let prev = new Uint32Array(n + 1), cur = new Uint32Array(n + 1);
  let prevS = new Int32Array(n + 1), curS = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) { prev[j] = 0; prevS[j] = j; }
  for (let i = 1; i <= m; i++) {
    cur[0] = i; curS[0] = 0;
    const cp = p.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const sub = prev[j - 1] + (cp === t.charCodeAt(j - 1) ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      if (sub <= del && sub <= ins) { cur[j] = sub; curS[j] = prevS[j - 1]; }
      else if (del <= ins) { cur[j] = del; curS[j] = prevS[j]; }
      else { cur[j] = ins; curS[j] = curS[j - 1]; }
    }
    [prev, cur] = [cur, prev];
    [prevS, curS] = [curS, prevS];
  }
  let best = Infinity, end = 0;
  for (let j = 0; j <= n; j++) if (prev[j] < best) { best = prev[j]; end = j; }
  return { dist: best, start: prevS[end], end };
}
function countOcc(hay, needle) {
  if (!needle) return 0;
  let c = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { c++; i += needle.length; }
  return c;
}
function multisetMatch(list, hyp) {
  const need = new Map();
  for (const e of list) need.set(squash(e), (need.get(squash(e)) || 0) + 1);
  let hit = 0, total = 0;
  const misses = [];
  for (const [e, k] of need) {
    const got = Math.min(k, countOcc(hyp, e));
    hit += got; total += k;
    if (got < k) misses.push(e);
  }
  return { hit, total, misses };
}
const numTokens = (s) =>
  norm(s)
    .split(' ')
    .filter((t) => /\d/.test(t))
    .map((t) => t.replace(/^[("'\[]+|[)"'\],;:.]+$/g, ''));

const pages = [];
for (const doc of run.docs) {
  if (doc.error) { pages.push({ key: doc.id, error: doc.error }); continue; }
  for (const p of doc.pages) {
    const key = `${doc.id}-p${p.page}`;
    const tf = path.join(truthDir, key + '.txt');
    if (!fs.existsSync(tf)) continue;
    const refLines = fs.readFileSync(tf, 'utf8').split('\n').map(norm).filter(Boolean);
    const ref = refLines.join(' ');
    const hypLines = p.lines.map((l) => l.map((w) => w.text).join(' ')).map(norm).filter(Boolean);
    const hyp = hypLines.join(' ');
    const cerOrdered = lev(hyp, ref) / ref.length;
    let free = 0, positions = [];
    for (const rl of refLines) {
      const b = bestSubstring(rl, hyp);
      free += b.dist;
      positions.push(b.start);
    }
    let kept = 0;
    for (let i = 1; i < positions.length; i++) if (positions[i] >= positions[i - 1]) kept++;
    const hypSq = squash(hyp);
    const ent = entities[key] || {};
    const rn = numTokens(ref), hn = numTokens(hyp);
    const hnBag = new Map();
    for (const t of hn) hnBag.set(t, (hnBag.get(t) || 0) + 1);
    let numHit = 0;
    const numMiss = [];
    const rnBag = new Map();
    for (const t of rn) rnBag.set(t, (rnBag.get(t) || 0) + 1);
    for (const [t, k] of rnBag) { const g = Math.min(k, hnBag.get(t) || 0); numHit += g; if (g < k) numMiss.push(t); }
    const cats = {};
    for (const c of ['amounts', 'lakhCrore', 'sections', 'dates', 'parties']) cats[c] = multisetMatch(ent[c] || [], hypSq);
    const row = {
      key,
      refChars: ref.length,
      cerOrdered,
      cerOrderFree: free / ref.length,
      orderKept: positions.length > 1 ? kept / (positions.length - 1) : 1,
      numeric: { hit: numHit, total: rn.length, misses: numMiss },
      rupee: { ref: countOcc(ref, '₹'), hyp: countOcc(hyp, '₹') },
      ...cats,
      ocrMs: p.ocrMs,
      renderMs: p.renderMs,
      confidence: p.confidence,
    };
    if (detail) {
      row.amountReadings = (ent.amounts || []).map((a) => {
        const b = bestSubstring(norm(a), hyp);
        return { ref: a, ocr: hyp.slice(b.start, b.end) };
      });
      row.hypText = p.lines.map((l) => l.map((w) => w.text).join(' | ')).join('\n');
    }
    pages.push(row);
  }
}

const sum = (k) => pages.reduce((a, r) => a + (r[k] ? (r[k].hit ?? 0) : 0), 0);
const tot = (k) => pages.reduce((a, r) => a + (r[k] ? (r[k].total ?? 0) : 0), 0);
const refChars = pages.reduce((a, r) => a + (r.refChars || 0), 0);
const overall = {
  pages: pages.length,
  refChars,
  cerOrdered: pages.reduce((a, r) => a + r.cerOrdered * r.refChars, 0) / refChars,
  cerOrderFree: pages.reduce((a, r) => a + r.cerOrderFree * r.refChars, 0) / refChars,
  numeric: `${sum('numeric')}/${tot('numeric')}`,
  amounts: `${sum('amounts')}/${tot('amounts')}`,
  lakhCrore: `${sum('lakhCrore')}/${tot('lakhCrore')}`,
  sections: `${sum('sections')}/${tot('sections')}`,
  dates: `${sum('dates')}/${tot('dates')}`,
  parties: `${sum('parties')}/${tot('parties')}`,
  rupee: `${pages.reduce((a, r) => a + (r.rupee?.hyp || 0), 0)} emitted / ${pages.reduce((a, r) => a + (r.rupee?.ref || 0), 0)} on page`,
};
console.log(JSON.stringify({ run: path.basename(runFile), overall, pages }, null, 1));
