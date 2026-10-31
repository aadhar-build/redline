// Ticket 22 in the browser, with the scripted fake adapter and fixtures/contracts/licence-form-01.txt.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const formText = fs.readFileSync(path.join(root, "fixtures/contracts/licence-form-01.txt"), "utf8");

async function reviewForm(page) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(formText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

test("a form with blanks gets the template note, and a number the form lacks is marked in the summary", async ({ page }) => {
  await reviewForm(page);
  await expect(page.getByTestId("template-note")).toHaveText(COPY.templateNote);
  await expect(page.getByTestId("summary").locator("mark[data-mark=number]")).toHaveText(["12"]);
  await expect(page.getByTestId("number-note")).toHaveText(COPY.numberNote);
  await expect(page.getByTestId("marked-note")).toHaveCount(0);
});

test("a flag with an unsupported number is withheld with its reason, and a typical claim is dropped", async ({ page }) => {
  await reviewForm(page);
  await expect(page.getByTestId("risk-flag")).toHaveCount(3);
  await expect(page.getByTestId("withheld-count")).toHaveText(COPY.flags.withheldTitle(1));
  await expect(page.getByTestId("withheld")).toContainText(COPY.flags.withheldReason["unsupported-number"](1, 1));
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("typically allows");
  expect(body).not.toContain("within 30 days");
  await expect(page.getByTestId("flag-judgment")).toHaveCount(2);
  await expect(page.getByTestId("severity-note")).toHaveText(COPY.flags.severityNote);
});

test("a quote without its clause number is shown from the number", async ({ page }) => {
  await reviewForm(page);
  await expect(page.getByTestId("source-sentence").filter({ hasText: "indemnify" })).toHaveText(
    "4.1 The Licensee shall indemnify the Licensor against all claims arising from the use of the office.",
  );
});

test("the review says whose side it is for, and Change reviews it again for another party", async ({ page }) => {
  await reviewForm(page);
  await expect(page.getByTestId("owner-line")).toContainText(COPY.owner.label);
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensee");

  await page.getByTestId("owner-change").click();
  // "the Landlord" is scripted as a party but the form never names one, so it is not offered.
  const options = await page.getByLabel(COPY.owner.pickLabel).locator("option").allTextContents();
  expect(options).toEqual(["the Licensor", "the Licensee"]);
  await page.getByLabel(COPY.owner.pickLabel).selectOption("the Licensor");

  const request = page.waitForRequest((r) => r.url().endsWith("/api/review"));
  await page.getByRole("button", { name: COPY.owner.submit }).click();
  expect(JSON.parse((await request).postData())).toMatchObject({ ownerParty: "the Licensor" });
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensor");
});
