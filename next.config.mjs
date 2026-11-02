/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16 otherwise writes a generated section into the tracked CLAUDE.md on every dev start.
  agentRules: false,
  turbopack: {
    resolveAlias: {
      // ppu-paddle-ocr imports "onnxruntime-web", whose default build carries the 29.5 MB JSEP/WebGPU
      // wasm. Redline runs OCR on the plain WASM backend only (spec-gaps 24), so every import of it
      // resolves to the WASM build, and the OCR worker and ppu share one ONNX Runtime and one env
      // (lib/extraction/ocr-worker.js).
      "onnxruntime-web": "onnxruntime-web/wasm",
    },
  },
};

export default nextConfig;
