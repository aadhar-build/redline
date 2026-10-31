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
// Today: ppu-paddle-ocr with PP-OCRv5 English mobile, on ONNX Runtime WASM, single-threaded (the site
// sends no COOP/COEP headers, spec-gaps 24). Self-hosting gotcha (prototype/ocr-bake-off):
// ppu-paddle-ocr/web sets ort.env.wasm.wasmPaths to jsDelivr when it is imported, if it is still
// unset. So wasmPaths is set here first, and ppu is imported dynamically afterwards. next.config.mjs
// aliases "onnxruntime-web" to "onnxruntime-web/wasm", so this module and ppu share one ONNX Runtime
// (and one env), the plain WASM build without JSEP/WebGPU.

import * as ort from "onnxruntime-web/wasm";

const ORT_VERSION = ort.env.versions.web ?? ort.env.versions.common;
const ORIGIN = self.location.origin;
const MODELS = `${ORIGIN}/ocr/models/pp-ocrv5-en-mobile`;

export async function createRecognizer() {
  ort.env.wasm.wasmPaths = {
    wasm: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.wasm`,
    mjs: `${ORIGIN}/ocr/ort/${ORT_VERSION}/ort-wasm-simd-threaded.mjs`,
  };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;

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
