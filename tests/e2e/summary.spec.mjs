import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const fixtureText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const fixtureSummary = JSON.parse(
  fs.readFileSync(path.join(root, "fixtures/model-output/vendor-agreement-01.summary.json"), "utf8"),
).summary;

test("pasting the fixture contract shows its plain-English summary", async ({ page }) => {
  const modelHosts = [];
  page.on("request", (req) => {
    if (/anthropic\.com|claude\.ai/.test(req.url())) modelHosts.push(req.url());
  });

  await page.goto("/review");
  await expect(page.getByText(COPY.emptyState)).toBeVisible();

  await page.getByLabel(COPY.fieldLabel).fill(fixtureText);
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/review") && r.method() === "POST");
  await page.getByRole("button", { name: COPY.submit }).click();

  const request = await posted;
  expect(JSON.parse(request.postData())).toEqual({ text: fixtureText });

  await expect(page.getByTestId("summary")).toHaveText(fixtureSummary);
  await expect(page.getByText(COPY.summaryNote)).toBeVisible();
  expect(modelHosts).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("summary.png"), fullPage: true });
});

test("an empty paste asks for the contract text", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText(COPY.errors["empty-document"]);
});

test("text the fake adapter has no script for is refused, not summarised", async ({ page }) => {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill("This lease is between two made-up parties.");
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText(COPY.errors["no-script"]);
  await expect(page.getByTestId("summary")).toHaveCount(0);
});
