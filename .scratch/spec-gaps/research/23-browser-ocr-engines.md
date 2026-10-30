# 23 · OCR engines that run fully in the browser

Question: which maintained OCR engines run entirely client-side in a Next.js 16 / React 19 app, fed page images rendered by pdfjs-dist, and how do they compare on licence, size, self-hosting, speed, accuracy on dense printed English, confidence output and the ₹ sign?

Researched 2026-10-31. Versions, dates and licences come from the npm registry (`registry.npmjs.org/<pkg>`). File sizes are from jsDelivr listings (`data.jsdelivr.com/v1/packages/npm/<pkg>@<ver>`) and the Hugging Face tree API. They are **uncompressed**. Repo health is from the GitHub API. Nothing was installed or run in a browser. **No per-page browser timing was measured for any engine, and no engine was tested on an Indian contract.** Those are gaps for ticket 24's spike.

## Snapshot

| Engine | Latest | Released | Licence | Weekly dl | Repo health |
|---|---|---|---|---|---|
| tesseract.js (Tesseract 5 LSTM in WASM) | 7.0.0 | 2025-12-15 | Apache-2.0 | ~5.0M | 38.8k stars, pushed 2026-05-17, 59 open issues |
| scribe.js-ocr (builds on tesseract.js) | 0.17.0 | 2026-10-27 | **AGPL-3.0** | ~14.8k | 323 stars, pushed 2026-10-30 |
| @paddleocr/paddleocr-js (official PaddleOCR.js, ORT-web) | 0.4.2 | 2026-06-11 | Apache-2.0 | ~19.6k | in the PaddlePaddle/PaddleOCR monorepo, first published 2026-04-02 |
| ppu-paddle-ocr (third-party PaddleOCR, ORT-web) | 6.6.1 | 2026-10-08 | MIT | ~50.5k | 145 stars, pushed 2026-10-17, 0 open issues |
| @gutenye/ocr-browser (PaddleOCR, ORT-web) | 1.4.9 | 2026-09-19 | MIT | ~6.4k | 212 stars, pushed 2026-09-19 |
| tesseract-wasm (robertknight) | 0.11.0 | 2025-10-24 | BSD-2-Clause | n/a | 387 stars, pushed 2025-11-17 |

## Reproducible ₹ check (deciding fact for Indian contracts)
A recogniser can only output characters in its character set. I counted UTF-8 byte sequences in each file. € and £ are the controls: they show the method finds a currency sign when one is present.
- tesseract.js default English data `@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz`: **₹ 0**, € 3, £ 9. Legacy `4.0.0/eng.traineddata.gz`: **₹ 0**, € 8, £ 20. The upstream training charset `tesseract-ocr/langdata_lstm/eng/eng.unicharset` (113 entries) also has no ₹, while it has $, £ and €. `script/Latin` has no ₹. `hin` and `script/Devanagari` do have it.
- PaddleOCR dictionaries: `ppocrv5_en_dict.txt` (English v5), `ppocrv6_dict.txt` and `ppocrv6_tiny_dict.txt` contain ₹. `ppocr_keys_v1.txt` does not. That is the Chinese v4 dictionary used in the gutenye and paddleocr-browser examples. `en_dict.txt` does not either.
- So stock Tesseract English **cannot emit ₹**. It will substitute some other glyph or drop it. "Rs." and digits are in the set. Loading `eng+hin` would put ₹ in the set, but that is **untested**, and the effect on English accuracy is unknown. A Paddle dictionary that contains ₹ shows the model *can* output it, not that it reads it reliably.

## tesseract.js
- **Size.** Core v7 ships six loader variants: plain, simd and relaxedsimd, each with or without the legacy engine. The LSTM-only loaders the browser actually fetches are `tesseract-core-simd-lstm.wasm.js` 3.90 MB or `-relaxedsimd-lstm.wasm.js` 3.91 MB. English `best_int` data is 2.95 MB gz, so about 7 MB per first visit. The docs say "~15MB in code and data" across the full set (https://github.com/naptha/tesseract.js/blob/master/docs/performance.md).
- **Self-hosting.** By default it fetches the core from jsDelivr and language data from a CDN. Set `workerPath`, `corePath` (a directory, not a single file) and `langPath` to same-origin paths (https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md, docs/api.md). Gotchas:
  - The docs still say `corePath` needs "all 4" files, but v7 ships six. The relaxedsimd files are new, so the docs are stale.
  - The npm `latest` tag for tesseract.js-core is 6.1.2, while tesseract.js 7.0.0 pins `^7.0.0`. Copy files from the version that is actually installed.
  - `workerBlobURL` defaults to true, so a strict CSP needs `worker-src blob:`.
  - Data is cached in IndexedDB (`cacheMethod`).
- **Speed.** v7's release note gives a relative figure only: "reduces runtimes by ~15-35%" against v6 (https://github.com/naptha/tesseract.js/releases/tag/v7.0.0). There is no official per-page figure. Issue threads report seconds-per-image numbers from old versions and Node (#148, #916). Those are snippet-level and not comparable. Measure it.
- **Accuracy.** The FAQ says engine accuracy is out of scope because it is "the JavaScript/Webassembly port… We do not edit the underlying Tesseract recognition engine" (docs/faq.md). For evidence, see the scribe benchmark below.
- **Confidence.** `Line`, `Word` and `Symbol` all carry `confidence`, and `Word` has `choices` (src/index.d.ts). Since v6, every output except `text` is **off by default**. Request it with `worker.recognize(img, {}, { blocks: true })` (v6.0.0 release notes). The output also includes paragraph and line structure, which bears on reading order for ticket 09.
- **Next.js.** It runs in its own Web Worker. The FAQ's "Cannot find module" fix is to set `workerPath`, because bundlers move the files. It needs `'use client'` and a dynamic import. Use one reused worker or a fixed-size scheduler, never a worker per page (performance.md).

## scribe.js
- **What it adds.** Optional custom recognition on top of Tesseract. The default `quality` mode runs extra recognition, "often in the range of a 40-90% increase" in runtime over `speed` mode (https://github.com/scribeocr/scribe.js/blob/master/docs/scribe_vs_tesseract.md). It also has its own PDF path (`usePDFText`, `keepPDFTextAlways`). Under the owner's decision Redline would bypass that and feed it pdfjs-rendered images.
- **Licence.** Scribe's own doc says that whether you use it "on the front-end or server-side--you must either (1) publish your program under AGPL 3.0 or a compatible license or (2) obtain a proprietary license". Redline has no LICENSE file, and `package.json` is `"private": true` even though the GitHub repo is public. This is an owner decision.
- **Size.** 46.6 MB unpacked, which includes fonts. Its vendored Tesseract cores are about 4.1 MB each. Scribe says `quality` mode "loads more language data than Tesseract.js does by default".
- **Self-hosting.** "All files must be served from the same origin… importing Scribe.js from a CDN will not work" (README). `scribe.opt.langPath` defaults to `null`, which means "fetch from the jsdelivr CDN" (docs/API.md). Set it to a local directory.
- **₹.** Its worker forwards `langPath` to tesseract.js (`js/worker/generalWorker.js`), so it uses the same `.traineddata` files and almost certainly has the same gap. Whether its custom model adds characters was not verified.
- **Accuracy.** This is the authors' own benchmark (https://github.com/scribeocr/ocr-benchmark). Average word accuracy is Tesseract.js 84.76% against Scribe.js 93.65% on a corpus that is "intentionally difficult". The authors say both "routinely achieve >97% accuracy with high-quality inputs with simple layouts". The rows closest to contracts:

  | Document | Tesseract.js | Scribe.js |
  |---|---|---|
  | deposition_01 | 92.63% | 99.65% |
  | deposition_02 | 81.48% | 98.94% |
  | filing_01 | 99.45% | 98.91% |
  | filing_03 | 97.68% | 98.84% |
  | singlecol_01 | 97.65% | 100% |

  The benchmark compares at word level and does not check word order.
- **Confidence.** `OcrWord { text, conf (0-100), bbox, style, chars }` (docs/API.md).
- **Next.js.** There is an official template at https://github.com/scribeocr/scribe.js-example-next.js (not inspected). `usePdfSharedBuffer` needs COOP/COEP.

## PaddleOCR family (ONNX Runtime Web)
- **Shared runtime cost.** `onnxruntime-web` 1.31.1 (MIT, 2026-10-26):
  - The WASM binary is `ort-wasm-simd-threaded.wasm` 14.8 MB, or `.jsep.wasm` 29.5 MB for WebGPU.
  - Multithreading needs a cross-origin-isolated page (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`). Otherwise `numThreads` is pinned to 1 (ppu README). In Next.js that means a headers change, and it constrains every third-party embed site-wide.
  - If `ort.env.wasm.wasmPaths` is unset, the WASM files load from jsDelivr.
- **Confidence.** Per **line** only: `score` (official) or `score` on each `TextLine` (gutenye), plus a box. None of these docs mention word confidence. That is coarser than Tesseract when a single misread digit matters.
- **Reading order.** Output is a list of detected boxes. Assembling those into reading order on a dense page is Redline's job. That ties to ticket 09.
- **Official @paddleocr/paddleocr-js.**
  - Options: `lang`, `ocrVersion` ("PP-OCRv5"), `worker: true`, `ortOptions.wasmPaths`. Custom models are self-hosted through `textDetectionModelAsset`/`textRecognitionModelAsset` `{ url }` pointing to an uncompressed `.tar`.
  - COOP/COEP is needed for threads or WebGPU. Bundles OpenCV.js. 23.8 MB unpacked.
  - **Where the built-in models download from was not found**, so treat it as unknown.
  - The docs give no performance numbers. Source: https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html, read through a fetch summary rather than verbatim.
- **ppu-paddle-ocr.**
  - Has a `/web` entry that is worker-safe (OffscreenCanvas). Ships its own PP-OCRv6 multilingual family; the README's description is taken unverified.
  - English sizes: v5 English mobile is det 4.75 MB + rec 7.86 MB (int8 7.0 MB). v6 tiny is det 1.78 MB + rec 4.46 MB, and its README says "~6.9k-char dictionary". v6 small is 9.9 + 21.2 MB, and the README recommends it for "dense pages".
  - Models default to Hugging Face (`huggingface.co/snowfluke/ppu-paddle-ocr-models`), mirrored on GitHub. Self-host by pointing `model.detection`/`model.recognition`/`charactersDictionary` at your own URLs.
  - `minimumConfidence` defaults to 0.5. The README says "noise reads at 0.2-0.45, real text at 0.65+".
  - Its benchmark is ~140 ms on an Apple M1 **under Bun, on a receipt**. That is not a browser figure and not a dense page. Its claim that the official SDK is "significantly slower" is the vendor's own and was not verified.
- **@gutenye/ocr-browser.** The browser build has no default models, and you must serve them yourself. The README example uses Chinese PP-OCRv4 (det 4.7 MB + rec 10.8 MB + `ppocr_keys_v1`, which has **no ₹**). It says v5 server models are "~85MB each… usually too large" for a browser.

## Others (not recommended for evaluation)
- **tesseract-wasm** (BSD-2): a smaller Tesseract build. Last release 2025-10, and the same eng data applies.
- **docTR**: the only browser artefact is `mindee/doctr-tfjs-demo`, a demo rather than a package, with no push since 2024-04-05.
- **@paddlejs-models/ocr**: last release 2023-11, and Paddle.js was last pushed 2024-04.
- **esearch-ocr / paddleocr-browser**: small single-maintainer wrappers. The paddleocr-browser README loads everything from CDNs.
- **client-side-ocr**: a React demo app, last released 2025-07.
- **@huggingface/transformers** 4.3.2 can run OCR-capable vision models such as TrOCR or Florence-2 in the browser. These are generative: they can output fluent text that is not on the page, which makes them a poor fit for word-for-word verification. Not researched further.

## Trade-offs (observation, not a decision)
- No single engine wins on all three axes that matter most here:
  - **₹:** Paddle English, v5 and v6 dictionaries have it. Stock Tesseract and scribe do not.
  - **Word-level confidence:** Tesseract and scribe have it. Paddle has line-level only.
  - **Licence:** tesseract.js and Paddle are permissive. Scribe is AGPL.
- tesseract.js is the lightest to adopt: about 7 MB, no COOP/COEP requirement, structured layout and word and character confidence. Its ₹ gap would need a workaround, such as `eng+hin` or post-processing. Either one would need testing.
- Scribe's own benchmark shows a large gain on legal-style pages, but it brings the AGPL obligation.
- Paddle via ppu or the official SDK covers ₹ and has fresher models. The costs are a 15 MB+ ORT runtime, site-wide COOP/COEP for speed, line-only confidence, and reading order Redline has to assemble itself.
- Ticket 24 should time each candidate on real stamp-paper scans and phone photos, rendered by pdfjs-dist in Chrome and Safari. It should score digits, ₹/Rs., lakh/crore figures, section numbers and party names against a hand transcription.
