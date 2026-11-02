#!/usr/bin/env node
// Puts everything the in-browser OCR step (ADR 0008, ticket 23) loads into public/ocr/, so the browser
// fetches it from Redline itself and never from a CDN or Hugging Face at runtime. Runs before every
// build and dev server (package.json), after the pdf.js copy; output is gitignored.
//
//  - ONNX Runtime Web: ort-wasm-simd-threaded.wasm and its .mjs glue, copied from the installed
//    onnxruntime-web into public/ocr/ort/<version>/. Only the plain WASM build is used (no JSEP or
//    WebGPU): next.config.mjs aliases "onnxruntime-web" to "onnxruntime-web/wasm".
//  - The PP-OCRv6 small detection and recognition models and ppocrv6_dict.txt (the files of
//    ppu-paddle-ocr's V6_SMALL_MODEL preset, research 31), into public/ocr/models/pp-ocrv6-small/.
//    PaddlePaddle's official models, Apache-2.0, via ppu's Apache-2.0 mirror. They are not in any npm
//    package and are never committed (the repo is public, and they are 31.3 MB). They are downloaded once, at install or build time,
//    from the Hugging Face repo ppu-paddle-ocr points at, pinned to one commit, and each file's SHA-256
//    is checked: a mismatch fails the build. Downloads are cached in node_modules/.cache/redline-ocr/
//    so a dev start does not download them again.
//    Offline: set REDLINE_OCR_MODELS_DIR to a folder holding det.ort, rec.ort and dict.txt; the same
//    hashes are checked.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Hugging Face snowfluke/ppu-paddle-ocr-models (Apache-2.0), commit of 2026-08-25. Hashes match the
// files OCR engine round 2 (research 31) measured.
const MODEL_REVISION = "bf1d5edb0335d3262be7caf13f766ba274b4cadd";
const MODEL_BASE = `https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/${MODEL_REVISION}`;
export const MODEL_FOLDER = "pp-ocrv6-small";
export const MODELS = [
  {
    name: "det.ort",
    url: `${MODEL_BASE}/detection/ort/PP-OCRv6_small_det.ort`,
    sha256: "c21be8d8268f0f45e2693b1d52432a290a56d008f6c1ff28b4baa7c35bab250e",
  },
  {
    name: "rec.ort",
    url: `${MODEL_BASE}/recognition/ort/PP-OCRv6_small_rec.ort`,
    sha256: "40bccd9fa3ae2d14d724bf9d020c8f0edfc801489477b92f7449162a538366df",
  },
  {
    name: "dict.txt",
    url: `${MODEL_BASE}/recognition/ppocrv6_dict.txt`,
    sha256: "41557512862dfe31970cf22407742b629725461dd84c0d8771bde9c87c2202c8",
  },
];

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const matches = (file, hash) => fs.existsSync(file) && sha256(file) === hash;

async function download(url, to) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`OCR model download failed: ${res.status} ${url}`);
  const tmp = `${to}.part`;
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, to);
}

async function main() {
  const ortDir = path.join(root, "node_modules/onnxruntime-web");
  const { version } = JSON.parse(fs.readFileSync(path.join(ortDir, "package.json"), "utf8"));
  const outRoot = path.join(root, "public/ocr");
  const ortOut = path.join(outRoot, "ort", version);
  const modelsOut = path.join(outRoot, "models", MODEL_FOLDER);
  const cache = path.join(root, "node_modules/.cache/redline-ocr", MODEL_FOLDER);
  const localDir = process.env.REDLINE_OCR_MODELS_DIR;

  fs.mkdirSync(cache, { recursive: true });
  for (const m of MODELS) {
    const cached = path.join(cache, m.name);
    if (matches(cached, m.sha256)) continue;
    if (localDir) fs.copyFileSync(path.join(localDir, m.name), cached);
    else await download(m.url, cached);
    if (!matches(cached, m.sha256)) {
      fs.rmSync(cached, { force: true });
      throw new Error(`OCR model ${m.name} does not match its pinned SHA-256; refusing to use it`);
    }
  }

  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(ortOut, { recursive: true });
  fs.mkdirSync(modelsOut, { recursive: true });
  for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
    fs.copyFileSync(path.join(ortDir, "dist", f), path.join(ortOut, f));
  }
  for (const m of MODELS) fs.copyFileSync(path.join(cache, m.name), path.join(modelsOut, m.name));
  console.log(`OCR assets copied to public/ocr/ (onnxruntime-web ${version}, PP-OCRv6 small)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
