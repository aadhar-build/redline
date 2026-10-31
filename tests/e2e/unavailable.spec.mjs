import { expect, test } from "@playwright/test";
import { COPY } from "../../app/(app)/review/copy.js";

// The same build with no model adapter configured, as on Vercel.

test("the page says analysis is unavailable and offers no paste box", async ({ page }) => {
  await page.goto("/review");
  const box = page.getByTestId("analysis-unavailable");
  await expect(box).toContainText(COPY.unavailableTitle);
  await expect(box).toContainText(COPY.unavailableBody);
  await expect(page.getByLabel(COPY.fieldLabel)).toHaveCount(0);
});

test("the review route refuses to run", async ({ request }) => {
  const res = await request.post("/api/review", { data: { text: "Any contract text." } });
  expect(res.status()).toBe(503);
  expect(await res.json()).toEqual({ error: "unavailable" });
});

test("the question route refuses to run", async ({ request }) => {
  const res = await request.post("/api/ask", { data: { text: "Any contract text.", question: "Is there a deposit?" } });
  expect(res.status()).toBe(503);
  expect(await res.json()).toEqual({ error: "unavailable" });
});
