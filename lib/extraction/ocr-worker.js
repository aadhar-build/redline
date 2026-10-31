// The OCR worker (ADR 0008, ticket 23): a module Worker that runs the OCR engine
// (ocr-engine.js). It receives one rendered page image at a time, straightens it (deskew.js),
// reads it, and returns the page's lines. Everything it loads comes from Redline's own origin
// (scripts/copy-ocr-assets.mjs fills public/ocr/).
//
// The engine itself sits behind ocr-engine.js (the seam: a page image in, lines with boxes out);
// this worker only straightens the page and shapes the lines, whatever the engine.
//
// Messages in:  { type: "page", id, bitmap }   (an ImageBitmap, transferred)
// Messages out: { type: "ready" } once, then { type: "lines", id, lines, angle } or
//               { type: "error", id, message }

import { estimateSkew, rotate } from "./deskew.js";
import { createRecognizer } from "./ocr-engine.js";
import { ocrPageLines } from "./ocr-lines.js";

const makeCanvas = (w, h) => new OffscreenCanvas(w, h);

const ready = createRecognizer();
ready.then(
  () => self.postMessage({ type: "ready" }),
  (err) => self.postMessage({ type: "error", id: null, message: String(err?.message ?? err) }),
);

self.onmessage = async (event) => {
  const { type, id, bitmap } = event.data ?? {};
  if (type !== "page") return;
  try {
    const engine = await ready;
    const page = makeCanvas(bitmap.width, bitmap.height);
    page.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    const angle = estimateSkew(page, makeCanvas);
    const straight = rotate(page, angle, makeCanvas);
    const result = await engine.recognize(straight);
    self.postMessage({ type: "lines", id, angle, lines: ocrPageLines(result, straight.height) });
  } catch (err) {
    self.postMessage({ type: "error", id, message: String(err?.message ?? err) });
  }
};
