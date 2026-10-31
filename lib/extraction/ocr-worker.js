// The OCR worker (ADR 0008, ticket 23): a module Worker that owns ppu-paddle-ocr with the PP-OCRv5
// English mobile models. It receives one rendered page image at a time, straightens it (deskew.js),
// reads it, and returns the page's lines. Everything it loads comes from Redline's own origin:
// scripts/copy-ocr-assets.mjs puts the ONNX Runtime WASM and the model files in public/ocr/.
//
// Self-hosting gotcha (OCR validation, prototype/ocr-bake-off): ppu-paddle-ocr/web sets
// ort.env.wasm.wasmPaths to jsDelivr when it is imported, if it is still unset. So wasmPaths is set
// here first, and ppu is imported dynamically afterwards. next.config.mjs aliases "onnxruntime-web" to
// "onnxruntime-web/wasm", so this module and ppu share one ONNX Runtime (and one env), the plain WASM
// build without JSEP/WebGPU. Single-threaded: the site sends no COOP/COEP headers (spec-gaps 24).
//
// Messages in:  { type: "page", id, bitmap }   (an ImageBitmap, transferred)
// Messages out: { type: "ready" } once, then { type: "lines", id, lines, angle } or
//               { type: "error", id, message }

import * as ort from "onnxruntime-web/wasm";
import { estimateSkew, rotate } from "./deskew.js";
import { ocrPageLines } from "./ocr-lines.js";

const ORT_VERSION = ort.env.versions.web ?? ort.env.versions.common;
const ORIGIN = self.location.origin;
ort.env.wasm.wasmPaths = {
  wasm: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.wasm`,
  mjs: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.mjs`,
};
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const MODELS = `${ORIGIN}/ocr/models/pp-ocrv5-en-mobile`;
const makeCanvas = (w, h) => new OffscreenCanvas(w, h);

async function start() {
  const { PaddleOcrService } = await import("ppu-paddle-ocr/web");
  const service = new PaddleOcrService({
    model: {
      detection: `${MODELS}/det.ort`,
      recognition: `${MODELS}/rec.ort`,
      charactersDictionary: `${MODELS}/dict.txt`,
    },
    // per-box with deskew was the best configuration in the validation run.
    recognition: { strategy: "per-box" },
    session: { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  });
  await service.initialize();
  return service;
}

const ready = start();
ready.then(
  () => self.postMessage({ type: "ready" }),
  (err) => self.postMessage({ type: "error", id: null, message: String(err?.message ?? err) }),
);

self.onmessage = async (event) => {
  const { type, id, bitmap } = event.data ?? {};
  if (type !== "page") return;
  try {
    const service = await ready;
    const page = makeCanvas(bitmap.width, bitmap.height);
    page.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    const angle = estimateSkew(page, makeCanvas);
    const straight = rotate(page, angle, makeCanvas);
    const result = await service.recognize(straight);
    self.postMessage({ type: "lines", id, angle, lines: ocrPageLines(result, straight.height) });
  } catch (err) {
    self.postMessage({ type: "error", id, message: String(err?.message ?? err) });
  }
};
