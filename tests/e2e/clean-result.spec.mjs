// The Clean result through the interface (ticket 11, ADR 0006). Signed out, the review runs against the
// Default Red lines.
//
// Tickets 13 and 07 have landed, so the gate is lifted (lib/review/clean-result-gate.js): the clean
// fixture gets a Clean result listing every Red line checked and its Know this flags.

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { findBannedWording } from "../../lib/review/wording.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cleanText = read("fixtures/contracts/clean-agreement-01.txt");
const cleanFlags = JSON.parse(read("fixtures/model-output/clean-agreement-01.risk-flags.json")).riskFlags;

async function reviewText(page, text) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(text);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

test("the clean fixture gets a Clean result that shows what was checked", async ({ page }) => {
  await reviewText(page, cleanText);

  await expect(page.getByTestId("clean-result")).toBeVisible();
  await expect(page.getByTestId("clean-statement")).toHaveText(COPY.clean.statement);
  await expect(page.getByTestId("clean-result-held")).toHaveCount(0);

  const checked = page.getByTestId("red-line-checked");
  await expect(checked).toHaveCount(DEFAULT_RED_LINES.length);
  expect(await checked.evaluateAll((els) => els.map((e) => e.dataset.redLine))).toEqual(DEFAULT_RED_LINES.map((r) => r.id));
  await expect(page.getByTestId("group-know-this").getByTestId("flag-title")).toHaveText(cleanFlags.map((f) => f.title));
  await expect(page.getByTestId("group-negotiate").getByTestId("risk-flag")).toHaveCount(0);
  await expect(page.getByTestId("group-dont-sign-as-written").getByTestId("risk-flag")).toHaveCount(0);

  // PRD criterion 8 over Redline's own text in the pane, leaving out the Source sentences, which are
  // the contract's own words.
  const own = await page.getByTestId("risk-flags").evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("[data-testid=source-sentence], .flag-src").forEach((n) => n.remove());
    return clone.textContent;
  });
  expect(findBannedWording(own)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("clean-result.png"), fullPage: true });
});

test("a review with Negotiate or Don't sign as written flags is not a Clean result", async ({ page }) => {
  await reviewText(page, read("fixtures/contracts/vendor-agreement-01.txt"));
  await expect(page.getByTestId("group-negotiate")).toBeVisible();
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await expect(page.getByTestId("clean-result-held")).toHaveCount(0);
});

test("a stamp page with no clauses is not Clean and says why", async ({ page }) => {
  await reviewText(page, read("fixtures/contracts/stamp-page-01.txt"));
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await expect(page.getByTestId("no-clauses")).toHaveText(COPY.clean.noClauses);
});
