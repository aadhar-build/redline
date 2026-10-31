import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const scripted = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags;
// The script's first six flags quote the document exactly; the last five do not.
const shownScript = scripted.slice(0, 6);
const withheldScript = scripted.slice(6);

async function reviewVendorAgreement(page) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(vendorText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

test("every shown Source sentence is in the pasted contract, and the withheld ones are counted, not shown", async ({ page }) => {
  await reviewVendorAgreement(page);

  const sources = await page.getByTestId("source-sentence").allTextContents();
  expect(sources.length).toBe(7); // Six flags, one of them with two Source sentences.
  for (const s of sources) expect(vendorText).toContain(s);

  await expect(page.getByTestId("risk-flag")).toHaveCount(shownScript.length);
  await expect(page.getByTestId("withheld-count")).toHaveText(COPY.flags.withheldTitle(withheldScript.length));
  await expect(page.getByTestId("withheld")).toContainText(COPY.flags.withheldReason["source-not-found"](5, 5));

  const body = await page.locator("body").textContent();
  for (const f of withheldScript) expect(body).not.toContain(f.title);
  for (const word of ["sixty", "personally", "suspend", " ... "]) expect(body).not.toContain(word);
  await page.screenshot({ path: test.info().outputPath("risk-flags.png"), fullPage: true });
});

test("flags are grouped by Severity in the fixed order, in document order inside each group", async ({ page }) => {
  await reviewVendorAgreement(page);

  const order = ["dont-sign-as-written", "negotiate", "know-this"];
  const groups = page.locator("[data-testid^=group-]");
  await expect(groups).toHaveCount(3);
  expect(await groups.evaluateAll((els) => els.map((e) => e.dataset.testid))).toEqual(order.map((s) => `group-${s}`));

  await expect(page.getByTestId("group-dont-sign-as-written").getByTestId("flag-title")).toHaveText([
    "Paying out the rest of the term to leave early",
    "Liability capped at one month's fee",
  ]);
  await expect(page.getByTestId("group-negotiate").getByTestId("flag-title")).toHaveText([
    "Two-year renewal unless notice is given ninety days ahead",
    "Indemnity for the condition of the premises",
  ]);
  await expect(page.getByTestId("group-know-this").getByTestId("flag-title")).toHaveText([
    "Fee rises at each renewal",
    "Late payment interest",
  ]);
});

test("a judgment the Source sentence cannot prove carries the label Redline's judgment", async ({ page }) => {
  await reviewVendorAgreement(page);
  const judgments = page.getByTestId("flag-judgment");
  await expect(judgments).toHaveCount(2);
  for (const j of await judgments.all()) {
    await expect(j.locator(".basis-label")).toHaveText(COPY.flags.judgmentLabel);
  }
});

test("a hedge word in a flag's own text is marked, and the Source sentence is not", async ({ page }) => {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(read("fixtures/contracts/marked-wording-01.txt"));
  await page.getByRole("button", { name: COPY.submit }).click();

  const flag = page.getByTestId("risk-flag");
  await expect(flag).toHaveCount(1);
  await expect(flag.getByTestId("flag-says").locator("mark")).toHaveText(["may"]);
  await expect(flag.getByTestId("source-sentence").locator("mark")).toHaveCount(0);
  await expect(page.getByTestId("flags-marked-note")).toHaveText(COPY.markedNote);
  await expect(page.getByTestId("withheld")).toHaveCount(0);
});
