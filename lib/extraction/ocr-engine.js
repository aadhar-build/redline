// The OCR engine seam (ADR 0008, ticket 23). This is the only module that knows which OCR engine
// Redline uses; swapping engines (a second bake-off is running) means replacing this file and the
// assets scripts/copy-ocr-assets.mjs self-hosts, nothing else. Runs inside the OCR worker.
//
//   createRecognizer() -> Promise<{ recognize(image) }>
//   recognize(image: OffscreenCanvas, already straightened) ->
//     Promise<{ lines: { text: string, box: { x, y, width, height } }[][] }>
//   Lines in reading order, each a list of boxes left to right, in image pixels. ocr-lines.js turns
//   that into the page's lines.
//
// Today: ppu-paddle-ocr with PP-OCRv6 small (det + rec + ppocrv6_dict.txt, research 31), on ONNX Runtime WASM, single-threaded (the site
// sends no COOP/COEP headers, spec-gaps 24). Self-hosting gotcha (prototype/ocr-bake-off):
// ppu-paddle-ocr/web sets ort.env.wasm.wasmPaths to jsDelivr when it is imported, if it is still
// unset. So wasmPaths is set here first, and ppu is imported dynamically afterwards. next.config.mjs
// aliases "onnxruntime-web" to "onnxruntime-web/wasm", so this module and ppu share one ONNX Runtime
// (and one env), the plain WASM build without JSEP/WebGPU.

import * as ort from "onnxruntime-web/wasm";

const ORT_VERSION = ort.env.versions.web ?? ort.env.versions.common;
const ORIGIN = self.location.origin;
const MODEL_FOLDER = "pp-ocrv6-small";
const MODELS = `${ORIGIN}/ocr/models/${MODEL_FOLDER}`;

// The models are about 26 MB gzip and barely compress, and Next serves public/ with max-age=0, so
// they are kept in Cache Storage under a name tied to the model folder: a later visit reads them from
// disk. Caches left by an older engine are deleted. Where Cache Storage is unavailable, a plain fetch.
const CACHE = `redline-ocr-${MODEL_FOLDER}`;

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OCR model fetch failed: ${res.status} ${url}`);
  return res;
}

async function loadModelFile(url) {
  if (typeof caches === "undefined") return (await fetchOk(url)).arrayBuffer();
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith("redline-ocr-") && name !== CACHE) await caches.delete(name);
    }
    const cache = await caches.open(CACHE);
    let res = await cache.match(url);
    if (!res) {
      res = await fetchOk(url);
      await cache.put(url, res.clone());
    }
    return res.arrayBuffer();
  } catch (err) {
    if (/OCR model fetch failed/.test(err?.message)) throw err;
    return (await fetchOk(url)).arrayBuffer();
  }
}

export async function createRecognizer() {
  ort.env.wasm.wasmPaths = {
    wasm: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.wasm`,
    mjs: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.mjs`,
  };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;

  const { PaddleOcrService } = await import("ppu-paddle-ocr/web");
  // ArrayBuffers, never anything else: ppu falls back to its own Hugging Face URLs for any source that
  // is not a string or an ArrayBuffer.
  const [detection, recognition, charactersDictionary] = await Promise.all(
    ["det.ort", "rec.ort", "dict.txt"].map((f) => loadModelFile(`${MODELS}/${f}`)),
  );
  const service = new PaddleOcrService({
    model: { detection, recognition, charactersDictionary },
    // per-box with deskew was the best configuration in the validation run.
    recognition: { strategy: "per-box" },
    session: { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  });
  await service.initialize();

  return {
    async recognize(image) {
      const result = await service.recognize(image);
      const lines = (Array.isArray(result?.lines) ? result.lines : []).map((boxes) =>
        (Array.isArray(boxes) ? boxes : []).map((b) => ({ text: b?.text, box: b?.box })),
      );
      return { lines };
    },
  };
}
