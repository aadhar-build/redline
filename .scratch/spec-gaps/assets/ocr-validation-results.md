# OCR validation: ppu-paddle-ocr on real Indian contract scans

Ticket 27, re-scoped on 2026-10-31. The owner chose **ppu-paddle-ocr 6.6.1 (MIT)** with the **PP-OCRv5 English mobile** models, self-hosted and run through the worker-safe `ppu-paddle-ocr/web` entry. This file validates that choice. It does not compare engines: tesseract.js was dropped and never installed.

Run on 2026-10-31 on an Apple M3 (8 cores), macOS. Browsers were Playwright Chromium 156.0.8078.4 (headless shell) and Playwright WebKit 27.2. Harness: `prototypes/ocr-validation/` on branch `prototype/ocr-bake-off`.

## Verdict in four lines

1. **₹ fails completely: 0 of 5 ₹ figures were read correctly.** The 2 "Rs." figures were both read exactly (n=2). The model printed `Z` four times and `2` once (`₹. 17,19,26,000/-` came out as `2. 17,19,26,000/-`). That last case silently prefixes a digit to an amount. The dictionary contains ₹, but the model does not recognise the glyph on these pages.
2. **Skewed scans are unusable without a deskew step.** With stock settings, order-free CER was 22.1%. Adding a dependency-free deskew and `per-box` recognition brought it to **1.5%**. That configuration was picked on the same 8 pages it was scored on. ppu crops axis-aligned boxes, so a 1–2° tilt merges two text lines into one crop, and the output is garbage.
3. **Reading order is good once deskewed.** 92–100% of adjacent reference lines came out in order. Label/value tables (e-stamp certificates, the cost table) read row by row. There are no multi-column pages in the sample, so column order was not tested.
4. **Cost per page:** OCR-specific first load is **15.7 MB gzip** (27.9 MB raw). Median is **3.2 s per page** in Chromium with COOP/COEP (4 threads) and **6.9 s** without them (1 thread). WebKit: 3.8 s isolated, 6.9 s not. The densest page takes up to 11.8 s without isolation.

## Test set

The scans come from `~/redline-samples/scans/`, described in `~/redline-samples/INDEX.md`. They are not in the repo and are referred to by ID only.

| ID | What it is | Text layer | Pages scored |
|---|---|---|---|
| S01 | 2008 MoU photocopy: fold line, 1.2–1.6° skew, handwriting | none | p1, p2 |
| S02 | 2021 concession agreement: Delhi e-stamp page plus dense legal text, Rs./crore | none (1 of 304 pages has text) | p1 (e-stamp), p49 (dense) |
| S03 | 2024 Jharkhand stamp-duty receipt (phone photo, colour) | prior OCR layer, garbled | p1 |
| S04 | 2025 MoU with ₹ amounts and a lakh/crore cost table | prior OCR layer (it read ₹ as `~` / `f.`) | p2, p6 |
| S05 | 2024 Assam e-stamp certificate on guilloche paper | prior OCR layer, garbled | p1 |

Ground truth is my hand transcription of these 8 pages: 16,457 characters after whitespace normalisation, typed from the rendered images before any OCR ran. Seals, logos, QR codes, handwriting, Hindi text, watermark microtext and the illegible "Statutory Alert" fine print are left out. Text the engine reads from those regions counts against ordered CER but not order-free CER. The transcriptions and entity lists are stored outside the repo (`~/redline-tools/truth/`).

**Coverage gaps.** There are 5 ₹ glyphs, all on S04 in one typeface. All lakh/crore figures are typed print. There are no phone photos of paper at an angle, and no multi-column layouts.

## Method

- **Rendering:** pdfjs-dist 6.4.299 renders each page on the main thread at **scale 2**, about 1,000–1,224 × 1,584–1,690 px, roughly 144 dpi. That is close to the embedded scan resolution. Scale 3 was tested and was not better (see variants).
- **Handoff:** the canvas becomes an `ImageBitmap`, which is transferred to a **module Worker**. The worker draws it into an `OffscreenCanvas` and calls `PaddleOcrService.recognize()`.
- **Engine:** PP-OCRv5 mobile detection (`PP-OCRv5_mobile_det_infer.ort`, 4.90 MB) and English recognition (`en_PP-OCRv5_mobile_rec_infer.ort`, 7.96 MB, dictionary `ppocrv5_en_dict.txt` with 437 entries including ₹). The models were downloaded once from the package's Hugging Face catalogue and served from localhost. SHA-256 prefixes: det `30acfc4e`, rec `74ff9e50`, dict `c60d46e9`.
- **Execution provider:** forced to `['wasm']`. Chromium headless reported no WebGPU. WebKit reported WebGPU as available, but it was not used.
- **No CDN at runtime, proven:** Playwright aborts every request to a non-localhost host. **0 external requests** were attempted in all 22 runs.
- **Harness server:** listens on 127.0.0.1 only, rejects foreign Host headers, requires a random per-start token for sample PDFs and `/save/`, and caps request bodies at 20 MB.
  - Gotcha for the real build: `ppu-paddle-ocr/web` sets `ort.env.wasm.wasmPaths` to jsDelivr **at import time** if it is unset. `wasmPaths` has to be set in a module evaluated before ppu is imported (`ort-setup.js`).
- **Scoring (`score.mjs`):**
  - **CER ordered:** whole OCR text in ppu's output order, compared with the whole reference.
  - **CER order-free:** each reference line is matched to its best approximate substring anywhere in the OCR output. This ignores reading order and extra text.
  - **Order kept:** the share of adjacent reference lines whose matches appear in order.
  - **Entities:** exact, whitespace-insensitive matches. Numeric tokens are every whitespace token containing a digit. The other categories (₹/Rs. amounts, lakh/crore figures and words, section numbers, dates, party names) are hand-listed per page. Each rate shows hits/n.

## Results

### Accuracy by configuration (Chromium, all 8 pages)

| Configuration | CER ordered | CER order-free | Numeric tokens (n=97) | Rs. figures (n=2) | "(Rs.)" labels (n=4) | Lakh/crore (n=20) | Sections (n=44) | Dates (n=10) | Parties (n=33) | ₹ figures (n=5) |
|---|---|---|---|---|---|---|---|---|---|---|
| Stock (`per-line`, `maxSideLength:"auto"`), no deskew | 33.8% | 22.1% | 66/97 | 2/2 | 0/4 | 19/20 | 24/44 | 6/10 | 21/33 | 0/5 |
| Render scale 3 | 35.0% | 23.4% | 59/97 | 2/2 | 0/4 | 19/20 | 20/44 | 6/10 | 17/33 | 0/5 |
| Scale 3 + `maxSideLength` 2600 | 30.3% | 20.3% | 72/97 | 2/2 | 2/4 | 19/20 | 27/44 | 6/10 | 22/33 | 0/5 |
| `per-box` strategy, no deskew | 31.4% | 20.1% | 83/97 | 2/2 | 4/4 | 20/20 | 36/44 | 7/10 | 24/33 | 0/5 |
| Deskew, `per-line` | 11.0% | 6.9% | 70/97 | 1/2 | 0/4 | 19/20 | 37/44 | 7/10 | 25/33 | 0/5 |
| **Deskew + `per-box`** (best) | **5.6%** | **1.5%** | **87/97** | **2/2** | **4/4** | **19/20** | **38/44** | **10/10** | **31/33** | **0/5** |
| Deskew + `per-box`, scale 3 | 8.0% | 1.9% | 85/97 | 2/2 | 4/4 | 18/20 | 36/44 | 10/10 | 30/33 | 0/5 |
| Deskew + `per-box`, `minimumConfidence` 0.2 | 5.8% | 1.4% | 88/97 | 2/2 | 4/4 | 19/20 | 38/44 | 10/10 | 31/33 | 0/5 |
| Same best config in WebKit | 6.0% | 1.6% | 86/97 | 2/2 | 4/4 | 19/20 | 38/44 | 9/10 | 31/33 | 0/5 |

The amount evidence is thin. There are only **2 Rs. figures** (`Rs. 115,00,00,000` and `100/-`), both read exactly, and **5 ₹ figures**, none read correctly. The 4 "(Rs.)" e-stamp labels are not amounts and are listed separately. A ₹ figure counts as correct only if the glyph and the number both match. Without the glyph, the digits of all 5 were correct except one `0oo` (see below).

**Caveat: the configuration was tuned on the test pages.** About 13 variants were tried on these same 8 pages, and the best was picked on them. No pages were held out, so expect the 1.5% to be optimistic on new scans.

"Deskew" is a projection-profile search over ±4° in 0.1° steps on a 600-px copy. It is about 60 lines of canvas code in `harness.js` with no dependency, and costs a median of about 0.3 s per page in Chromium and 0.6–0.85 s in WebKit. Detected angles were 1.2°, −1.6°, −0.3°, −0.3°, 0.9°, −0.1°, −0.7° and −0.5°. ppu's own README recommends `DeskewService` from ppu-ocv for this. That service needs OpenCV.js (13.3 MB), which the web entry does not bundle.

### Per page, best configuration (Chromium, deskew + per-box)

| Page | Ref chars | CER ordered | CER order-free | Order kept | Numeric | Amounts and "(Rs.)" labels | Lakh/crore | Sections | Dates | Parties | ₹ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S01-p1 | 2680 | 6.3% | 0.7% | 100% | 8/9 | – | – | 3/4 | 2/2 | 5/6 | – |
| S01-p2 | 2642 | 1.6% | 1.1% | 97% | – | – | – | 11/15 | – | 5/6 | – |
| S02-p1 | 951 | 30.3% | 3.7% | 95% | 8/9 | 2/2 | – | 1/1 | 2/2 | 3/3 | – |
| S02-p49 | 3971 | 1.0% | 0.3% | 96% | 18/20 | 1/1 | 2/2 | 9/10 | – | 2/2 | – |
| S03-p1 | 876 | 4.5% | 1.5% | 94% | 7/7 | 1/1 | – | 2/2 | 1/1 | 3/3 | – |
| S04-p2 | 2371 | 4.8% | 2.4% | 94% | 13/16 | 0/3 | 6/7 | 3/3 | 4/4 | 4/4 | 0/3 |
| S04-p6 | 2201 | 4.1% | 2.3% | 92% | 25/27 | 0/2 | 11/11 | 8/8 | – | 3/3 | 0/2 |
| S05-p1 | 765 | 18.0% | 3.1% | 96% | 8/9 | 2/2 | – | 1/1 | 1/1 | 6/6 | – |

The large ordered-minus-order-free gaps on S02-p1 and S05-p1 come from extra text, not from misordering. The engine reads the excluded "Statutory Alert" fine print and seal text. Order kept is 95–96% on both pages.

### Errors that matter for Redline (best configuration)

Short excerpts only.

- **₹ became a letter or a digit:** `₹. 14,57,00,000/-` → `Z. 14,57,00,000/-`. `₹.17,19,26,000/-` → `Z.17,19,26,000/-`. `₹. 17,19,26,000/-` → `2. 17,19,26,000/-`. A post-processor cannot safely turn a leading `2.` back into ₹.
- **Zeros read as letters inside an amount:** `17,19,26,000/-` → `17,19,26,0oo/-`. The lakh/crore figure no longer matches the source.
- **Section numbers corrupted or dropped:** `(iii)` → `(ii )`, `(vi)` → `()`, `ARTICLE 9.` → `ARTICLE .`. On S01-p2, 11 of 15 roman-numeral markers were exact. For "every flag cites its source sentence", a wrong clause number is a silent citation error.
- **Bold headings misread:** the S02 heading `9.1 Performance Security` came back as `9.1`, or as `9.1 | o anc rity` at confidence 0.2. Body text on the same page was 0.3% CER.
- **Labels dropped silently:** on S02-p1 the `Second Party` label, printed over the emblem watermark, was not detected at all. Its value was read.
- **Look-alike glyphs:** `AAI` → `AAl`, `dl942203` → `dI942203`, `IMPACC` → `JMPACC`, `acquire` → `acqujre`.
- **Stock settings on skewed pages:** two lines get merged per crop. One S01 line came out as `cYanmaG nttaYe` with no error raised, at line confidence 0.5–0.7.

### Reading order (dense pages)

- **S02-p49** (dense legal text, about 47 lines, hanging section numbers): 96% of adjacent lines are in order. Section numbers come back as a separate box at the start of their line (`9.1.1 | The Concessionaire shall…`), which is the right order. The misses are the dropped or garbled headings above, not reordering.
- **S04-p6** (bordered cost table plus numbered clauses): rows are read left to right as `S.No | Description | Amount`. A wrapped cell (`with furniture`) comes out on its own line after its row. Order kept is 92%.
- **E-stamp certificates** (S02-p1, S05-p1): label/value pairs stay on one row, for example `Certificate No. | IN-DL3137…`. The vertical microtext border and the seal text are read too and need filtering.
- **Without deskew,** order kept drops to 65–70% on the skewed pages, because merged boxes jump lines.
- **Not tested:** multi-column pages, and stamp paper with text running around a printed border.

### Speed and size (deskew + per-box, scale 2)

| Browser | Isolated (COOP/COEP) | WASM threads | Engine init | OCR per page, median (min–max), n=8 | pdfjs render, median | Deskew, median |
|---|---|---|---|---|---|---|
| Chromium 156 | yes | 4 | 0.82 s | **3.22 s** (1.61–5.63) | 39 ms | 0.32 s |
| Chromium 156 | no | 1 | 0.90 s | **6.89 s** (3.03–11.76) | 34 ms | 0.31 s |
| WebKit 27.2 | yes | 4 | 1.01 s | **3.80 s** (1.96–6.19) | 38 ms | 0.85 s |
| WebKit 27.2 | no | 1 | 1.10 s | **6.86 s** (3.20–11.80) | 56 ms | 0.63 s |

- **Slowest page:** always S02-p49, the densest page, with about 4,000 characters.
- **`per-box` vs `per-line`** (both deskewed, isolated Chromium): 3.22 s against 3.41 s median, about the same. `per-box` is not slower here, and it is much more accurate.
- **Re-measured:** these rows replace a first set of runs. The first driver compressed every response during the OCR phase, including the 64 MB S02 PDF, which competed for CPU. Those runs were 3.57 / 8.36 / 3.98 / 7.48 s, so 4–18% slower, and up to 30% slower on S02-p49.
- **Single runs:** each row is one run, so treat differences under about 15% as noise.

**First-load bytes,** measured from response bodies in a fresh browser context:

| Part | Raw | gzip | brotli |
|---|---|---|---|
| Models (det + rec + dict) | 12.86 MB | 11.84 MB | 11.76 MB |
| ORT wasm, `onnxruntime-web/wasm` entry (`ort-wasm-simd-threaded.wasm`) | 14.85 MB | 3.81 MB | 2.80 MB |
| ORT + ppu JS | 0.16 MB | 0.06 MB | 0.06 MB |
| **OCR-specific total** | **27.87 MB** | **15.70 MB** | **14.61 MB** |
| Same, but via the default `import "onnxruntime-web"` (JSEP wasm) | 42.88 MB | 18.95 MB | 16.72 MB |

- pdfjs-dist (0.86 MB raw, plus its worker) is excluded because Redline loads it anyway.
- The model files barely compress. A CDN-free deploy serves roughly 12 MB of models per first visit unless they are cached, for example with Cache Storage.
- A bundler resolves `import "onnxruntime-web"` to the build that pulls the 29.5 MB JSEP/WebGPU wasm even when only the wasm EP is used. Aliasing it to `onnxruntime-web/wasm` saves 14.7 MB raw (3.2 MB gzip).
- In the very first run, the JSEP build took 24 s to initialise. That did not reproduce: later JSEP runs took 1.1–1.6 s and wasm-only runs took 0.8–1.7 s.
- The web entry did **not** pull OpenCV.js (`@techstark/opencv-js`, 13.3 MB). ppu-ocv is installed as a dependency, but nothing requested its OpenCV file.

## Trade-offs for the owner (no recommendation)

- **₹:** stock PP-OCRv5 English does not read ₹ on these pages, even though its dictionary has the glyph. The options all need a decision:
  - fine-tune or swap the recogniser (ppu documents fine-tuning)
  - test the v6 or Devanagari models, which are not covered here
  - treat any amount OCR'd from a scan as unverified and say so in the UI
  - keep refusing scans (the current CLAUDE.md rule)

  Output like `2. 17,19,26,000/-` makes post-hoc repair unsafe.
- **Deskew is mandatory, and it is Redline's code.** Options: a small in-house projection-profile deskew like the one in this harness, adding about 0.3–0.7 s per page; or ppu-ocv `DeskewService`, which adds 13.3 MB of OpenCV.js. Both were measured only on skews up to 1.6°. Phone photos at larger angles or with perspective distortion are untested.
- **Cross-origin isolation buys about 1.8–2.1× speed.** Without it a dense page takes about 12 s. With it, the whole site needs COOP/COEP headers, which constrains third-party embeds and cross-origin resources.
- **Confidence is per box.** Garbled crops still scored 0.5–0.7, and the default `minimumConfidence` of 0.5 let that garbage through. Confidence alone cannot be the trust gate for a cited sentence.
- **The silent failures are the dangerous ones:** dropped labels and headings, `0oo`, `(ii )`, and the extra `2.`. Redline's rule that a cited sentence must match the stored text would pass OCR mistakes through, because the stored text would be the OCR output.

## Also observed

- S03, S04 and S05 are scans that already carry someone else's OCR text layer, and it is wrong in places: ₹ appears as `~` or `f.`, and `Goyernment` for `Government`. A "has a text layer" check would accept them as text PDFs.
- The page-image route works in WebKit unchanged: module workers, `OffscreenCanvas` and transferred `ImageBitmap`s all work. Real Safari on iOS was not tested.

## Changes on this branch only

- Dependencies are in `prototypes/ocr-validation/package.json`, not the app: `ppu-paddle-ocr` and `pdfjs-dist` (approved), plus `onnxruntime-web` (ppu's required peer) and `playwright` for the driver. tesseract.js was not installed.
- Model binaries, samples, renders, transcriptions and raw OCR output are all outside the repo (`~/redline-tools/`, `~/redline-samples/`) and are not committed.
- To reproduce:
  1. `npm i` in `prototypes/ocr-validation/`
  2. Download the three model files from the URLs in `node_modules/ppu-paddle-ocr/model-catalogue.js` (`V5_EN_MOBILE_MODEL`) into a folder, saved as `det.ort`, `rec.ort` and `dict.txt`.
  3. `HARNESS_TOKEN=… BASE_PORT=4341 MODELS_DIR=… SAMPLES_DIR=… OUT_DIR=… bash serve-all.sh` (it generates and prints a token if none is given)
  4. `HARNESS_TOKEN=… OUT_DIR=… TRUTH_DIR=… PLAN=… bash variants.sh <name> http://localhost:4342/ chromium 2 "strategy=per-box&deskew=1"` (BASE_PORT+1 is the isolated server)
  5. `node summarize.mjs <run.json>`
