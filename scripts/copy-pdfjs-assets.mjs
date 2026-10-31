#!/usr/bin/env node
// Copies the pdf.js worker and the assets it fetches (CMaps, standard fonts, image-decoder wasm) from
// the installed pdfjs-dist into public/pdfjs/<version>/, so the browser loads them from Redline itself
// and never from a CDN. The worker must be the exact version of the library (pdf.js FAQ), which the
// versioned folder guarantees. Runs before every build and dev server (package.json); output is
// gitignored.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(root, "node_modules/pdfjs-dist");
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
const outRoot = path.join(root, "public/pdfjs");
const out = path.join(outRoot, version);

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(pkgDir, "build/pdf.worker.min.mjs"), path.join(out, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
  fs.cpSync(path.join(pkgDir, dir), path.join(out, dir), { recursive: true });
}
console.log(`pdf.js ${version} assets copied to public/pdfjs/${version}/`);
