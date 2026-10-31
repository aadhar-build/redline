// Ticket 20: Copy all as text, right after a review. One button puts the whole review on the clipboard,
// in screen order, with nothing the screen does not show.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const scripted = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags;

test("Copy all as text copies the displayed review in screen order and announces it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = [];
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(vendorText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();

  page.on("request", (r) => requests.push(r.url()));
  const button = page.getByTestId("copy-all-button");
  await expect(button).toHaveText(COPY.copyAll.button);
  await button.click();
  await expect(button).toHaveText(COPY.copyAll.copied);
  await expect(page.getByTestId("copy-all-status")).toHaveText(COPY.copyAll.status);
  expect(requests).toEqual([]);

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const body = await page.locator("body").innerText();

  expect(copied).toContain(await page.getByTestId("summary").innerText());
  // Every Source sentence, in the order shown, word for word.
  const shown = await page.getByTestId("source-sentence").allInnerTexts();
  let at = -1;
  for (const s of shown) {
    const next = copied.indexOf(`"${s}"`, at + 1);
    expect(next).toBeGreaterThan(at);
    at = next;
  }
  for (const t of await page.getByTestId("counter-offer-text").allInnerTexts()) expect(copied).toContain(t);
  await expect(page.getByTestId("withheld-count")).toBeVisible();
  expect(copied).toContain(await page.getByTestId("withheld-count").innerText());
  // Nothing hidden: withheld flags stay out, and every quoted line is on screen.
  for (const s of scripted.slice(6)) expect(copied).not.toContain(s.counterOffer);
  for (const line of copied.split("\n").filter((l) => /^".*"$/.test(l))) expect(body).toContain(line.slice(1, -1));
});
