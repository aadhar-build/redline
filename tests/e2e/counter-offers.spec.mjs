// Tickets 08 and 17: every shown flag has a Counter-offer with a copy button; Know this ones are quieter;
// breaches in the wording are marked, never withheld.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vendorText = read("fixtures/contracts/vendor-agreement-01.txt");
const scripted = JSON.parse(read("fixtures/model-output/vendor-agreement-01.risk-flags.json")).riskFlags;
const breachText = read("fixtures/contracts/counter-offers-01.txt");

async function reviewText(page, text) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(text);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("risk-flags")).toBeVisible();
}

const flagTitled = (page, title) => page.getByTestId("risk-flag").filter({ has: page.getByTestId("flag-title").filter({ hasText: title }) });

test("every shown flag has its Counter-offer under its Source sentence, Know this ones quieter", async ({ page }) => {
  await reviewText(page, vendorText);
  const flags = page.getByTestId("risk-flag");
  await expect(flags).toHaveCount(6);
  for (const f of await flags.all()) {
    await expect(f.getByTestId("counter-offer")).toHaveCount(1);
    await expect(f.getByTestId("counter-offer")).toBeVisible();
    await expect(f.getByTestId("counter-offer").locator("figcaption")).toContainText(COPY.counterOffer.caption);
    const quiet = (await f.getAttribute("data-severity")) === "know-this" ? "true" : "false";
    await expect(f.getByTestId("counter-offer")).toHaveAttribute("data-quiet", quiet);
    // The Counter-offer box comes after the Source sentence boxes.
    const order = await f.locator("[data-testid=source-sentence], [data-testid=counter-offer]").evaluateAll((els) => els.map((e) => e.dataset.testid));
    expect(order[order.length - 1]).toBe("counter-offer");
  }
  for (const s of scripted.slice(0, 6)) {
    await expect(flagTitled(page, s.title).getByTestId("counter-offer-text")).toHaveText(s.counterOffer);
  }
  // A withheld flag's Counter-offer is never shown.
  const body = await page.locator("body").textContent();
  for (const s of scripted.slice(6)) expect(body).not.toContain(s.counterOffer);
  await expect(page.getByTestId("counter-offer-note")).toHaveText(COPY.counterOffer.note);
  await expect(page.getByTestId("counter-offer-marked-note")).toHaveCount(0);
  await expect(page.getByTestId("counter-offer-number-note")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("counter-offers.png"), fullPage: true });
});

test("the copy button puts the Counter-offer wording on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await reviewText(page, vendorText);
  const s = scripted[1];
  const flag = flagTitled(page, s.title);
  const button = flag.getByTestId("counter-offer-copy");
  await expect(button).toHaveText(COPY.counterOffer.copy);
  await button.click();
  await expect(button).toHaveText(COPY.counterOffer.copied);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(s.counterOffer);
});

test("a copy that fails says so", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await reviewText(page, vendorText);
  const flag = page.getByTestId("risk-flag").first();
  await flag.getByTestId("counter-offer-copy").click();
  await expect(flag.getByTestId("counter-offer-copy-failed")).toHaveText(COPY.counterOffer.copyFailed);
});

test("breaches in Counter-offer wording are marked and the flags still show", async ({ page }) => {
  await reviewText(page, breachText);
  await expect(page.getByTestId("risk-flag")).toHaveCount(5);
  await expect(page.getByTestId("withheld")).toHaveCount(0);

  const may = flagTitled(page, "Contractor can end the agreement on three days' notice").getByTestId("counter-offer-text");
  await expect(may.locator("mark[data-mark=word]")).toHaveText(["may"]);
  const number = flagTitled(page, "Seven days to pay").getByTestId("counter-offer-text");
  await expect(number.locator("mark[data-mark=number]")).toHaveText(["14"]);
  // The exemptions hold.
  const late = flagTitled(page, "Daily late fee").getByTestId("counter-offer-text");
  await expect(late.locator("mark[data-mark=word], mark[data-mark=number]")).toHaveCount(0);
  // Ticket 08b: the words of a new term the contract doesn't use are marked.
  const insurance = flagTitled(page, "No liability for damaged stock").getByTestId("counter-offer-text");
  await expect(insurance.locator("mark[data-mark=new-term]")).toHaveText(["carry insurance", "covers"]);
  await expect(page.getByTestId("counter-offer-new-term-note")).toHaveText(COPY.counterOffer.newTermNote);

  const missing = flagTitled(page, "Monthly visits from May 2027");
  await expect(missing.getByTestId("counter-offer")).toHaveCount(0);
  await expect(missing.getByTestId("counter-offer-missing")).toHaveText(COPY.counterOffer.missing);

  await expect(page.getByTestId("counter-offer-marked-note")).toHaveText(COPY.counterOffer.markedNote);
  await expect(page.getByTestId("counter-offer-number-note")).toHaveText(COPY.counterOffer.numberNote);
  await page.screenshot({ path: test.info().outputPath("counter-offer-breaches.png"), fullPage: true });
});
