// Module worker: owns the ppu-paddle-ocr service (PP-OCRv5 English mobile,
// self-hosted model files, WASM execution provider only).
import { ort } from './ort-setup.js';
import { PaddleOcrService, isWebGpuAvailable } from 'ppu-paddle-ocr/web';

let service;

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      const t0 = performance.now();
      const o = msg.overrides || {};
      const detection = {};
      const recognition = {};
      if (o.maxSideLength !== undefined) detection.maxSideLength = o.maxSideLength;
      if (o.strategy) recognition.strategy = o.strategy;
      if (o.minimumConfidence !== undefined) recognition.minimumConfidence = o.minimumConfidence;
      service = new PaddleOcrService({
        model: {
          detection: '/models/det.ort',
          recognition: '/models/rec.ort',
          charactersDictionary: '/models/dict.txt',
        },
        detection,
        recognition,
        session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
      });
      await service.initialize();
      self.postMessage({
        type: 'ready',
        overrides: o,
        initMs: performance.now() - t0,
        crossOriginIsolated: self.crossOriginIsolated,
        numThreads: ort.env.wasm.numThreads,
        hardwareConcurrency: self.navigator.hardwareConcurrency,
        webGpuAvailable: await isWebGpuAvailable(),
        ortVersion: ort.env.versions,
      });
    } else if (msg.type === 'ocr') {
      const { bitmap } = msg;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close();
      const t0 = performance.now();
      const result = await service.recognize(canvas);
      const ocrMs = performance.now() - t0;
      self.postMessage({
        type: 'result',
        ocrMs,
        text: result.text,
        confidence: result.confidence,
        lines: result.lines.map((line) =>
          line.map((w) => ({ text: w.text, box: w.box, confidence: w.confidence })),
        ),
      });
    }
  } catch (e) {
    self.postMessage({ type: 'error', error: String(e && e.stack ? e.stack : e) });
  }
};
