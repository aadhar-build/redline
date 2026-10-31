// The Extraction seam in a real browser (ticket 05): files are built here, picked on /review, read by
// pdf.js or the DOCX reader in the page, and only the extracted text may leave the browser.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";
import { normalise } from "../../lib/review/normalise.js";
import { hiddenOcrPage, makePdf, scanPage, textPage, wrap } from "../support/make-pdf.mjs";
import { LEGAL_NUMBERING, makeDocx, numPr, p, r } from "../support/make-docx.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const fixtureText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const fixtureSummary = JSON.parse(
  fs.readFileSync(path.join(root, "fixtures/model-output/vendor-agreement-01.summary.json"), "utf8"),
).summary;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const vendorPdf = () => makePdf([textPage(wrap(fixtureText))]);
const vendorDocx = () =>
  makeDocx({ body: fixtureText.split("\n").filter((l) => l.trim()).map((l) => p(l)).join("") });

// Records every request the page makes, with its body.
function recordRequests(page) {
  const requests = [];
  page.on("request", (req) => requests.push({ url: req.url(), method: req.method(), body: req.postDataBuffer() }));
  return requests;
}

function expectOnlyTextLeft(requests, baseURL, fileBytes, source) {
  const origin = new URL(baseURL).origin;
  // Nothing goes to another host: no CDN worker, no model API.
  expect(requests.filter((q) => new URL(q.url).origin !== origin).map((q) => q.url)).toEqual([]);
  const withBody = requests.filter((q) => q.body && q.body.length > 0);
  // The one request with a body is the review POST, and its body is JSON holding only the text and
  // the name of where it came from ("pdf" or "docx"), which the library stores (ticket 10).
  expect(withBody.map((q) => `${q.method} ${new URL(q.url).pathname}`)).toEqual(["POST /api/review"]);
  const body = withBody[0].body;
  expect(Object.keys(JSON.parse(body.toString("utf8")))).toEqual(["text", "source"]);
  expect(JSON.parse(body.toString("utf8")).source).toBe(source);
  for (const sig of ["%PDF-", "PK\u0003\u0004"]) expect(body.includes(Buffer.from(sig, "latin1"))).toBe(false);
  expect(body.includes(fileBytes.subarray(0, 64))).toBe(false);
  expect(body.includes(Buffer.from(fileBytes.toString("base64").slice(0, 64)))).toBe(false);
  return JSON.parse(body.toString("utf8")).text;
}

async function choose(page, name, mimeType, buffer) {
  await page.getByLabel(COPY.fileLabel).setInputFiles({ name, mimeType, buffer });
}

for (const [kind, name, mimeType, build] of [
  ["PDF", "vendor-agreement.pdf", PDF, vendorPdf],
  ["DOCX", "vendor-agreement.docx", DOCX, vendorDocx],
]) {
  test(`a text-layer ${kind} is read in the browser and only its text is sent`, async ({ page, baseURL }) => {
    const file = Buffer.from(await build());
    const requests = recordRequests(page);
    await page.goto("/review");
    await choose(page, name, mimeType, file);

    await expect(page.getByTestId("file-loaded")).toContainText(COPY.fileLoaded(name));
    const extracted = await page.getByLabel(COPY.fieldLabel).inputValue();
    expect(normalise(extracted)).toBe(normalise(fixtureText));

    const posted = page.waitForRequest((q) => q.url().endsWith("/api/review") && q.method() === "POST");
    await page.getByRole("button", { name: COPY.submit }).click();
    await posted;
    await expect(page.getByTestId("summary")).toHaveText(fixtureSummary);

    const sent = expectOnlyTextLeft(requests, baseURL, file, kind.toLowerCase());
    expect(sent).toBe(extracted);
    // Nothing was left out, so there is no note about it.
    await expect(page.getByTestId("removed-lines-note")).toHaveCount(0);
    if (kind === "PDF") {
      expect(requests.some((q) => /\/pdfjs\/[\d.]+\/pdf\.worker\.min\.mjs$/.test(new URL(q.url).pathname))).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath(`${kind.toLowerCase()}-summary.png`), fullPage: true });
  });
}

test("running lines left out of a PDF are named at upload and never sent", async ({ page, baseURL }) => {
  const lines = wrap(fixtureText);
  const third = Math.ceil(lines.length / 3);
  const file = makePdf(
    [0, 1, 2].map((i) =>
      textPage(lines.slice(i * third, (i + 1) * third), { top: 100, header: "Kesari Vendor Agreement", footer: "Confidential" }),
    ),
  );
  const requests = recordRequests(page);
  await page.goto("/review");
  await choose(page, "headed.pdf", PDF, file);
  await expect(page.getByTestId("file-loaded")).toBeVisible();
  const removed = [
    { text: "Kesari Vendor Agreement", count: 3 },
    { text: "Confidential", count: 3 },
  ];
  await expect(page.getByTestId("removed-lines-note")).toHaveText(COPY.removedLines(removed));
  await expect(page.getByTestId("removed-lines-note")).toContainText('"Kesari Vendor Agreement" and "Confidential"');
  await expect(page.getByTestId("removed-lines-note")).toContainText("6 lines");
  const extracted = await page.getByLabel(COPY.fieldLabel).inputValue();
  expect(extracted).not.toContain("Confidential");

  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("summary")).toHaveText(fixtureSummary);
  // The posted body is still only the text and its source: the removed lines stay in the browser.
  expect(expectOnlyTextLeft(requests, baseURL, file, "pdf")).toBe(extracted);
});

test("the DOCX reader keeps clause numbers, takes the accepted view and never glues words", async ({ page }) => {
  const body = [
    p("Definitions", numPr(1, 0)),
    p("Agreement means this agreement.", numPr(1, 1)),
    // One sentence split across runs, with a tracked insertion, a tracked deletion and a field.
    `<w:p><w:pPr>${numPr(1, 1)}</w:pPr>${r("The fee is ")}<w:ins w:id="1" w:author="A">${r("Rs. 18,000")}</w:ins><w:del w:id="2" w:author="A"><w:r><w:delText>Rs. 15,000</w:delText></w:r></w:del>${r(" per month, payable on ")}<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> DATE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r("1 December")}<w:r><w:fldChar w:fldCharType="end"/></w:r>${r(".")}</w:p>`,
    `<w:p><w:pPr>${numPr(1, 2)}</w:pPr>${r("within thirty")}<w:r><w:br/></w:r>${r("days; and")}</w:p>`,
    `<w:p><w:pPr>${numPr(1, 2)}</w:pPr>${r("by bank transfer.")}<w:r><w:rPr><w:vanish/></w:rPr><w:t> Hidden note.</w:t></w:r></w:p>`,
    p("Term", numPr(1, 0)),
    // A paragraph deleted in full, mark and all: gone in the accepted view, and it takes no number.
    `<w:p><w:pPr>${numPr(1, 1)}<w:rPr><w:del w:id="3" w:author="A"/></w:rPr></w:pPr><w:del w:id="4" w:author="A"><w:r><w:delText>Removed clause.</w:delText></w:r></w:del></w:p>`,
    p("Two years.", numPr(1, 1)),
    p("A bullet point.", numPr(2, 0)),
    // A text box written into both branches of mc:AlternateContent is read once, after its paragraph.
    `<w:p>${r("Signed for the Vendor.")}<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent>${p("Stamp duty paid.")}</w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${p("Stamp duty paid.")}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`,
    `<w:tbl><w:tr><w:tc>${p("Name")}</w:tc><w:tc>${p("Kesari Cleaning Services")}</w:tc></w:tr></w:tbl>`,
  ].join("");
  const file = await makeDocx({ body, numbering: LEGAL_NUMBERING });

  await page.goto("/review");
  await choose(page, "features.docx", DOCX, file);
  await expect(page.getByTestId("file-loaded")).toBeVisible();
  expect(await page.getByLabel(COPY.fieldLabel).inputValue()).toBe(
    [
      "1. Definitions",
      "1.1 Agreement means this agreement.",
      "1.2 The fee is Rs. 18,000 per month, payable on 1 December.",
      "(a) within thirty\ndays; and",
      "(b) by bank transfer.",
      "2. Term",
      "2.1 Two years.",
      "A bullet point.",
      "Signed for the Vendor.",
      "Stamp duty paid.",
      "Name",
      "Kesari Cleaning Services",
    ].join("\n\n"),
  );
  // The hidden run " Hidden note." stays out of the text, and the upload says the file has some.
  await expect(page.getByTestId("hidden-text-note")).toHaveText(COPY.hiddenText);
});

test("the DOCX reader adds footnotes and endnotes after the body, in the order they are referred to", async ({ page }) => {
  const ref = (kind, id) => `<w:r><w:${kind}Reference w:id="${id}"/></w:r>`;
  const note = (kind, id, ...paras) =>
    `<w:${kind} w:id="${id}">${paras.map((t, i) => `<w:p>${i === 0 ? `<w:r><w:${kind}Ref/></w:r>` : ""}${r(` ${t}`)}</w:p>`).join("")}</w:${kind}>`;
  const separators = (kind) =>
    `<w:${kind} w:type="separator" w:id="-1"><w:p>${r("----")}</w:p></w:${kind}><w:${kind} w:type="continuationSeparator" w:id="0"><w:p>${r("----")}</w:p></w:${kind}>`;
  const body = [
    `<w:p>${r("The fee is Rs. 18,000 a month.")}${ref("footnote", 3)}${r(" Tax is extra.")}${ref("footnote", 2)}</w:p>`,
    // A hidden run with no letter or digit in it is not counted.
    `<w:p>${r("The term is two years.")}${ref("endnote", 1)}<w:r><w:rPr><w:vanish/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>`,
  ].join("");
  const file = await makeDocx({
    body,
    footnotes: `${separators("footnote")}${note("footnote", 2, "GST at 18 per cent.")}${note("footnote", 3, "Payable in advance.", "By bank transfer.")}${note("footnote", 9, "Never referred to.")}`,
    endnotes: `${separators("endnote")}${note("endnote", 1, "Renewal needs both parties to agree.")}`,
  });

  await page.goto("/review");
  await choose(page, "notes.docx", DOCX, file);
  await expect(page.getByTestId("file-loaded")).toBeVisible();
  expect(await page.getByLabel(COPY.fieldLabel).inputValue()).toBe(
    [
      "The fee is Rs. 18,000 a month. Tax is extra.",
      "The term is two years.",
      "Footnotes",
      "Payable in advance.\nBy bank transfer.",
      "GST at 18 per cent.",
      "Endnotes",
      "Renewal needs both parties to agree.",
    ].join("\n\n"),
  );
  await expect(page.getByTestId("hidden-text-note")).toHaveCount(0);
});

test("the DOCX reader numbers clauses through heading styles", async ({ page }) => {
  const styles = `
    <w:style w:type="paragraph" w:styleId="Clause1"><w:pPr>${numPr(1, 0)}</w:pPr></w:style>
    <!-- Clause2 sets only the level; its list comes from Clause1, the style it is based on. -->
    <w:style w:type="paragraph" w:styleId="Clause2"><w:basedOn w:val="Clause1"/><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr></w:style>`;
  const body = [
    p("Payment", '<w:pStyle w:val="Clause1"/>'),
    p("Invoices are due in seven days.", '<w:pStyle w:val="Clause2"/>'),
    p("Interest is 2% a month.", '<w:pStyle w:val="Clause2"/>'),
    p("Termination", '<w:pStyle w:val="Clause1"/>'),
  ].join("");
  await page.goto("/review");
  await choose(page, "styled.docx", DOCX, await makeDocx({ body, numbering: LEGAL_NUMBERING, styles }));
  await expect(page.getByTestId("file-loaded")).toBeVisible();
  expect(await page.getByLabel(COPY.fieldLabel).inputValue()).toBe(
    ["1. Payment", "1.1 Invoices are due in seven days.", "1.2 Interest is 2% a month.", "2. Termination"].join("\n\n"),
  );
});

// Rejections: the reason is shown, no request with a body is made, no analysis runs.
async function expectRejected(page, requests, message, screenshot) {
  await expect(page.locator(".form-error[role=alert]")).toHaveText(message);
  if (screenshot) await page.screenshot({ path: test.info().outputPath(screenshot), fullPage: true });
  await expect(page.getByTestId("file-loaded")).toHaveCount(0);
  expect(await page.getByLabel(COPY.fieldLabel).inputValue()).toBe("");
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText(COPY.errors["empty-document"]);
  expect(requests.filter((q) => q.method !== "GET" || (q.body && q.body.length > 0))).toEqual([]);
  await expect(page.getByTestId("summary")).toHaveCount(0);
}

test("an image-only PDF is stopped with the scanned pages named and nothing is sent", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  await choose(page, "scan.pdf", PDF, makePdf([scanPage(), scanPage()]));
  await expectRejected(page, requests, COPY.scannedPages([1, 2]), "scanned.png");
});

test("a scan with a hidden OCR text layer is stopped too, not read from its hidden text", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  await choose(page, "searchable-scan.pdf", PDF, makePdf([hiddenOcrPage(wrap(fixtureText))]));
  await expectRejected(page, requests, COPY.scannedPages([1]));
});

test("a file in another language is rejected before anything is sent", async ({ page }) => {
  const french =
    "Le présent contrat est conclu entre le prestataire et le client. Le prestataire s'engage à nettoyer la cuisine du client chaque nuit après la fermeture. Le client paiera au prestataire la somme de dix-huit mille roupies par mois, plus la taxe applicable.";
  const requests = recordRequests(page);
  await page.goto("/review");
  await choose(page, "contrat.docx", DOCX, await makeDocx({ body: p(french) }));
  await expectRejected(page, requests, COPY.errors["not-english"]);
});

test("pasted text in another script is rejected before anything is sent", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill("यह अनुबंध पुणे में दिनांक 1 नवंबर 2026 को किया गया। विक्रेता हर रात ग्राहक की रसोई की सफाई करेगा।");
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText(COPY.errors["not-english"]);
  expect(requests.filter((q) => q.method !== "GET")).toEqual([]);
});

test("an old .doc file or any other type is turned away with what to do", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512)]);
  await choose(page, "old.doc", "application/msword", ole);
  await expectRejected(page, requests, COPY.errors["unsupported-type"]);
});

test("a damaged PDF is reported as unreadable", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/review");
  await choose(page, "broken.pdf", PDF, Buffer.from("%PDF-1.7\nthis is not really a pdf"));
  await expectRejected(page, requests, COPY.errors.unreadable);
});

test("removing the file clears its text so something else can be pasted", async ({ page }) => {
  await page.goto("/review");
  await choose(page, "vendor-agreement.docx", DOCX, await vendorDocx());
  await expect(page.getByLabel(COPY.fieldLabel)).not.toHaveValue("");
  await page.getByRole("button", { name: COPY.clearFile }).click();
  await expect(page.getByLabel(COPY.fieldLabel)).toHaveValue("");
  await expect(page.getByTestId("file-loaded")).toHaveCount(0);
  await page.getByLabel(COPY.fieldLabel).fill(fixtureText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("summary")).toHaveText(fixtureSummary);
});
