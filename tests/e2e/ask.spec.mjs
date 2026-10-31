import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ASK_COPY } from "../../app/(app)/review/ask-copy.js";
import { COPY } from "../../app/(app)/review/copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const fixtureText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const questions = JSON.parse(fs.readFileSync(path.join(root, "fixtures/questions/vendor-agreement-01.json"), "utf8"))
  .questions;
const byQuestion = (q) => questions.find((e) => e.question === q);

async function summarise(page) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(fixtureText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("summary")).toBeVisible();
}

async function askQuestion(page, question) {
  await page.getByLabel(ASK_COPY.fieldLabel).fill(question);
  await page.getByRole("button", { name: ASK_COPY.submit, exact: true }).click();
}

test("an answered question shows the answer and its checked Source sentences", async ({ page }) => {
  const modelHosts = [];
  page.on("request", (req) => {
    if (/anthropic\.com|claude\.ai/.test(req.url())) modelHosts.push(req.url());
  });
  await summarise(page);
  await expect(page.getByText(ASK_COPY.emptyState)).toBeVisible();

  const q = byQuestion("When is each invoice due, and what happens if it is paid late?");
  // The summarised text is what is sent, even if the paste box changes afterwards.
  await page.getByLabel(COPY.fieldLabel).fill("Something else entirely.");
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/ask") && r.method() === "POST");
  await askQuestion(page, q.question);
  expect(JSON.parse((await posted).postData())).toEqual({ text: fixtureText, question: q.question });

  await expect(page.getByTestId("answer-text")).toHaveText(q.reply.answer);
  await expect(page.getByTestId("answer-source").locator("blockquote")).toHaveText(q.reply.sources);
  await expect(page.getByTestId("answer-text").locator("mark")).toHaveCount(0);
  expect(modelHosts).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("answer.png"), fullPage: true });
});

test("every question in the fixture set the contract doesn't answer gets no answer", async ({ page }) => {
  await summarise(page);
  for (const q of questions.filter((e) => !e.inDocument)) {
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/ask"));
    await askQuestion(page, q.question);
    expect((await (await answered).json()).answer.status).toBe(q.expect);
    const testId = q.expect === "withheld" ? "answer-withheld" : "not-in-document";
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByTestId("answer")).toHaveCount(0);
    if (q.reply.answer) await expect(page.getByText(q.reply.answer)).toHaveCount(0);
  }
});

test("the not-in-document result says so and drops any answer the model sent with it", async ({ page }) => {
  await summarise(page);
  await askQuestion(page, "What happens if a dispute goes to arbitration?");
  await expect(page.getByTestId("not-in-document")).toHaveText(ASK_COPY.notInDocument);
  await expect(page.getByText(/Arbitration and Conciliation Act/)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("not-in-document.png"), fullPage: true });
});

test("an answer whose source is altered is withheld", async ({ page }) => {
  await summarise(page);
  await askQuestion(page, "How long is the notice period for ending the renewal?");
  await expect(page.getByTestId("answer-withheld")).toHaveText(ASK_COPY.withheld["source-not-found"]);
  await expect(page.getByText(/sixty days/)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("withheld.png"), fullPage: true });
});

test("a banned word in an answer is marked", async ({ page }) => {
  await summarise(page);
  await askQuestion(page, "Can Vendor raise the fee?");
  await expect(page.getByTestId("answer-text").locator("mark")).toHaveText(["may"]);
  await expect(page.getByTestId("answer-marked-note")).toHaveText(ASK_COPY.markedNote);
});

test("an empty question asks for one", async ({ page }) => {
  await summarise(page);
  await page.getByRole("button", { name: ASK_COPY.submit, exact: true }).click();
  await expect(page.locator(".question-form .form-error")).toHaveText(ASK_COPY.errors["empty-question"]);
});
