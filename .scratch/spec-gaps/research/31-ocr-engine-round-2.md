# 31 · OCR engine, round 2: is there a better engine than PP-OCRv5 English mobile?

Question: is there an in-browser OCR engine that reads these Indian contract scans better than the current choice (ppu-paddle-ocr 6.6.1 with PP-OCRv5 English mobile det + rec)? Better means fewer altered amounts, ₹ signs and clause numbers, and no dropped lines. Fixed constraints: it runs in the browser, uses no COOP/COEP (so one WASM thread), and every model is self-hosted under `public/`.

Run 2026-10-31 on an Apple M3 (8 cores), macOS. It follows research 23 and the round-1 validation (`.scratch/spec-gaps/assets/ocr-validation-results.md` on branch `prototype/ocr-bake-off`).

## Answer

**Switch the models to PP-OCRv6 small (detection + recognition), and keep the same package (ppu-paddle-ocr) and runtime (onnxruntime-web).** Ship an amount and clause-number post-check alongside it. This engine still does not print ₹. Instead of turning it into `Z` or `2`, though, it leaves the glyph out, and the post-check catches every one of those gaps (5 of 5). Nothing new goes into `package.json`. The change is three model URLs plus about 60 lines of post-check code.

## Test set and method

- **Pages.** These are the same 8 hand-transcribed pages as round 1 (S01-p1, S01-p2, S02-p1, S02-p49, S03-p1, S04-p2, S04-p6, S05-p1): 16,457 reference characters and 264 reference lines. The transcriptions and entity lists are the round-1 ground truth, kept outside the repo. The scans stay in `~/redline-samples` and every output stays in the scratch dir. No document text appears in this note.
- **Held-out split.** No setting was tuned in this round. Every Paddle candidate ran with the round-1 settings (projection-profile deskew, `per-box` recognition, pdfjs render scale 2, default thresholds). Round 1 chose those settings on these same 8 pages, which flatters the **baseline** more than the newcomers. To make the comparison fairer, the **held-out CER** column counts only S01-p2, S02-p1, S03-p1, S04-p6 and S05-p1. S01-p1, S02-p49 and S04-p2 serve as the dev pages for the choices made in this note (hybrids, post-check). The post-check rules were written from round-1 error types seen on these pages, so its catch rate is **not** a held-out number.
- **Metrics.** The round-1 `score.mjs` is unchanged:
  - CER is order-free: each reference line is matched to its best substring.
  - Numeric tokens: every token containing a digit, exact match, n=97.
  - Amounts: ₹ figures, Rs. figures and "(Rs.)" labels, glyph and digits exact, n=11, of which 5 are ₹.
  - Lakh/crore: n=20. Section and clause numbers: n=44.
  - A line counts as **dropped** if its best match differs by more than 50% of its length (lines of 4+ characters).
- **Runtimes.** Paddle candidates ran in **Playwright Chromium, not cross-origin isolated, 1 WASM thread**, which is the production condition. Times include deskew. Tesseract.js ran in **Node on its WASM core**, as a proxy. docTR and Florence-2 ran on **native onnxruntime CPU**. Their times are therefore optimistic against the browser, so read them as lower bounds. All runs are single runs, so treat time differences under about 15% as noise.
- **No CDN at runtime.** The Paddle runs aborted every non-localhost request. 0 were attempted.

## Results

| Engine (det + rec) | CER all 8 | CER held-out 5 | Numeric /97 | Amounts /11 | ₹ correct /5 | Lakh/crore /20 | Sections /44 | Dropped lines /264 | Median s/page (max) | Models, raw / gzip |
|---|---|---|---|---|---|---|---|---|---|---|
| **Current:** PP-OCRv5 en mobile | 1.46% | 2.08% | 87 | 6 | 0 (4 `Z`, 1 `2`) | 19 | 38 | 3 | 7.5 (12.0) | 12.9 / 11.8 MB |
| **PP-OCRv6 small** | **0.64%** | **1.12%** | **88** | 6 | 0 (glyph left out) | **20** | 37 | **0** | 10.4 (15.2) | 31.3 / 26.2 MB |
| PP-OCRv6 medium | 0.43% | 0.60% | 86 | 6 | 0 (1 `z`, 4 left out) | 20 | 40 | 0 | 45.9 (69.7) | 138.9 MB |
| PP-OCRv6 tiny | 1.16% | 1.74% | 79 | 10 | **4** | 20 | 31 | 0 | **3.2** (5.0) | 6.4 / 5.8 MB |
| PP-OCRv5 server (multilingual) | 8.54% | 10.07% | 55 | 4 | 0 | 15 | 31 | 8 | 45.9 (69.1) | 172 MB |
| Hybrid: v5 mobile det + v6 small rec | 0.67% | 1.15% | 88 | 6 | 0 | 20 | 40 | 0 | 9.6 (15.5) | 26.2 MB |
| Hybrid: v6 tiny det + v6 small rec | 0.66% | 1.08% | 87 | 6 | 0 | 20 | 39 | 0 | 8.5 (14.3) | 23.2 MB |
| Hybrid: v5 mobile det + v6 tiny rec | 1.13% | 1.90% | 80 | **11** | **5** | 20 | 33 | 0 | 2.3 (3.5) | 9.4 MB |
| Hybrid: v6 small det + v6 tiny rec | 1.14% | 1.70% | 81 | 8 | 3 | 20 | 31 | 0 | 2.4 (3.4) | 14.5 MB |
| PP-OCRv5 mobile det + v5 server rec | 5.01% | 5.34% | 72 | 5 | 0 | 18 | 37 | 1 | 38.4 (67.6) | 89 MB |
| Tesseract.js 7.0.0, eng best_int | 3.14% | 5.65% | 65 | 6 | 0 (not in charset) | 9 | 40 | 11 | 1.9 (2.7)* | 2.9 MB gz + 3.9 MB core |
| Tesseract.js 7.0.0, eng+hin best_int | 3.12% | 5.22% | 62 | 6 | 0 | 10 | 40 | 10 | 4.0 (12.6)* | 4.3 MB gz + core |
| docTR (OnnxTR 0.4.1) db_resnet50 + parseq, int8 | 1.18% | 2.12% | 82 | 5 | 0 (not in vocab) | 19 | 38 | 0 | 8.5 (15.0)† | about 50 MB‡ |
| docTR db_resnet50 + crnn_vgg16_bn, int8 | 1.46% | 2.37% | 84 | 4 | 0 (not in vocab) | 19 | 39 | 0 | 3.5 (5.8)† | about 40 MB‡ |
| Florence-2-base-ft (transformers.js 4.3.2, q8) | 46.3% | 35.9% | 6 | 0 | 0 | 0 | 6 | 127 | 9.4 (17.0)† | 274 MB |

\* Node WASM, no browser. † Native CPU, so a lower bound for the browser. ‡ Not measured before deletion: the OnnxTR int8 release sizes are about 25 MB per model. The ORT WASM runtime (14.85 MB raw, 3.81 MB gzip, already part of today's cost) is not in the size column for the Paddle rows. Sections for PP-OCRv6 small: the 7 misses are all roman-numeral markers on the S01 photocopy, the same weak spot every engine has there.

## What the numbers say

1. **The recognizer drives quality, and the v6 small recognizer is the best usable one.** With any detector it gives about 0.65% CER, all 20 lakh/crore figures, 87–88 of 97 numeric tokens and 0 dropped lines. That roughly halves the current engine's held-out CER (2.08% to 1.12%). It also clears the current engine's dropped lines (3) and its letter-for-digit amount errors (`0oo`). v6 medium is more accurate again, but at about 46 s per page with one thread it is not shippable.
2. **₹ comes from the recognizer, not the detector, and only the v6 tiny recognizer prints it.** v6 tiny rec read 5 of 5 ₹ figures exactly behind the v5 detector, and 4 or 3 of 5 behind the others. The small and medium recognizers mostly print nothing where the ₹ sits (`. 99,99,999/-` shape). The PP-OCRv5 server recognizer, Tesseract (no ₹ in its charset, with or without `hin`) and docTR (no ₹ in any shipped vocab) never print it. There are only 5 ₹ glyphs, all in one typeface on one document, so treat this as a lead and not proof.
3. **The v6 tiny recognizer is the fastest but damages clause numbers.** It got 31–33 of 44 section numbers, against 37–40 for small. For Redline a wrong clause number is a silent citation error, so tiny alone loses even though it reads ₹ and runs 3× faster.
4. **Big is not better.** The PP-OCRv5 server pair (172 MB) is the worst Paddle result: 8.5% CER and 8 dropped lines. It is a Chinese-first model with an 18k-character dictionary and does poorly on these English scans.
5. **Tesseract.js and docTR do not beat the current engine where it matters.** Tesseract reads more section numbers (40/44) but only 9 of 20 lakh/crore figures, drops 11 lines and cannot print ₹. docTR parseq is close on CER but has no ₹ and no maintained browser package. Exporting it would mean writing its pre- and post-processing in JS.
6. **Generative VLMs are out.** Florence-2 downsamples the page to 768 px and returns a loose paraphrase of about half the lines. It also produces text that is not on the page, which conflicts with "state only what the document says". Larger document VLMs (granite-docling, SmolDocling, PaddleOCR-VL) were not run. They are 250 MB to 1 GB or more, need WebGPU to be usable, and have the same generative failure mode. Florence's 36–46% CER gives no reason to expect a fix inside the limits.
7. **Confidence still is not a trust gate.** As in round 1, ppu's box confidence did not separate the wrong amounts from the right ones. The post-check below is the gate.

## Does a hybrid help?

- **Detector swaps: barely.** v6 tiny det + v6 small rec matches v6 small on accuracy (1.08% against 1.12% held-out, within noise) and is about 18% faster (8.5 s against 10.4 s) with 8 MB fewer bytes. That is a fine later optimisation, but it is not the reason to switch.
- **A second recognizer for ₹ only: promising, untested end to end.** The obvious design: run v6 small. Every box the post-check flags as "missing currency symbol" then goes back through v6 tiny rec, and the box's ₹ is accepted only when tiny prints it. In the separate runs, tiny read all 5 of the boxes small left blank. The combined pipeline was **not** built or run, so it is a follow-up spike, not part of the recommendation. Cost: about 4.5 MB more model data and well under 1 s per flagged page.

## Does a ₹/number post-check help?

Yes. It is the only thing tested that turns silent amount errors into visible ones. The rules (`scripts/postcheck.mjs` in the scratch dir) flag five patterns:

- a `Z`/`z`/`2`/`7` look-alike before an Indian-grouped amount
- a bare `.` before such an amount (glyph left out)
- letters inside a number (`0oo`)
- broken roman numerals such as `(ii )` and `()`
- `ARTICLE`/`Clause`/`Section` followed by no number

Results on the 8 pages:

- **Hand truth:** 0 hits on all 8 transcriptions, so there were no false alarms on the reference text. The sample is small, though.
- **Current engine:** it caught 4 of the 5 ₹ misreads, both `0oo` cases, 2 broken roman numerals and the dropped `ARTICLE` number.
- **PP-OCRv6 small:** it caught 3 to 5 missing-symbol amounts, depending on the run's spacing, with no other hits.

These rules were written after looking at round-1 errors on these pages, so their catch rate is in-sample. A post-check can only flag. It cannot repair, because `2. 17,…` is ambiguous. The product response belongs to the owner. Withholding a flag that cites a flagged span matches the trust rules best, and labelling the amount "₹ sign not read" is the lighter option.

## Integration effort (recommended path)

- **Dependencies:** none new. ppu-paddle-ocr 6.6.1 (MIT) and onnxruntime-web (MIT) stay. The models are PaddlePaddle's official PP-OCRv6 small det and rec (Apache-2.0, published 2026-06-11), taken from ppu's Apache-2.0 Hugging Face mirror `snowfluke/ppu-paddle-ocr-models`: `detection/ort/PP-OCRv6_small_det.ort`, `recognition/ort/PP-OCRv6_small_rec.ort` and `recognition/ppocrv6_dict.txt` (18,709 entries, includes ₹). Self-host them under `public/` and record SHA-256 hashes, as for v5.
- **Code:**
  - change the three model URLs (this is ppu's `V6_SMALL_MODEL` preset)
  - keep the deskew and `per-box`
  - add the post-check (about 60 lines plus tests) and route its hits into the Source sentence check
- **Cost to users:** OCR first load goes from about 15.7 MB gzip to about **30 MB gzip** (26.2 MB models + 3.8 MB ORT). The models barely compress, so cache them in Cache Storage. Median OCR time goes from about 7.5 s to about **10.4 s per page** in Chromium with one thread, and the densest page takes 15 s. Background the OCR per page and show progress.
- **Still open:** ₹ (the tiny-rec second pass above, or an owner decision on how to show an unread symbol), real Safari/iOS timing, phone photos and multi-column layouts. None of those are in this sample.

## Reproduce

Everything is in `/Users/aadharagarwal/.claude/jobs/f7cf0bfb/tmp/ocr-bakeoff2/`:

- `harness/` is the round-1 harness with a `det=`/`rec=` URL parameter added to choose model folders.
- `run-paddle.sh` and `run-hyb.sh` run the Paddle variants.
- `tess/run.mjs`, `scripts/doctr_run.py` and `vlm/florence.mjs` run the other engines.
- `scripts/dropped.mjs` computes dropped lines and held-out CER, and `scripts/postcheck.mjs` runs the post-check.

Models were deleted after scoring, except v5 mobile and v6 tiny/small.

## Follow-up, 2026-10-31: shipped, and the tiny-rec ₹ spike

**Shipped (ticket 23, branch feature/23b-ocr-v6).** PP-OCRv6 small replaced PP-OCRv5 English mobile, with the post-check folded into the unreadable-amount rule (lib/review/unreadable-amount.js). Its rules differ from `scripts/postcheck.mjs` in three places:
- The `Z`/`2`/`7` look-alike rule and `0oo` were already covered by the existing rule.
- The heading rule only fires at the start of a line, because "as set out in this Clause. The" is ordinary prose.
- A hit withholds the citing flag under the existing reason. It never repairs the text.

On the real scans the post-check found 3 missing ₹ on S04. v6 small printed the other 2 of S04's 5. S01, S03 and S05 had no hits (ticket 23).

**Spike: re-read flagged ₹ spots with the v6 tiny recognizer. Measured, not shipped.** This was simulated offline from the two round-2 runs that share the v6 small detector (`p-v6s-v6s` and `p-v6s-v6t`), so both runs saw the same box crops. Only boxes on lines with a post-check "missing ₹" hit were considered. Tiny's text was accepted only when it printed ₹, small's box did not, and the digits were identical. Scored with the unchanged `score.mjs` on the 8 pages:

| | Numeric /97 | Amounts /11 | ₹ emitted /5 | Lakh/crore /20 | Sections /44 | CER order-free |
|---|---|---|---|---|---|---|
| v6 small | 88 | 7 | 1 | 20 | 37 | 0.64% |
| v6 small + tiny on flagged spots | 89 | 9 | 3 | 20 | 37 | 0.63% |

Of the 3 boxes that were flagged, 2 were accepted and 1 was rejected. Nothing got worse.

It was not shipped for three reasons:
- **It is a simulation, not an in-browser run.** To ship it, the worker would have to crop each flagged box from the straightened page and run a second recognizer on it. ppu exposes no recognize-a-crop call for that, and the change would add 4.5 MB of models. That did not fit the spike budget.
- **It moves the trust line.** A ₹ that tiny prints makes the sentence pass the post-check, so a flag that is withheld today would be shown, on the strength of a second model's reading.
- **The sample is small.** There are 5 ₹ glyphs, all in one typeface on one document, and the post-check rules are in-sample.

The product owner should decide whether that trade is wanted before anyone builds it. Spike files: `ocr-runs-v6/spike/` in the job's scratch dir.
