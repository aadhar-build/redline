// Ticket 20: Copy all as text on a review reopened from the library, with an Outside reference's
// reviewed state. Runs against the local Supabase stack, signed in by magic link (Mailpit).
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const contract = fs.readFileSync(path.join(root, "fixtures/contracts/outside-references-01.txt"), "utf8");

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
test.skip(!env.NEXT_PUBLIC_SUPABASE_URL, "Accounts are off: NEXT_PUBLIC_SUPABASE_URL is not set.");

const email = `copy-all-e2e-${randomUUID().slice(0, 8)}@example.test`;
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

test("a reopened review copies the same flags and each Outside reference's reviewed state", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/sign-in");
  await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
  await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL(/\/library$/);

  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(contract);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();
  const refs = page.getByTestId("outside-reference");
  await refs.first().getByTestId("outside-mark").click();
  await expect(refs.first()).toHaveAttribute("data-reviewed", "yes");

  await page.getByRole("link", { name: LIBRARY_COPY.paste.savedLink }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  await page.getByTestId("copy-all-button").click();
  await expect(page.getByTestId("copy-all-status")).toHaveText(COPY.copyAll.status);
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  for (const s of await page.getByTestId("source-sentence").allInnerTexts()) expect(copied).toContain(`"${s}"`);
  expect(copied).toContain(COPY.outside.reviewedTag);
  expect(copied).toContain(COPY.outside.notReviewedTag);
  expect(copied).toContain(COPY.outside.statementLabel);
});
