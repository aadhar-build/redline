// Playwright driver for the OCR validation harness.
//
//   node run.mjs render <base> <browser> <id> <pages> <scale>
//       save rendered page PNGs (to the server's OUT_DIR) for hand transcription
//   node run.mjs ocr <base> <browser> <plan.json> <out.json> [scale] [query]
//       query: harness URL params, e.g. "maxSide=2400&threads=4"
//       plan.json: [{ "id": "S01", "pages": [1, 2] }, ...]
//
// Every request to a host other than localhost is aborted and logged, so the
// run proves the engine works with no CDN at runtime.
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';

const [mode, base, browserName, ...rest] = process.argv.slice(2);
const engines = { chromium, webkit };
// Must match the server's HARNESS_TOKEN (serve-all.sh prints/exports it).
const TOKEN = process.env.HARNESS_TOKEN || '';
if (!TOKEN) {
  console.error('HARNESS_TOKEN is required');
  process.exit(1);
}
const withToken = (u, q = '') => u + '?' + (q ? q + '&' : '') + 'token=' + encodeURIComponent(TOKEN);

async function open() {
  const browser = await engines[browserName].launch();
  const context = await browser.newContext();
  const external = [];
  const responses = [];
  let phase = 'load';
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'blob:' || u.protocol === 'data:') {
      return route.continue();
    }
    external.push(route.request().url());
    return route.abort();
  });
  context.on('response', async (res) => {
    const u = new URL(res.url());
    if (u.hostname !== 'localhost') return;
    // Only size/compress first-load responses; doing it during OCR would steal
    // CPU from the browser and skew the per-page timings.
    if (phase !== 'load') {
      responses.push({ phase, path: u.pathname, bytes: Number(res.headers()['content-length'] || 0) });
      return;
    }
    try {
      const body = await res.body();
      responses.push({
        phase,
        path: u.pathname,
        bytes: body.length,
        gzipBytes: zlib.gzipSync(body, { level: 6 }).length,
        brBytes: zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length,
      });
    } catch {
      // Playwright cannot hand back some large streamed bodies (the ORT wasm);
      // refetch from the local server to size and compress them.
      const body = Buffer.from(await (await fetch(res.url())).arrayBuffer());
      responses.push({
        phase,
        path: u.pathname,
        bytes: body.length,
        gzipBytes: zlib.gzipSync(body, { level: 6 }).length,
        brBytes: zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length,
      });
    }
  });
  const page = await context.newPage();
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => consoleLines.push('pageerror: ' + e.message));
  return { browser, context, page, external, responses, consoleLines, setPhase: (p) => (phase = p) };
}

if (mode === 'render') {
  const [id, pages, scale] = rest;
  const s = await open();
  await s.page.goto(withToken(base));
  await s.page.waitForFunction(() => window.harness);
  const n = await s.page.evaluate(
    ([id, pages, scale]) => window.harness.renderOnly(id, pages, scale),
    [id, pages.split(',').map(Number), Number(scale)],
  );
  console.log(`rendered ${id} pages ${pages} of ${n} at scale ${scale}`);
  await s.browser.close();
} else if (mode === 'ocr') {
  const [planFile, outFile, scale = '2', query = ''] = rest;
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const s = await open();
  const url = withToken(base, query);
  const t0 = Date.now();
  await s.page.goto(url);
  await s.page.waitForFunction(() => window.harness, null, { timeout: 60000 });
  let ready;
  try {
    ready = await s.page.evaluate(() => window.harness.init());
  } catch (e) {
    console.log(JSON.stringify({ initError: String(e), console: s.consoleLines, external: s.external }, null, 1));
    await s.browser.close();
    process.exit(1);
  }
  const firstLoadMs = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 500));
  s.setPhase('ocr');
  const docs = [];
  for (const item of plan) {
    try {
      docs.push(
        await s.page.evaluate(([id, pages, scale]) => window.harness.ocrPages(id, pages, scale), [
          item.id,
          item.pages,
          Number(scale),
        ]),
      );
    } catch (e) {
      docs.push({ id: item.id, error: String(e) });
    }
  }
  const result = {
    browser: browserName,
    browserVersion: s.browser.version(),
    cpu: os.cpus()[0].model,
    cores: os.cpus().length,
    platform: `${os.platform()} ${os.release()}`,
    base,
    scale: Number(scale),
    query,
    firstLoadMs,
    ready,
    externalRequestsBlocked: s.external,
    responses: s.responses,
    console: s.consoleLines.slice(0, 50),
    docs,
  };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
  console.log(`wrote ${outFile}; external blocked: ${s.external.length}; init ${ready.initMs.toFixed(0)}ms`);
  await s.browser.close();
}
