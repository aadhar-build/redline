// Timing and first-load-size summary for one or more run JSON files.
//   node summarize.mjs run1.json [run2.json ...]
import fs from 'node:fs';
import path from 'node:path';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mb = (b) => (b / 1e6).toFixed(2);

for (const f of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const pages = r.docs.flatMap((d) => (d.pages || []).map((p) => ({ id: d.id, ...p })));
  const load = r.responses.filter((x) => x.phase === 'load');
  const group = (x) =>
    x.path.startsWith('/models/') ? 'models' :
    x.path.includes('onnxruntime-web') && x.path.endsWith('.wasm') ? 'ort-wasm' :
    x.path.includes('onnxruntime') ? 'ort-js' :
    x.path.includes('pdfjs-dist') ? 'pdfjs' :
    x.path.includes('ppu-') ? 'ppu-js' : 'harness';
  const by = {};
  for (const x of load) {
    const g = group(x);
    by[g] ??= { bytes: 0, gzip: 0, br: 0, files: 0 };
    by[g].bytes += x.bytes; by[g].gzip += x.gzipBytes; by[g].br += x.brBytes; by[g].files++;
  }
  const ocrOnly = Object.entries(by).filter(([g]) => !['pdfjs', 'harness'].includes(g));
  const tot = (k, arr) => arr.reduce((a, [, v]) => a + v[k], 0);
  console.log(`\n## ${path.basename(f)}`);
  console.log(`${r.browser} ${r.browserVersion} | ${r.cpu} (${r.cores} cores) | query=${r.query ?? ''} | scale ${r.scale}`);
  console.log(`isolated=${r.ready.crossOriginIsolated} numThreads=${r.ready.numThreads} webGpuAvailable=${r.ready.webGpuAvailable} | external requests blocked: ${r.externalRequestsBlocked.length}`);
  console.log(`engine init ${r.ready.initMs.toFixed(0)} ms (worker wall ${r.ready.initWallMs.toFixed(0)} ms); page goto->ready ${r.firstLoadMs} ms`);
  for (const [g, v] of Object.entries(by)) console.log(`  ${g.padEnd(8)} ${String(v.files).padStart(3)} files  raw ${mb(v.bytes)} MB  gzip ${mb(v.gzip)} MB  br ${mb(v.br)} MB`);
  console.log(`  OCR-specific first load (models+ort+ppu): raw ${mb(tot('bytes', ocrOnly))} MB, gzip ${mb(tot('gzip', ocrOnly))} MB, br ${mb(tot('br', ocrOnly))} MB`);
  const ocr = pages.map((p) => p.ocrMs);
  const rend = pages.map((p) => p.renderMs);
  const desk = pages.map((p) => p.deskewMs || 0);
  console.log(`  per page (n=${pages.length}): OCR median ${(median(ocr) / 1000).toFixed(2)} s (min ${(Math.min(...ocr) / 1000).toFixed(2)}, max ${(Math.max(...ocr) / 1000).toFixed(2)}); render median ${median(rend).toFixed(0)} ms; deskew median ${median(desk).toFixed(0)} ms`);
  console.log('  ' + pages.map((p) => `${p.id}p${p.page}:${(p.ocrMs / 1000).toFixed(1)}s`).join(' '));
}
