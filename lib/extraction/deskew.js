// Straightens a scanned page before OCR (spec-gaps 24, carried over from the OCR validation harness on
// prototype/ocr-bake-off). ppu-paddle-ocr crops axis-aligned boxes, so a page tilted by 1-2 degrees has
// two text lines merged into one crop and comes out as garbage; with this step the validation run's
// error rate fell from 22.1% to 1.5%. No dependency: a projection-profile search over small angles.
//
// On a 600-pixel-wide copy, for each angle from -MAX_ANGLE to +MAX_ANGLE in STEP-degree steps, the page
// is rotated and the dark pixels in each row counted; the angle whose row counts vary the most makes
// the text lines horizontal. The page is then rotated back by that angle on a white background.
//
// Works on a canvas or OffscreenCanvas (it runs in the OCR worker); makeCanvas(width, height) creates
// one. rowVariance is pure and unit-tested.

export const MAX_ANGLE = 4;
export const STEP = 0.1;
export const SAMPLE_WIDTH = 600;
const DARK = 384; // r + g + b below this is ink

/**
 * The variance of the per-row count of dark pixels in RGBA image data.
 * @param {Uint8ClampedArray | number[]} data RGBA bytes, row by row
 * @param {number} width
 * @param {number} height
 */
export function rowVariance(data, width, height) {
  let sum = 0;
  let sumSq = 0;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < DARK) row++;
    }
    sum += row;
    sumSq += row * row;
  }
  return sumSq / height - (sum / height) ** 2;
}

/** The skew of the page in degrees, to one decimal place. */
export function estimateSkew(source, makeCanvas) {
  const w = SAMPLE_WIDTH;
  const h = Math.max(1, Math.round((source.height * w) / source.width));
  const tmp = makeCanvas(w, h);
  const ctx = tmp.getContext("2d", { willReadFrequently: true });
  let best = { angle: 0, score: -1 };
  const steps = Math.round(MAX_ANGLE / STEP);
  for (let i = -steps; i <= steps; i++) {
    const angle = i * STEP;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-angle * Math.PI) / 180);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    const score = rowVariance(ctx.getImageData(0, 0, w, h).data, w, h);
    if (score > best.score) best = { angle, score };
  }
  return Math.round(best.angle * 10) / 10;
}

/** The source rotated by -angle degrees on white, or the source itself when angle is 0. */
export function rotate(source, angle, makeCanvas) {
  if (!angle) return source;
  const out = makeCanvas(source.width, source.height);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((-angle * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}
