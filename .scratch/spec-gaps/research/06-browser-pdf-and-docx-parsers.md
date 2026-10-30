# 06 · Browser-side PDF and DOCX parsers

Question: which maintained libraries can turn (a) a text-layer PDF and (b) a DOCX into plain text entirely in the browser, inside a Next.js 16 / React 19 App Router app, and can the PDF option tell, page by page, that a page has no text layer?

Researched 2026-10-31. Versions, dates and sizes come from the npm registry (`registry.npmjs.org/<pkg>`), file listings on jsDelivr (`data.jsdelivr.com/v1/packages/npm/<pkg>@<ver>`), download counts from `api.npmjs.org/downloads/point/last-week/<pkg>`, and repo health from the GitHub API. Nothing was installed or run against a real document, so every quality claim below needs checking against real contracts before it is relied on.

## Snapshot

| Package | Latest | Released | Licence | Weekly dl | Repo health |
|---|---|---|---|---|---|
| pdfjs-dist (Mozilla pdf.js) | 6.4.299 | 2026-10-03 | Apache-2.0 | ~50.4M | 54k stars, pushed 2026-10-30, monthly releases (5.7 Apr to 6.4 Oct) |
| unpdf (UnJS) | 2.1.0 | 2026-10-30 | MIT | ~9.9M | 1.3k stars, 0 open issues, 2.0.0 shipped 2026-10-28 (major, ESM-only) |
| react-pdf | 11.0.0 | 2026-09-10 | MIT | n/a | a viewer that wraps pdfjs-dist, so it adds nothing for text-only extraction |
| pdf-parse | 2.4.5 | 2025-10-20 | Apache-2.0 | n/a | Node-oriented, pulls in `@napi-rs/canvas`; no new release in a year |
| mammoth | 1.13.0 | 2026-09-26 | BSD-2-Clause | ~14.3M | 6.3k stars, pushed 2026-10-16, 60 open issues |
| docx-preview (docxjs) | 0.4.1 | 2026-09-21 | Apache-2.0 | ~3.4M | 2.1k stars, 101 open issues, still pre-1.0 |
| jszip | 3.10.2 | 2026-09-08 | MIT or GPL-3.0 | n/a | building block for a hand-rolled DOCX reader |
| fflate | 0.8.3 | 2026-05-16 | MIT | n/a | smaller unzip alternative to jszip |
| officeparser | 8.4.1 | 2026-10-29 | MIT | n/a | multi-format; bundles `tesseract.js` (OCR) and pdfjs-dist |
| docx4js | 3.3.0 | 2024-09-09 | MIT | n/a | no release in over two years |

## (a) PDF

All the maintained browser options run on Mozilla pdf.js underneath. In practice the choice is whether to call pdfjs-dist directly or through unpdf.

### pdfjs-dist (direct)
- **Size.** `build/pdf.min.mjs` is 459 KB and `build/pdf.worker.min.mjs` is 1.26 MB (unminified 861 KB / 2.23 MB). The legacy build is 524 KB / 1.32 MB. Figures are uncompressed, from jsDelivr.
- **Browsers.** The default build is "intended for _the latest_ browsers". Its support table lists only Firefox and Chrome. Safari 18+ appears only under the legacy build, marked "Mostly". Source: https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions. The library uses `Promise.withResolvers` (src/display/api.js), and pdf.js and its worker must be "the _exact_ same version" (same FAQ).
- **Text API.** `page.getTextContent({ includeMarkedContent, disableNormalization })` returns `items`, each a `TextItem` with `str`, `dir`, `transform`, `width`, `height`, `fontName` and `hasEOL`. `hasEOL` means "followed by a line-break". Source: https://github.com/mozilla/pdf.js/blob/master/src/display/api.js (typedefs near line 1170) and https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html. All whitespace becomes U+0020 (same API page).
- **Reading order.** Items come in content-stream order, not visual order. A maintainer said out-of-order text "is a bug in the PDF document *itself*… quite difficult to work-around". Issue #14493 was closed as a duplicate of #2344, which is still open. `getStructTree()` can give the correct order for tagged PDFs, but issue #16564 (using the struct tree for reading order) is also still open. Sources: https://github.com/mozilla/pdf.js/issues/14493, https://github.com/mozilla/pdf.js/issues/2344, https://github.com/mozilla/pdf.js/issues/16564.
- **Sentence integrity.** Nothing joins lines into sentences. A sentence that wraps across lines comes out as separate items with `hasEOL`, and a hyphenated word split across lines stays split. Redline would need its own line-joining pass. The same normalised text has to be what gets stored and what the quote checker compares against.
- **Per-page "no text layer" detection.** Possible but hand-rolled. Treat `getTextContent().items` with an empty or whitespace-only `str` as a sign of no text. Then scan `page.getOperatorList().fnArray` for `OPS.paintImageXObject` (85), `paintInlineImageXObject` (86) or `paintImageMaskXObject` (83), defined in https://github.com/mozilla/pdf.js/blob/master/src/shared/util.js. Measuring image coverage of the page means tracking the transform matrix yourself.
- **Next.js gotchas.**
  - The worker URL has to be set in a client-only module. react-pdf's README recommends `GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`. It warns that the URL must be set in the same module that uses pdf.js, and says to skip SSR for that module (https://github.com/wojtekmaj/react-pdf/blob/main/packages/react-pdf/README.md).
  - Next.js allows `ssr: false` only inside Client Components, and shows loading a library on demand with `await import()` in an event handler (https://nextjs.org/docs/app/guides/lazy-loading).
  - A historical pitfall from before Next 15 is Terser failing on the bundled worker (https://github.com/vercel/next.js/discussions/61549). The fallbacks are copying the worker into `public/` or using a CDN worker.
  - Redline is on `next ^16.3.4` with a bare `next.config.mjs`, so it uses the default bundler. Whether the `new URL(..., import.meta.url)` worker pattern works under it has not been checked.
  - A CDN worker (unpkg) makes the browser fetch code from a third party. The file still stays local, but this is a new external dependency at runtime.

### unpdf
- **What it is.** A wrapper that ships its own "serverless" build of pdf.js 6.4.299 with the worker inlined, so there is no worker file to configure. The catch is that "parsing runs on your event loop (no worker)", so the README suggests racing calls against a timeout. On a browser main thread, a large contract could freeze the UI while it parses. Source: https://github.com/unjs/unpdf (README, "Process Untrusted PDFs").
- **Size.** `dist/pdfjs.mjs` is 1.71 MB (`index.mjs` 24 KB). The image decoders are separate chunks (JBIG2 138 KB, OpenJPEG 335 KB). 2.1.0 "keep[s] the image decoders out of text-only bundles", but `inspectPages` calls `registerImageDecoders` itself, so the detection path pulls them in anyway, about 2.2 MB in total.
- **Browsers.** It needs the global `Iterator` constructor, meaning Safari 18.4 or later. "Without it, importing the bundle throws."
- **Text API.** `extractText(data, { mergePages })` returns one string per page, or a single string. Lines are joined on `hasEOL` and runs of blank lines are collapsed (src/text.ts). There is no sentence reflow; the caveat above still applies. `extractTextItems` gives positioned items, which would let you write your own column ordering.
- **Per-page detection, built in.** `inspectPages(pdf)` returns, for each page, `textLength`, `invisibleTextLength`, `imageCount` and `imageCoverage` (0 to 1). It works from `getTextContent` plus a walk of the operator list (src/inspect.ts). Image count and coverage come from the paint-image operators and their transform matrices (`getUnitSquareBounds`, src/_internal/operator-list.ts), not from decoded pixels. Reading the source suggests the README's browser warning that bitmap-decoded images get skipped applies to `extractImages`, not to coverage. This has not been tested in a browser. The README's own scan heuristic is `textLength - invisibleTextLength < 20 && imageCoverage > 0.8`, and it leaves the threshold to the caller.
- **Escape hatch.** `definePDFJSModule(() => import('pdfjs-dist/...'))` points it at an official pdfjs-dist build, at the cost of setting up the worker again.
- **Risk.** Three releases in 12 days (1.9.1 on 10-19, 2.0.0 on 10-28, 2.1.0 on 10-30). One was the 2.0 major, which went ESM-only and requires Node 24. Pin an exact version.

### Others ruled out for this use
- **react-pdf** is a viewer built on pdfjs-dist.
- **pdf-parse** is aimed at Node and depends on a native canvas.
- **officeparser** bundles tesseract.js for OCR, and by default fetches the pdf.js worker and Tesseract assets from a CDN (`allowRemoteAssets` defaults to `true`). Both clash with "no OCR, ever" and "the file never leaves the browser". Source: https://github.com/harshankur/officeParser README.

## (b) DOCX

### mammoth
- **Browser use.** It accepts `{ arrayBuffer }`. A standalone `mammoth.browser.min.js` is 405 KB (it bundles jszip, xmldom, underscore and others), and package.json has a `browser` field that swaps in browser unzip and file modules. There are no workers or SSR-only APIs, so it loads cleanly from a client-only dynamic `import()`. Source: https://github.com/mwilliamson/mammoth.js.
- **Text output.** `extractRawText` gives "each paragraph… followed by two newlines". Paragraphs come out whole, so DOCX does not have the PDF line-break problem.
- **Tracked changes.** Insertions (`w:ins`) are kept and deletions (`w:del`) are dropped (lib/docx/body-reader.js, `ignoreElements`). So the text shows the document as if all changes were accepted.
- **Comments, tables, text boxes.** Comments are ignored by default. Table cells come through as paragraphs and borders are lost. Text boxes become separate paragraphs.
- **Auto-numbering is lost.** In lib/raw-text.js, raw-text output only emits text, tabs and paragraph breaks. Clause numbers that Word generates (for example "12.3" or "(b)") are read only as list properties and never appear in the text. For contracts, where flags may refer to clause numbers, this matters. It is inferred from the source, so test it on a real contract.
- **Security note.** "Mammoth performs no sanitisation of the source document". This bears on its HTML output. `extractRawText` produces no markup.

### docx-preview (docxjs)
- **What it is.** Its stated goal is to "render/convert DOCX document into HTML". `renderAsync(blob, container, …)` needs a DOM container. Getting text means rendering and then reading `textContent`, or using the "experimental / internal" `parseAsync`. Source: https://github.com/VolodymyrBaydalka/docxjs.
- **Size.** 75 KB minified, plus jszip.
- **Coverage.** Better than mammoth for headers, footers, footnotes and endnotes. Tracked changes and comments are behind experimental flags.
- **Fit.** It suits showing the document more than extracting text from it. It is pre-1.0 with 101 open issues. Whether rendered numbering appears in `textContent` has not been checked.

### JSZip or fflate plus raw XML (hand-rolled)
- **How.** Unzip, then run `DOMParser` over `word/document.xml`. Walk `w:p`, `w:r`, `w:t`, `w:tab` and `w:br`, skip `w:del`/`w:delText`, and optionally resolve `w:numPr` against `numbering.xml` to put clause numbers back.
- **Size.** `jszip/dist/jszip.min.js` is 98 KB. fflate's `umd/index.js` is 33 KB (`esm/browser.js` 91 KB unminified, tree-shakeable). Figures from jsDelivr.
- **Trade-off.** Full control over numbering and tracked changes, and the smallest bundle. Every edge case becomes Redline's to own: fields, smart tags, `w:sdt` content controls, `altChunk`, footnotes.

## Comparison

| Concern | pdfjs-dist | unpdf | mammoth | docx-preview | JSZip + XML |
|---|---|---|---|---|---|
| Bundle (min, uncompressed) | 459 KB + 1.26 MB worker | 1.7 MB text-only; ~2.2 MB with `inspectPages` | 405 KB | 75 KB + jszip | 33–98 KB + own code |
| Off main thread | yes (worker) | no worker of its own; could run inside a module Web Worker (untested) | n/a (fast) | n/a | n/a |
| Next.js setup | workerSrc in a client-only module | import in a client-only module | import in a client-only module | needs a DOM node | trivial |
| Safari | legacy build, "Mostly" | 18.4+ | any | any | any |
| Per-page no-text detection | hand-rolled from operator list | `inspectPages` built in | n/a | n/a | n/a |
| Reading order / sentence reflow | stream order, no reflow | same as pdf.js | paragraph-whole | paragraph-whole | paragraph-whole |
| Clause numbering in text | as printed (it is drawn text) | as printed | lost (inferred) | unverified | recoverable with work |

## Observations (not a decision)
- For PDF, unpdf looks strongest on fit. `inspectPages` answers the mixed-page question directly and there is no worker plumbing. The costs are main-thread parsing, the Safari 18.4 floor, and a very fresh 2.x API. pdfjs-dist used directly keeps parsing off the main thread, but the detection has to be written by hand. unpdf's `definePDFJSModule` lets the two be mixed.
- For DOCX, mammoth looks strongest on maturity and for paragraph-whole text. Losing auto-numbering is the main gap to test, and JSZip plus XML is the fallback if numbering turns out to matter.
- **Spec gap, separate from library choice.** A scanned PDF that the scanner has already OCR'd carries a hidden text layer, so it passes a naive "has text" check, yet its text is exactly the misread-prone text that CLAUDE.md says makes a citation worthless. unpdf exposes this as `invisibleTextLength`, text drawn in render mode 3 or 7. Whether Redline rejects such pages is a product question, not a parser one.
- Under CLAUDE.md, adding any of these is a dependency decision that needs the owner's approval.
