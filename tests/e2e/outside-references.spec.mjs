// Outside references through the interface, signed out (ticket 13, ADR 0007). Each seeded kind is a
// Risk flag in its own group with its checked Source sentence and Redline's Counter-offer, and no
// request goes to any referenced address. Marking one reviewed needs a saved review, so signed out the
// review says to sign in (the signed-in flow is outside-references-saved.spec.mjs).

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";
import { findBannedWording } from "../../lib/review/wording.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const SENTENCES = [
  "1.1 The Supplier will provide the services described in each Statement of Work signed by both parties.",
  "1.2 The Customer will use the services in line with the Supplier's acceptable use policy at https://brightline.example.com/aup.",
  "1.3 The number of user seats is set out in the Order Form.",
  "1.4 The service levels in Schedule B apply to the services.",
];

async function reviewText(page, text) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(text);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

test("each seeded kind is raised with its Source sentence, and nothing fetches the referenced address", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await reviewText(page, read("fixtures/contracts/outside-references-01.txt"));

  const refs = page.getByTestId("group-outside").getByTestId("outside-reference");
  await expect(refs).toHaveCount(4);
  await expect(refs.getByTestId("source-sentence")).toHaveText(SENTENCES);
  await expect(refs.getByTestId("outside-state")).toHaveText(Array(4).fill(COPY.outside.notReviewedTag));
  for (const r of await refs.all()) {
    await expect(r).toHaveAttribute("data-severity", "negotiate");
    await expect(r.getByTestId("counter-offer-text")).toContainText("written agreement of both parties");
    await expect(r.getByTestId("outside-sign-in")).toHaveText(COPY.outside.signInToMark);
  }
  // The model gave no flags, but the review does not say it has none, and is not a Clean result.
  await expect(page.getByTestId("no-flags")).toHaveCount(0);
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await expect(page.getByTestId("clean-result-held")).toHaveCount(0);
  await expect(page.locator(".pane-status")).toHaveText(COPY.flags.status(4));
  // The web address is text, never a link.
  await expect(page.getByTestId("risk-flags").locator("a[href*='brightline']")).toHaveCount(0);

  const own = await page.getByTestId("risk-flags").evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("[data-testid=source-sentence], .flag-src").forEach((n) => n.remove());
    return clone.textContent;
  });
  expect(findBannedWording(own)).toEqual([]);

  // A network check: no request to any referenced address.
  await page.waitForLoadState("networkidle");
  expect(requests.filter((u) => u.includes("brightline") || u.includes("example.com"))).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("outside-references.png"), fullPage: true });
});

test('an "as amended" reference is Don\'t sign as written through Red line 3', async ({ page }) => {
  await reviewText(page, read("fixtures/contracts/outside-references-02.txt"));
  const refs = page.getByTestId("outside-reference");
  await expect(refs).toHaveCount(2);
  const amended = refs.filter({ hasText: "as amended from time to time" });
  await expect(amended).toHaveAttribute("data-severity", "dont-sign-as-written");
  await expect(amended.getByTestId("outside-red-line")).toContainText(COPY.flags.redLineMatched(3, ""));
  await expect(amended.getByTestId("outside-still-blocks")).toHaveText(COPY.outside.stillBlocks);
});

test("a model flag that only repeats an as amended reference is merged, and the sentence shows once (QUESTIONS.md 31)", async ({ page }) => {
  await reviewText(page, read("fixtures/contracts/vendor-agreement-03.txt"));
  const charges = "both as amended from time to time by Provider.";
  await expect(page.getByTestId("merged-count")).toHaveText(COPY.flags.merged(1));
  await expect(page.getByTestId("risk-flags").getByTestId("risk-flag").filter({ hasText: charges })).toHaveCount(0);
  const refs = page.getByTestId("outside-reference");
  await expect(refs).toHaveCount(1);
  await expect(refs.first()).toHaveAttribute("data-severity", "dont-sign-as-written");
  await expect(refs.first().getByTestId("outside-title")).toHaveText('Terms "as amended from time to time"');
  await expect(refs.first().getByTestId("source-sentence")).toHaveCount(1);
});
