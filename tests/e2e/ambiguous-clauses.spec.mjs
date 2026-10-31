// Ticket 07 and 16: an Ambiguous clause shows its checked Source sentence and every reading, none
// chosen, at Negotiate, and blocks a Clean result.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const twoText = read("fixtures/contracts/ambiguous-clauses-01.txt");
const twoScript = JSON.parse(read("fixtures/model-output/ambiguous-clauses-01.risk-flags.json")).riskFlags;
const onlyText = read("fixtures/contracts/ambiguous-clause-only-01.txt");

async function reviewText(page, text) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(text);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

const flagTitled = (page, title) => page.getByTestId("risk-flag").filter({ has: page.getByTestId("flag-title").filter({ hasText: title }) });

test("each Ambiguous clause shows its Source sentence and both readings, at Negotiate, with none chosen", async ({ page }) => {
  await reviewText(page, twoText);
  for (const s of twoScript.filter((f) => f.readings)) {
    const flag = flagTitled(page, s.title);
    await expect(flag).toHaveAttribute("data-severity", "negotiate");
    await expect(flag.getByTestId("ambiguous-label")).toHaveText(COPY.ambiguous.label);
    await expect(flag.getByTestId("flag-readings")).toContainText(COPY.ambiguous.lede);
    const readings = flag.getByTestId("flag-reading");
    await expect(readings).toHaveCount(s.readings.length);
    for (const [i, r] of s.readings.entries()) {
      await expect(readings.nth(i)).toContainText(COPY.ambiguous.readingCaption(i + 1, s.readings.length));
      await expect(readings.nth(i)).toContainText(r);
    }
    await expect(flag.getByTestId("source-sentence")).toHaveText(s.sourceSentences[0]);
  }
  const ordinary = twoScript.find((f) => !f.readings);
  await expect(flagTitled(page, ordinary.title).getByTestId("flag-readings")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("ambiguous-clauses.png"), fullPage: true });
});

test("a contract whose only flag is one Ambiguous clause is not a Clean result, and nothing says it was held back", async ({ page }) => {
  await reviewText(page, onlyText);
  await expect(page.getByTestId("risk-flag")).toHaveCount(1);
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await expect(page.getByTestId("clean-result-held")).toHaveCount(0);
  await expect(page.getByTestId("group-negotiate").getByTestId("flag-reading")).toHaveCount(2);
});
