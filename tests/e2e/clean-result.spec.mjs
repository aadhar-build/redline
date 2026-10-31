// The Clean result through the interface (ticket 11, ADR 0006). Signed out, the review runs against the
// Default Red lines, so a Clean result lists all four.

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

test("a Clean result says so plainly, lists every Red line checked and shows the Know this flags beneath", async ({ page }) => {
  await reviewText(page, cleanText);

  const clean = page.getByTestId("clean-result");
  await expect(clean).toBeVisible();
  await expect(page.getByTestId("clean-statement")).toHaveText(COPY.clean.statement);

  const checked = clean.getByTestId("red-line-checked");
  await expect(checked).toHaveCount(DEFAULT_RED_LINES.length);
  expect(await checked.evaluateAll((els) => els.map((e) => e.dataset.redLine))).toEqual(DEFAULT_RED_LINES.map((r) => r.id));

  // Know this flags sit beneath the statement and the Red lines; no other Severity group is shown.
  const knowThis = clean.getByTestId("group-know-this");
  await expect(knowThis.getByTestId("flag-title")).toHaveText(cleanFlags.map((f) => f.title));
  await expect(page.getByTestId("group-negotiate")).toHaveCount(0);
  await expect(page.getByTestId("group-dont-sign-as-written")).toHaveCount(0);
  await expect(page.getByTestId("no-flags")).toHaveCount(0);
  const testids = await clean.evaluate((el) =>
    [...el.querySelectorAll("[data-testid=clean-statement], [data-testid=red-lines-checked], [data-testid=group-know-this]")].map(
      (n) => n.dataset.testid,
    ),
  );
  expect(testids).toEqual(["clean-statement", "red-lines-checked", "group-know-this"]);

  // PRD criterion 8: the verdict-word check over the whole Clean result as shown, leaving out the
  // Source sentences, which are the contract's own words.
  const own = await clean.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll("[data-testid=source-sentence], .flag-src").forEach((n) => n.remove());
    return copy.textContent;
  });
  expect(findBannedWording(own)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("clean-result.png"), fullPage: true });
});

test("a review with Negotiate or Don't sign as written flags is not a Clean result", async ({ page }) => {
  await reviewText(page, read("fixtures/contracts/vendor-agreement-01.txt"));
  await expect(page.getByTestId("group-negotiate")).toBeVisible();
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
});
