// The browser side of OCR (ADR 0008, ticket 23). Browser-only. pdf.js renders a page that needs OCR
// onto a canvas here, on the main thread; the image is transferred to the OCR worker (ocr-worker.js),
// which straightens and reads it. Nothing leaves the browser: the page image, the models and the
// result all stay in this tab.
//
// createOcrEngine() returns the engine readPdf (pdf.js) takes:
//   readPage(page, { signal }) -> the page's lines, { text, top }[]
//   close()                    -> stops the worker
// A cancelled read rejects with an AbortError and stops the worker; any other failure is an OcrError.

// Scale 2 is about 144 dpi, close to the embedded scan resolution; scale 3 was not better (validation).
export const RENDER_SCALE = 2;

export class OcrError extends Error {
  constructor(message) {
    super(`redline-ocr: ${message}`);
    this.name = "OcrError";
  }
}

const abortError = () => new DOMException("The OCR run was cancelled", "AbortError");

export function createOcrEngine() {
  let worker = null;
  let ready = null;
  let stopReady = null; // rejects ready, so a cancel while the models load does not wait for them
  let nextId = 1;
  const pending = new Map();

  function fail(err) {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  }

  function start() {
    worker = new Worker(new URL("./ocr-worker.js", import.meta.url), { type: "module" });
    ready = new Promise((resolve, reject) => {
      stopReady = reject;
      worker.onmessage = (event) => {
        const msg = event.data ?? {};
        if (msg.type === "ready") return resolve();
        if (msg.type === "error" && msg.id === null) return reject(new OcrError(msg.message));
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.type === "lines") p.resolve(msg.lines);
        else p.reject(new OcrError(msg.message));
      };
      worker.onerror = (event) => {
        const err = new OcrError(event?.message || "the OCR worker stopped");
        reject(err);
        fail(err);
      };
    });
    // A rejection here is reported through readPage; this keeps it from being unhandled.
    ready.catch(() => {});
  }

  function close() {
    worker?.terminate();
    worker = null;
    stopReady?.(abortError());
    stopReady = null;
    ready = null;
    fail(abortError());
  }

  async function render(page) {
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const bitmap = await createImageBitmap(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return bitmap;
  }

  async function readPage(page, { signal } = {}) {
    if (signal?.aborted) throw abortError();
    if (!worker) start();
    const waitFor = ready;
    const onAbort = () => close();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const bitmap = await render(page);
      if (signal?.aborted) {
        bitmap.close();
        throw abortError();
      }
      await waitFor;
      if (!worker) throw abortError();
      const id = nextId++;
      const lines = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      worker.postMessage({ type: "page", id, bitmap }, [bitmap]);
      return await lines;
    } catch (err) {
      if (signal?.aborted) throw abortError();
      throw err instanceof OcrError ? err : new OcrError(String(err?.message ?? err));
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return { readPage, close };
}
