// Change on a saved document and earlier reviews (ticket 24 part 2), through the interface, against the
// LOCAL Supabase stack and the fake model adapter, with fixtures/contracts/licence-form-01.txt (whose
// scripted reply names both parties and has one judgment that claims what is usual). Signs in with an
// emailed magic link read from the local inbox (Mailpit), on 127.0.0.1.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const contract = fs.readFileSync(path.join(root, "fixtures/contracts/licence-form-01.txt"), "utf8");

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

const email = `review-history-e2e-${randomUUID().slice(0, 8)}@example.test`;
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

test("Change on a signed-in review re-runs the saved document, and the library keeps one entry", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
  await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL(/\/library$/);
  session = await page.context().storageState();

  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(contract);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensee");
  await expect(page.getByTestId("judgments-dropped")).toHaveText(COPY.flags.judgmentsDropped(1));
  savedPath = await page.getByTestId("saved-note").getByRole("link").getAttribute("href");

  await page.getByTestId("owner-change").click();
  await page.getByLabel(COPY.owner.pickLabel).selectOption("the Licensor");
  const request = page.waitForRequest((r) => r.url().endsWith("/api/review") && r.method() === "POST");
  await page.getByRole("button", { name: COPY.owner.submit }).click();
  const posted = JSON.parse((await request).postData());
  expect(posted).toEqual({ documentId: savedPath.split("/").pop(), ownerParty: "the Licensor" });
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensor");
  await expect(page.getByTestId("saved-note").getByRole("link")).toHaveAttribute("href", savedPath);

  await page.goto("/library");
  await expect(page.getByTestId("library-item")).toHaveCount(1);
});

test("the reopened review says whose side it was for and how many judgments were left out", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto(savedPath);
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensor");
  await expect(page.getByTestId("judgments-dropped")).toHaveText(COPY.flags.judgmentsDropped(1));
  await expect(page.getByTestId("earlier-review")).toHaveCount(0);

  const rows = page.getByTestId("history-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId("history-latest")).toHaveText(LIBRARY_COPY.saved.history.latest);
  await expect(rows.nth(0).getByTestId("history-open")).toBeVisible();
  await expect(rows.nth(1).getByTestId("history-latest")).toHaveCount(0);
  await context.close();
});

test("an earlier review opens read-only, for the party it was reviewed for", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  let posts = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/review") && r.method() === "POST") posts += 1; });
  await page.goto(savedPath);
  await page.getByTestId("history-row").nth(1).getByTestId("history-date").click();
  await expect(page).toHaveURL(/\?review=[0-9a-f-]{36}$/);
  await expect(page.getByTestId("earlier-review")).toBeVisible();
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensee");
  await expect(page.getByTestId("owner-change")).toHaveCount(0);
  await expect(page.getByTestId("rerun")).toHaveCount(0);
  await expect(page.getByTestId("history-row").nth(1).getByTestId("history-open")).toBeVisible();
  expect(posts).toBe(0);

  // A review id that isn't this document's is not found.
  await page.goto(`${savedPath}?review=00000000-0000-4000-8000-000000000000`);
  await expect(page.getByText(LIBRARY_COPY.saved.notFound)).toBeVisible();
  await context.close();
});

test("Change on the latest saved review saves a new review of the same document", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto(savedPath);
  await page.getByTestId("owner-change").click();
  await page.getByLabel(COPY.owner.pickLabel).fill("the Licensee");
  await page.getByRole("button", { name: COPY.owner.submit }).click();
  await expect(page.getByTestId("history-row")).toHaveCount(3);
  await expect(page.getByTestId("owner-party")).toHaveText("the Licensee");
  await page.goto("/library");
  await expect(page.getByTestId("library-item")).toHaveCount(1);
  await context.close();
});
