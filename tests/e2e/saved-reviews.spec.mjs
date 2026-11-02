// Red lines in the Reviewer's own words and saved reviews after Red line edits (ticket 15), through the
// interface, against the LOCAL Supabase stack and the fake model adapter. Signs in with an emailed magic
// link read from the local inbox (Mailpit), on 127.0.0.1.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";
import { RED_LINES_COPY } from "../../app/(app)/red-lines/red-lines-copy.js";
import { OWN_RED_LINE_SEEDS, OWN_RED_LINES_DOCUMENT } from "../../fixtures/contracts/own-red-line-seeds.js";

const root = path.resolve(import.meta.dirname, "../..");
const contract = fs.readFileSync(path.join(root, OWN_RED_LINES_DOCUMENT), "utf8");

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

const email = `saved-reviews-e2e-${randomUUID().slice(0, 8)}@example.test`;
const admin = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

test.afterAll(async () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === email) await admin().auth.admin.deleteUser(u.id);
});

async function signInLink(address) {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?[^\s)]+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in email for ${address}`);
}

let session = null;
let savedPath = "";

async function signedIn(browser, baseURL) {
  const context = await browser.newContext({ baseURL, storageState: session });
  return { context, page: await context.newPage() };
}

const flagFor = (page, sentence) =>
  page.getByTestId("risk-flag").filter({ has: page.getByTestId("source-sentence").filter({ hasText: sentence }) });

test("a clause seeded for each Red line the Reviewer adds is flagged Don't sign as written, naming that Red line", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
  await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL(/\/library$/);
  session = await page.context().storageState();

  await page.goto("/red-lines");
  await expect(page.getByTestId("red-line")).toHaveCount(4);
  for (const [i, seed] of OWN_RED_LINE_SEEDS.entries()) {
    await page.getByLabel(RED_LINES_COPY.addLabel).fill(seed.redLine);
    await page.getByRole("button", { name: RED_LINES_COPY.addSubmit }).click();
    await expect(page.getByTestId("red-line")).toHaveCount(5 + i);
  }

  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(contract);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();
  for (const [i, seed] of OWN_RED_LINE_SEEDS.entries()) {
    const flag = flagFor(page, seed.sentences[0]);
    await expect(flag, seed.redLine).toHaveCount(1);
    await expect(flag).toHaveAttribute("data-severity", "dont-sign-as-written");
    await expect(flag.getByTestId("flag-red-line")).toContainText(COPY.flags.redLineMatched(5 + i, seed.redLine));
  }

  await page.getByRole("link", { name: LIBRARY_COPY.paste.savedLink }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  savedPath = new URL(page.url()).pathname;
  // Unchanged list: no marker, no re-run.
  await expect(page.getByTestId("older-list")).toHaveCount(0);
});

test("after a Red line edit, the library and the saved review say it was checked against an older list", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto("/red-lines");
  await page.getByRole("button", { name: RED_LINES_COPY.removeLabel(RED_LINES_COPY.ownLabel) }).first().click();
  await expect(page.getByTestId("red-line")).toHaveCount(7);

  await page.goto("/library");
  const row = page.getByTestId("library-item").filter({ has: page.locator(`a[href="${savedPath}"]`) });
  await expect(row.getByTestId("library-older-list")).toHaveText(LIBRARY_COPY.library.olderList);

  await page.goto(savedPath);
  await expect(page.getByTestId("older-list")).toContainText(LIBRARY_COPY.saved.olderList);
  // Still the saved review, checked against the list it was saved with.
  await expect(page.getByTestId("red-lines-checked")).toContainText(OWN_RED_LINE_SEEDS[0].redLine);
  await expect(flagFor(page, OWN_RED_LINE_SEEDS[0].sentences[0]).getByTestId("flag-red-line")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("older-list.png"), fullPage: true });
  await context.close();
});

test("re-running reviews the saved text against the current list and keeps the old review", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto(savedPath);
  await page.getByTestId("rerun-button").click();
  await expect(page.getByTestId("older-list")).toHaveCount(0);
  await expect(page.getByTestId("red-lines-checked")).not.toContainText(OWN_RED_LINE_SEEDS[0].redLine);
  await expect(flagFor(page, OWN_RED_LINE_SEEDS[0].sentences[0]).getByTestId("flag-red-line")).toHaveCount(0);
  await expect(flagFor(page, OWN_RED_LINE_SEEDS[1].sentences[0])).toHaveAttribute("data-severity", "dont-sign-as-written");

  await page.goto("/library");
  const row = page.getByTestId("library-item").filter({ has: page.locator(`a[href="${savedPath}"]`) });
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("library-older-list")).toHaveCount(0);

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    const documentId = savedPath.split("/").pop();
    const { data } = await admin().from("reviews").select("red_lines").eq("document_id", documentId).order("created_at");
    expect(data).toHaveLength(2);
    expect(data[0].red_lines.map((r) => r.name)).toContain(OWN_RED_LINE_SEEDS[0].redLine);
    expect(data[1].red_lines.map((r) => r.name)).not.toContain(OWN_RED_LINE_SEEDS[0].redLine);
  }
  await context.close();
});

test("signed out, a re-run of a saved document is not found and runs nothing", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const res = await page.request.post("/api/review", { data: { documentId: savedPath.split("/").pop(), text: contract } });
  expect(res.status()).toBe(404);
  await context.close();
});
