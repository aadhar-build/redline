// OCR in a real browser (tickets 23 and 19, ADR 0008). The scans are made here: the page draws typed
// lines on a canvas, slightly tilted like a photocopy, and returns a JPEG, which becomes a full-page
// image in a PDF with no text layer. No real scan or its text is committed.
//
// Checks: the real engine (ppu-paddle-ocr, PP-OCRv5 English mobile, ONNX Runtime WASM) reads the page
// in this browser; a mixed PDF keeps its typed page's text and OCRs the other; progress is shown and
// the Reviewer can stop it; every request stays on Redline's own origin, the models and runtime come
// from /ocr/, and only the extracted text, its source and the OCR ranges are posted.
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";
import { makePdf, scanPage, textPage } from "../support/make-pdf.mjs";

const PDF = "application/pdf";
// OCR is several seconds a page, single-threaded, plus the first model load.
test.setTimeout(180_000);

const SCAN_LINES = [
  "SUPPLY AGREEMENT",
  "1. The Supplier shall deliver the goods to the Buyer within thirty days.",
  "2. The Buyer shall pay each invoice within fifteen days of receiving it.",
  "3. Either party may end this agreement by giving sixty days written notice.",
];

// A US Letter page at scale 2 (1224 x 1584), tilted by `tilt` degrees.
async function scanJpeg(page, lines, tilt = 1.2) {
  const bytes = await page.evaluate(
    async ({ lines, tilt }) => {
      const c = document.createElement("canvas");
      c.width = 1224;
      c.height = 1584;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.translate(-c.width / 2, -c.height / 2);
      ctx.fillStyle = "#111";
      ctx.font = "28px Arial, Helvetica, sans-serif";
      lines.forEach((line, i) => ctx.fillText(line, 120, 260 + i * 64));
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { lines, tilt },
  );
  return { data: Uint8Array.from(bytes), width: 1224, height: 1584 };
}

function recordRequests(page) {
  const requests = [];
  page.on("request", (req) => requests.push({ url: req.url(), method: req.method(), body: req.postDataBuffer() }));
  return requests;
}

const words = (s) => s.toLowerCase().match(/[a-z]+/g) ?? [];
// Share of the expected words that OCR found, ignoring spacing: per-box recognition can split a word
// ("m ay"), and the engine sometimes drops a heading.
function wordRecall(expected, got) {
  const stream = words(got).join("");
  const want = words(expected);
  return want.filter((w) => stream.includes(w)).length / want.length;
}

async function choose(page, name, buffer) {
  await page.getByLabel(COPY.fileLabel).setInputFiles({ name, mimeType: PDF, buffer });
}

function expectOwnOrigin(requests, baseURL) {
  const origin = new URL(baseURL).origin;
  expect(requests.filter((q) => new URL(q.url).origin !== origin).map((q) => q.url)).toEqual([]);
  const paths = requests.map((q) => new URL(q.url).pathname);
  // The OCR runtime and models load from Redline itself; the JSEP/WebGPU build is never fetched.
  expect(paths).toContain("/ocr/models/pp-ocrv5-en-mobile/det.ort");
  expect(paths).toContain("/ocr/models/pp-ocrv5-en-mobile/rec.ort");
  expect(paths).toContain("/ocr/models/pp-ocrv5-en-mobile/dict.txt");
  expect(paths.filter((p) => p.endsWith(".wasm") && p.includes("ort-wasm"))).toEqual([
    expect.stringMatching(/^\/ocr\/ort\/[\d.]+\/ort-wasm-simd-threaded\.wasm$/),
  ]);
  expect(paths.some((p) => p.includes("jsep"))).toBe(false);
}

function postedBody(requests) {
  const withBody = requests.filter((q) => q.body && q.body.length > 0);
  expect(withBody.map((q) => `${q.method} ${new URL(q.url).pathname}`)).toEqual(["POST /api/review"]);
  const raw = withBody[0].body;
  for (const sig of ["%PDF-", "ÿØÿ", "JFIF"]) expect(raw.includes(Buffer.from(sig, "latin1"))).toBe(false);
  return JSON.parse(raw.toString("utf8"));
}

test("an image-only PDF is read by OCR in the browser, and only its text and OCR ranges are sent", async ({ page, baseURL }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  const pdf = makePdf([scanPage(await scanJpeg(page, SCAN_LINES))]);
  await choose(page, "scan.pdf", pdf);
  await expect(page.getByTestId("file-reading")).toContainText(COPY.ocrProgress(0, 1));
  await expect(page.getByTestId("file-loaded")).toBeVisible({ timeout: 150_000 });

  const text = await page.getByLabel(COPY.fieldLabel).inputValue();
  expect(wordRecall(SCAN_LINES.join(" "), text)).toBeGreaterThanOrEqual(0.9);
  await page.screenshot({ path: test.info().outputPath("ocr-scan.png"), fullPage: true });

  await page.getByRole("button", { name: COPY.submit }).click();
  await expect.poll(() => requests.filter((q) => q.method === "POST").length).toBe(1);
  const body = postedBody(requests);
  expect(Object.keys(body)).toEqual(["text", "source", "ocrRanges", "ocrPages", "pageCount"]);
  expect(body.source).toBe("pdf");
  expect(body.text).toBe(text);
  expect(body.ocrRanges).toEqual([[0, text.length]]);
  expect(body.ocrPages).toEqual([1]);
  expect(body.pageCount).toBe(1);
  await expect(page.getByTestId("scanned-note")).toHaveText(COPY.scannedNote({ pages: 1, pageCount: 1 }), { timeout: 150_000 });
  expectOwnOrigin(requests, baseURL);
});

test("a PDF with text on some pages only keeps the typed page and OCRs the scanned one (ticket 19)", async ({ page, baseURL }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  const typed = ["This Agreement is made between Northwind Traders and Contoso Foods."];
  const pdf = makePdf([textPage(typed), scanPage(await scanJpeg(page, SCAN_LINES, -0.8))]);
  await choose(page, "mixed.pdf", pdf);
  await expect(page.getByTestId("file-loaded")).toBeVisible({ timeout: 150_000 });

  const text = await page.getByLabel(COPY.fieldLabel).inputValue();
  // The typed page is exactly its text layer; the scanned page follows it after one newline.
  expect(text.startsWith(`${typed[0]}\n`)).toBe(true);
  expect(wordRecall(SCAN_LINES.join(" "), text.slice(typed[0].length + 1))).toBeGreaterThanOrEqual(0.9);

  await page.getByRole("button", { name: COPY.submit }).click();
  await expect.poll(() => requests.filter((q) => q.method === "POST").length).toBe(1);
  const body = postedBody(requests);
  expect(body.ocrRanges).toEqual([[typed[0].length + 1, text.length]]);
  expect(body.ocrPages).toEqual([2]);
  expect(body.pageCount).toBe(2);
  await expect(page.getByTestId("scanned-note")).toHaveText(COPY.scannedNote({ pages: 1, pageCount: 2 }), { timeout: 150_000 });
  expectOwnOrigin(requests, baseURL);
});

test("the Reviewer can stop OCR part way, and nothing is sent", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  const scan = scanPage(await scanJpeg(page, SCAN_LINES));
  await choose(page, "long-scan.pdf", makePdf([scan, scan, scan, scan, scan, scan]));
  await expect(page.getByTestId("file-reading")).toContainText(COPY.ocrProgress(0, 6));
  await page.getByRole("button", { name: COPY.ocrCancel }).click();
  await expect(page.getByTestId("file-cancelled")).toHaveText(COPY.ocrCancelled);
  await expect(page.getByTestId("file-loaded")).toHaveCount(0);
  expect(await page.getByLabel(COPY.fieldLabel).inputValue()).toBe("");
  expect(requests.filter((q) => q.method !== "GET" || (q.body && q.body.length > 0))).toEqual([]);
});
