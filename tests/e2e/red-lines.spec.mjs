// The Reviewer edits their Red lines through the interface (ticket 12), against the LOCAL Supabase stack
// and the fake model adapter. Signs in with an emailed magic link read from the local inbox (Mailpit),
// on 127.0.0.1, the host the local auth server allows sign-in links to return to.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";
import { RED_LINES_COPY } from "../../app/(app)/red-lines/red-lines-copy.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";

const root = path.resolve(import.meta.dirname, "../..");
const contract = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-02.txt"), "utf8");
const GUARANTEE = "Henry Alvarez, who owns Merchant, personally guarantees every obligation of Merchant under this Agreement.";
const OWN = "Card fees that rise without a signed change";
const REWORDED = "Auto-renewal with any exit fee, or a minimum term over 12 months";

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

const email = `red-lines-e2e-${randomUUID().slice(0, 8)}@example.test`;

test.afterAll(async () => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === email) await admin.auth.admin.deleteUser(u.id);
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

const names = (page) => page.getByTestId("red-line-name").allTextContents();
const checked = (page) => page.getByTestId("red-line-checked").evaluateAll((els) => els.map((e) => e.dataset.redLine));

test("a new account starts with the four Default Red lines, each labelled with its basis", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
  await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL(/\/library$/);
  session = await page.context().storageState();

  await page.getByRole("link", { name: RED_LINES_COPY.nav }).click();
  await expect(page).toHaveURL(/\/red-lines$/);
  await expect(page.getByTestId("red-line")).toHaveCount(4);
  expect(await names(page)).toEqual(DEFAULT_RED_LINES.map((r) => r.name));
  expect(await page.getByTestId("red-line-label").allTextContents()).toEqual([1, 2, 3, 4].map(RED_LINES_COPY.defaultLabel));
  const bases = await page.getByTestId("red-line-basis").allTextContents();
  DEFAULT_RED_LINES.forEach((r, i) => expect(bases[i]).toContain(r.basis.label));
  await expect(page.getByTestId("red-lines-removed")).toHaveCount(0);
});

test("the Reviewer removes, rewords and adds Red lines, and the changes are there in a new session", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto("/red-lines");

  await page.getByRole("button", { name: RED_LINES_COPY.removeLabel(RED_LINES_COPY.defaultLabel(1)) }).click();
  await expect(page.getByTestId("red-line")).toHaveCount(3);
  // Removing a Default Red line says plainly that its protection is gone.
  await expect(page.getByTestId("red-line-removed")).toHaveText(RED_LINES_COPY.removed(1, DEFAULT_RED_LINES[0].name));

  await page.getByRole("button", { name: RED_LINES_COPY.editLabel(RED_LINES_COPY.defaultLabel(2)) }).click();
  await page.getByLabel(RED_LINES_COPY.editLabel(RED_LINES_COPY.defaultLabel(2))).fill(REWORDED);
  await page.getByRole("button", { name: RED_LINES_COPY.save }).click();
  await expect(page.getByTestId("red-line-edited")).toHaveText(RED_LINES_COPY.editedNote(2));

  await page.getByLabel(RED_LINES_COPY.addLabel).fill(OWN);
  await page.getByRole("button", { name: RED_LINES_COPY.addSubmit }).click();
  await expect(page.getByTestId("red-line")).toHaveCount(4);

  // An empty Red line is refused with a message.
  await page.getByRole("button", { name: RED_LINES_COPY.addSubmit }).click();
  await expect(page.getByTestId("red-lines-error")).toHaveText(RED_LINES_COPY.errors["empty-red-line"]);
  await page.screenshot({ path: test.info().outputPath("red-lines.png"), fullPage: true });
  await context.close();

  const later = await signedIn(browser, baseURL);
  await later.page.goto("/red-lines");
  expect(await names(later.page)).toEqual([REWORDED, DEFAULT_RED_LINES[2].name, DEFAULT_RED_LINES[3].name, OWN]);
  await expect(later.page.getByTestId("red-line-removed")).toHaveCount(1);
  await later.context.close();
});

test("the next review is checked against the current list: a removed Default Red line's clause is not a match", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto("/review");
  await expect(page.getByTestId("own-red-lines")).toBeVisible();
  await page.getByLabel(COPY.fieldLabel).fill(contract);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();

  // The personal guarantee is still flagged, but not as a Red line match.
  const guarantee = page.getByTestId("risk-flag").filter({ has: page.getByTestId("source-sentence").filter({ hasText: GUARANTEE }) });
  await expect(guarantee).toHaveCount(1);
  await expect(guarantee.getByTestId("flag-red-line")).toHaveCount(0);
  // Its Severity is now the one the model gave it: the script puts this clause at Don't sign as written.
  await expect(guarantee).toHaveAttribute("data-severity", "dont-sign-as-written");

  const ids = await checked(page);
  expect(ids).not.toContain("default-personal-guarantee");
  expect(ids.slice(0, 3)).toEqual(["default-auto-renewal-or-long-term", "default-one-sided-changes", "default-uncapped-liability"]);
  expect(ids[3]).toMatch(/^own-/);
  await expect(page.getByTestId("red-lines-checked")).toContainText(REWORDED);
  await expect(page.getByTestId("red-lines-checked")).toContainText(OWN);

  await page.getByRole("link", { name: LIBRARY_COPY.paste.savedLink }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  savedPath = new URL(page.url()).pathname;
  await context.close();
});

test("a saved review keeps the list it was checked against after the list changes", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await page.goto("/red-lines");
  await page.getByRole("button", { name: RED_LINES_COPY.removeLabel(RED_LINES_COPY.ownLabel) }).click();
  await expect(page.getByTestId("red-line")).toHaveCount(3);

  await page.goto(savedPath);
  await expect(page.getByTestId("red-lines-checked")).toContainText(OWN);
  expect(await checked(page)).toHaveLength(4);
  await context.close();
});

test("signed out, there is no Red lines page and the list cannot be read or changed", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/red-lines");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.request.get("/api/red-lines")).status()).toBe(401);
  expect((await page.request.post("/api/red-lines", { data: { text: "Planted" } })).status()).toBe(401);
  await context.close();
});
