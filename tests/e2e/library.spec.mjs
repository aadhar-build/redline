// The saved library through the interface (ticket 10), against the LOCAL Supabase stack.
//
// Each account signs in with an emailed magic link, read from the local test inbox (Mailpit), and
// followed in the same browser that asked for it. Runs on 127.0.0.1, the host the local auth server
// allows sign-in links to return to.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { ASK_COPY } from "../../app/(app)/review/ask-copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const vendorText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const QUESTION = "How much notice does Customer need to give to stop the agreement renewing?";
const NO_ADAPTER = "http://127.0.0.1:3102";

function localEnv() {
  const file = path.join(root, ".env.local");
  const out = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return { ...out, ...process.env };
}
const env = localEnv();
const MAILPIT = env.MAILPIT_URL || "http://127.0.0.1:54324";

test.skip(!env.NEXT_PUBLIC_SUPABASE_URL, "Accounts are off: NEXT_PUBLIC_SUPABASE_URL is not set (run supabase start and fill .env.local).");
test.describe.configure({ mode: "serial" });

const runId = randomUUID().slice(0, 8);
const emailA = `library-e2e-a-${runId}@example.test`;
const emailB = `library-e2e-b-${runId}@example.test`;

// Deletes this run's two accounts from the shared local stack; their documents and reviews cascade.
// Test-only: the service-role key never appears in app code.
test.afterAll(async () => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email === emailA || u.email === emailB) await admin.auth.admin.deleteUser(u.id);
  }
});

async function signInLink(email) {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?[^\s)]+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in email for ${email}`);
}

async function signIn(page, email) {
  await page.goto("/sign-in");
  await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
  await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);
}

const flagTitles = (page) => page.getByTestId("flag-title").allTextContents();
const sources = (page) => page.getByTestId("source-sentence").allTextContents();

let savedPath = "";
let savedId = "";
// Account A signs in once; later tests reuse its session (the auth server limits how often one
// address can be sent a link).
let sessionA = null;

async function asA(browser, baseURL) {
  const context = await browser.newContext({ baseURL, storageState: sessionA });
  return { context, page: await context.newPage() };
}

test("a signed-in review is saved with its withheld count and reopens from the library as it was", async ({ page }) => {
  await signIn(page, emailA);
  sessionA = await page.context().storageState();
  await expect(page.getByTestId("library-empty")).toBeVisible();

  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(vendorText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();
  const summary = await page.getByTestId("summary").textContent();
  const titles = await flagTitles(page);
  const shownSources = await sources(page);
  expect(titles).toHaveLength(6);
  await expect(page.getByTestId("withheld-count")).toHaveText(COPY.flags.withheldTitle(5));

  // Reopening reads from the database; the model is not called again.
  const reviewCalls = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/review")) reviewCalls.push(req.url());
  });
  await page.getByRole("link", { name: LIBRARY_COPY.paste.savedLink }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  savedPath = new URL(page.url()).pathname;
  savedId = savedPath.split("/").pop();

  await expect(page.getByTestId("saved-note")).toHaveText(LIBRARY_COPY.saved.note);
  await expect(page.getByTestId("summary")).toHaveText(summary);
  expect(await flagTitles(page)).toEqual(titles);
  expect(await sources(page)).toEqual(shownSources);
  for (const s of await sources(page)) expect(vendorText).toContain(s);
  await expect(page.getByTestId("withheld-count")).toHaveText(COPY.flags.withheldTitle(5));

  await page.goto("/library");
  await expect(page.getByTestId("library-item")).toHaveCount(1);
  await expect(page.getByTestId("library-link")).toHaveText(vendorText.split("\n").find((l) => l.trim()).trim());
  await page.screenshot({ path: test.info().outputPath("library.png"), fullPage: true });
  expect(reviewCalls).toEqual([]);
});

test("a saved review reopens on a server with no model adapter, so reopening never re-analyses", async ({ browser, baseURL }) => {
  const { context, page } = await asA(browser, baseURL);
  // Session cookies belong to the host, so the same sign-in works on the no-adapter server's port.
  await page.goto(`${NO_ADAPTER}${savedPath}`);
  await expect(page.getByTestId("risk-flag")).toHaveCount(6);
  await expect(page.getByTestId("withheld-count")).toHaveText(COPY.flags.withheldTitle(5));
  await expect(page.getByTestId("ask-off")).toHaveText(LIBRARY_COPY.saved.askOff);
  await page.screenshot({ path: test.info().outputPath("reopened-no-adapter.png"), fullPage: true });
  await context.close();
});

test("the question box on a saved review sends only the document id, and the server answers from the stored text", async ({ browser, baseURL }) => {
  const { context, page } = await asA(browser, baseURL);
  await page.goto(savedPath);

  const bodies = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/ask")) bodies.push(req.postDataJSON());
  });
  await page.getByLabel(ASK_COPY.fieldLabel).fill(QUESTION);
  await page.getByRole("button", { name: ASK_COPY.submit, exact: true }).click();
  await expect(page.getByTestId("answer")).toBeVisible();
  for (const s of await page.getByTestId("answer-source").locator("blockquote").allTextContents()) {
    expect(vendorText).toContain(s);
  }
  expect(bodies).toEqual([{ documentId: savedId, question: QUESTION }]);

  // Posted text is ignored once there is a document id. The fake adapter only has a script for the
  // stored fixture, so an answer here means the server used the stored text, not "tampered".
  const tampered = await page.request.post("/api/ask", { data: { documentId: savedId, text: "Tampered text.", question: QUESTION } });
  expect(tampered.status()).toBe(200);
  expect((await tampered.json()).answer.status).toBe("answered");

  // An id that is not in this account's library never falls back to the posted text.
  const unknown = await page.request.post("/api/ask", { data: { documentId: randomUUID(), text: vendorText, question: QUESTION } });
  expect(unknown.status()).toBe(404);
  await context.close();
});

test("a second signed-in account sees none of the first account's documents", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page, emailB);
  await expect(page.getByTestId("library-empty")).toBeVisible();
  await expect(page.getByTestId("library-item")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("library-empty.png"), fullPage: true });

  const opened = await page.goto(savedPath);
  expect(opened.status()).toBe(404);
  await expect(page.getByTestId("saved-not-found")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(vendorText.split("\n").find((l) => l.trim()).trim());

  const asked = await page.request.post("/api/ask", { data: { documentId: savedId, question: QUESTION } });
  expect(asked.status()).toBe(404);
  await context.close();
});

test("signed out, the library asks for sign-in and a saved review cannot be opened", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/library");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto(savedPath);
  await expect(page).toHaveURL(/\/sign-in$/);
  const asked = await page.request.post("/api/ask", { data: { documentId: savedId, question: QUESTION } });
  expect(asked.status()).toBe(404);

  // The paste flow still works signed out, unsaved.
  await page.goto("/review");
  await expect(page.getByTestId("not-signed-in")).toBeVisible();
  await page.getByLabel(COPY.fieldLabel).fill(vendorText);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("summary")).toBeVisible();
  await expect(page.getByTestId("saved-note")).toHaveCount(0);
  await context.close();
});
