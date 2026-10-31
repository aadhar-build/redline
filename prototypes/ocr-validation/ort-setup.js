// Must be imported before ppu-paddle-ocr/web: that module sets
// ort.env.wasm.wasmPaths to jsDelivr at import time if it is still unset.
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = self.location.origin + '/nm/onnxruntime-web/dist/';
const threads = Number(new URL(self.location.href).searchParams.get('threads') || 0);
if (threads) ort.env.wasm.numThreads = threads;
export { ort };
