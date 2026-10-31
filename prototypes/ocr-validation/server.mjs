// Throwaway static server for the OCR validation harness.
// Serves the harness page, node_modules (with bare imports rewritten so the
// browser can load ES modules without a bundler), self-hosted model files,
// and sample PDFs from a folder outside the repo. Nothing here talks to a CDN.
//
// Env:
//   PORT          default 4321
//   MODELS_DIR    folder holding det.ort, rec.ort, dict.txt (outside the repo)
//   SAMPLES_DIR   folder holding <id>/<file>.pdf (outside the repo)
//   OUT_DIR       folder where /save writes JSON results (outside the repo)
//   ISOLATE=1     send COOP/COEP so the page is cross-origin isolated (WASM threads)
//   HARNESS_TOKEN shared secret; generated at start if unset. The driver passes it
//                 to the page as ?token=..., and /pdf/, /save/ and /__requested
//                 refuse requests without it.
//
// Hardening: listens on 127.0.0.1 only, rejects any Host other than
// localhost:PORT / 127.0.0.1:PORT (DNS rebinding), caps request bodies at 20 MB.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const NM = path.join(here, 'node_modules');
const PORT = Number(process.env.PORT || 4321);
const MODELS_DIR = process.env.MODELS_DIR;
const SAMPLES_DIR = process.env.SAMPLES_DIR;
const OUT_DIR = process.env.OUT_DIR;
const ISOLATE = process.env.ISOLATE === '1';
if (!MODELS_DIR || !SAMPLES_DIR || !OUT_DIR) {
  console.error('MODELS_DIR, SAMPLES_DIR and OUT_DIR are required');
  process.exit(1);
}
const TOKEN = process.env.HARNESS_TOKEN || crypto.randomBytes(24).toString('hex');
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const MAX_BODY = 20 * 1024 * 1024;
function hasToken(req, url) {
  const given = req.headers['x-harness-token'] || url.searchParams.get('token') || '';
  const a = Buffer.from(String(given));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Bare specifier -> served path. Explicit entries first, then package "exports".
// ORT_ENTRY=default -> what `import "onnxruntime-web"` gives a bundler (ort.min.mjs,
// which pulls the 29.5 MB JSEP/WebGPU wasm even when only the wasm EP is used).
// ORT_ENTRY=wasm (default here) -> onnxruntime-web/wasm (ort.wasm.min.mjs, 14.8 MB wasm).
const ORT_ENTRY = process.env.ORT_ENTRY || 'wasm';
const ALIASES = {
  'onnxruntime-web': ORT_ENTRY === 'default' ? '/nm/onnxruntime-web/dist/ort.min.mjs' : '/nm/onnxruntime-web/dist/ort.wasm.min.mjs',
  'onnxruntime-common': '/nm/onnxruntime-common/dist/esm/index.js',
  'pdfjs-dist': '/nm/pdfjs-dist/build/pdf.mjs',
};
function resolveBare(spec) {
  if (ALIASES[spec]) return ALIASES[spec];
  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = '.' + spec.slice(pkg.length);
  const pj = JSON.parse(fs.readFileSync(path.join(NM, pkg, 'package.json'), 'utf8'));
  let target = null;
  if (pj.exports) {
    let e = typeof pj.exports === 'string' ? { '.': pj.exports } : pj.exports;
    e = e[sub] ?? (sub === '.' && !Object.keys(e).some((k) => k.startsWith('.')) ? e : undefined);
    while (e && typeof e === 'object') e = e.browser ?? e.import ?? e.default ?? null;
    target = e;
  }
  if (!target) target = sub === '.' ? pj.module || pj.main || 'index.js' : sub;
  return '/nm/' + pkg + '/' + target.replace(/^\.\//, '');
}
// Only package-name-shaped specifiers; minified code contains `from"...` inside strings.
const importRe = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(@?[a-zA-Z][\w.-]*(?:\/[\w.-]+)*)\2/g;
function rewrite(src) {
  return src.replace(importRe, (m, pre, q, spec) => {
    try {
      return pre + q + resolveBare(spec) + q;
    } catch {
      return m;
    }
  });
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ort': 'application/octet-stream',
  '.onnx': 'application/octet-stream', '.pdf': 'application/pdf', '.map': 'application/json',
};
const requested = [];

function send(res, code, body, type) {
  const h = { 'Content-Type': type || 'text/plain', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) };
  if (ISOLATE) {
    h['Cross-Origin-Opener-Policy'] = 'same-origin';
    h['Cross-Origin-Embedder-Policy'] = 'require-corp';
    h['Cross-Origin-Resource-Policy'] = 'same-origin';
  }
  res.writeHead(code, h);
  res.end(body);
}
function sendFile(res, file, doRewrite) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'not found');
  const ext = path.extname(file);
  let body = fs.readFileSync(file);
  if (doRewrite && (ext === '.js' || ext === '.mjs')) body = rewrite(body.toString('utf8'));
  send(res, 200, body, TYPES[ext] || 'application/octet-stream');
}
function safeJoin(root, rel) {
  const base = path.resolve(root);
  const p = path.resolve(base, '.' + path.sep + rel);
  if (p !== base && !p.startsWith(base + path.sep)) throw new Error('path escape');
  return p;
}

http
  .createServer((req, res) => {
    if (!ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) {
      req.resume();
      return send(res, 421, 'bad host');
    }
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    requested.push(p);
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY) {
      req.resume();
      return send(res, 413, 'too large');
    }
    try {
      if (req.method === 'POST' && p.startsWith('/save/')) {
        if (!hasToken(req, url)) {
          req.resume();
          return send(res, 403, 'forbidden');
        }
        const name = path.basename(p).replace(/[^A-Za-z0-9._-]/g, '_');
        if (!name || name.startsWith('.')) return send(res, 400, 'bad name');
        const chunks = [];
        let size = 0;
        let aborted = false;
        req.on('data', (c) => {
          size += c.length;
          if (size > MAX_BODY && !aborted) {
            aborted = true;
            send(res, 413, 'too large');
            req.destroy();
            return;
          }
          if (!aborted) chunks.push(c);
        });
        req.on('end', () => {
          if (aborted) return;
          fs.mkdirSync(OUT_DIR, { recursive: true });
          fs.writeFileSync(path.join(OUT_DIR, name), Buffer.concat(chunks));
          send(res, 200, 'ok');
        });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.resume();
        return send(res, 405, 'method not allowed');
      }
      if (p === '/' || p === '/index.html') return sendFile(res, path.join(here, 'harness.html'));
      if (p === '/harness.js' || p === '/ocr-worker.js' || p === '/ort-setup.js') return sendFile(res, path.join(here, p.slice(1)), true);
      if (p === '/__requested') {
        if (!hasToken(req, url)) return send(res, 403, 'forbidden');
        return send(res, 200, JSON.stringify(requested), 'application/json');
      }
      if (p.startsWith('/nm/')) return sendFile(res, safeJoin(NM, p.slice(4)), true);
      if (p.startsWith('/models/')) return sendFile(res, safeJoin(MODELS_DIR, p.slice(8)));
      if (p.startsWith('/pdf/')) {
        if (!hasToken(req, url)) return send(res, 403, 'forbidden');
        const id = path.basename(p);
        const dir = safeJoin(SAMPLES_DIR, id);
        const f = fs.readdirSync(dir).find((n) => n.toLowerCase().endsWith('.pdf'));
        return sendFile(res, path.join(dir, f));
      }
      send(res, 404, 'not found');
    } catch (e) {
      send(res, 500, String(e));
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`harness on http://localhost:${PORT} isolate=${ISOLATE} ort=${ORT_ENTRY}`);
    if (!process.env.HARNESS_TOKEN) console.log(`token: ${TOKEN}`);
  });
