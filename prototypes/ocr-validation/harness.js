// Page side of the harness: pdfjs-dist renders each page on the main thread,
// the bitmap is transferred to the OCR worker. Driven by run.mjs through
// window.harness.
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/nm/pdfjs-dist/build/pdf.worker.mjs';
const log = (s) => (document.getElementById('log').textContent += s + '\n');

let worker;
let pending = null;
function call(msg, transfer) {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    worker.postMessage(msg, transfer || []);
  });
}

async function init() {
  const params = new URL(location.href).searchParams;
  const workerUrl = '/ocr-worker.js' + (params.get('threads') ? '?threads=' + params.get('threads') : '');
  const t0 = performance.now();
  worker = new Worker(workerUrl, { type: 'module' });
  worker.onmessage = (e) => {
    const p = pending;
    pending = null;
    if (e.data.type === 'error') p.reject(new Error(e.data.error));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => pending && pending.reject(new Error('worker error: ' + (e.message || e.type)));
  // Optional engine overrides for variant runs, e.g. ?maxSide=2400&strategy=per-box
  const overrides = {};
  if (params.get('maxSide')) overrides.maxSideLength = params.get('maxSide') === 'auto' ? 'auto' : Number(params.get('maxSide'));
  if (params.get('strategy')) overrides.strategy = params.get('strategy');
  if (params.get('minConf')) overrides.minimumConfidence = Number(params.get('minConf'));
  const ready = await call({ type: 'init', overrides });
  ready.initWallMs = performance.now() - t0;
  ready.pageCrossOriginIsolated = self.crossOriginIsolated;
  log('ready ' + JSON.stringify(ready));
  return ready;
}

// Diagnostic deskew (no dependencies): projection-profile search over small
// angles on a downscaled, thresholded copy; the angle whose row sums have the
// highest variance makes text lines horizontal.
function estimateSkew(canvas) {
  const w = 600;
  const h = Math.round((canvas.height * w) / canvas.width);
  const angles = [];
  for (let a = -4; a <= 4.001; a += 0.1) angles.push(a);
  let best = { angle: 0, score: -1 };
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext('2d', { willReadFrequently: true });
  for (const a of angles) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-a * Math.PI) / 180);
    ctx.drawImage(canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, sumSq = 0;
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] < 384) row++;
      }
      sum += row;
      sumSq += row * row;
    }
    const score = sumSq / h - (sum / h) ** 2;
    if (score > best.score) best = { angle: a, score };
  }
  return Math.round(best.angle * 10) / 10;
}
function rotateCanvas(canvas, angle) {
  if (!angle) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((-angle * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

async function savePng(name, canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  await fetch('/save/' + name, { method: 'POST', body: blob });
}

async function ocrPages(id, pages, scale, opts = {}) {
  const t0 = performance.now();
  const data = await (await fetch('/pdf/' + id)).arrayBuffer();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const loadMs = performance.now() - t0;
  const out = [];
  for (const n of pages) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const r0 = performance.now();
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const renderMs = performance.now() - r0;
    let input = canvas, skewAngle = null, deskewMs = 0;
    if (new URL(location.href).searchParams.get('deskew') === '1') {
      const d0 = performance.now();
      skewAngle = estimateSkew(canvas);
      input = rotateCanvas(canvas, skewAngle);
      deskewMs = performance.now() - d0;
    }
    if (opts.savePng) await savePng(`${id}-p${n}-s${scale}.png`, input);
    const bitmap = await createImageBitmap(input);
    const w0 = performance.now();
    const res = await call({ type: 'ocr', bitmap }, [bitmap]);
    const wallOcrMs = performance.now() - w0;
    out.push({ page: n, width: canvas.width, height: canvas.height, renderMs, skewAngle, deskewMs, wallOcrMs, ...res });
    log(`${id} p${n} render ${renderMs.toFixed(0)}ms ocr ${res.ocrMs.toFixed(0)}ms`);
  }
  return { id, scale, numPages: doc.numPages, loadMs, pages: out };
}

async function renderOnly(id, pages, scale) {
  const data = await (await fetch('/pdf/' + id)).arrayBuffer();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  for (const n of pages) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    await savePng(`${id}-p${n}-s${scale}.png`, canvas);
  }
  return doc.numPages;
}

window.harness = { init, ocrPages, renderOnly };
log('harness loaded');
