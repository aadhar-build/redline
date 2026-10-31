// Marking Outside references as reviewed through the interface (ticket 13), signed in, against the
// LOCAL Supabase stack and the fake model adapter. The mark is saved and shown as the Reviewer's
// statement, and survives a reload. Signs in with a magic link read from the local inbox (Mailpit).

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

test.skip(!env.NEXT_PUBLIC_SUPABASE_URL, "Accounts are off: NEXT_PUBLIC_SUPABASE_URL is not set (run supabase start and fill .env.local).");

const email = `outside-refs-e2e-${randomUUID().slice(0, 8)}@example.test`;
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

test("marking a reference reviewed is saved and shown as the Reviewer's statement, not Redline's check", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));

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
  await expect(refs).toHaveCount(4);
  const first = refs.first();
  await expect(first.getByTestId("outside-not-reviewed")).toHaveText(COPY.outside.notReviewed);
  await first.getByTestId("outside-mark").click();
  await expect(first).toHaveAttribute("data-reviewed", "yes");
  await expect(first.getByTestId("outside-state")).toHaveText(COPY.outside.reviewedTag);
  await expect(first.getByTestId("outside-statement")).toContainText(COPY.outside.statementLabel);
  await expect(first.getByTestId("outside-statement")).toContainText("Redline hasn't read the referenced terms.");
  await expect(first.getByTestId("outside-mark")).toHaveText(COPY.outside.unmark);

  // Reopened from the library, the mark is still there; the others are not marked.
  await page.getByRole("link", { name: LIBRARY_COPY.paste.savedLink }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  const saved = page.getByTestId("outside-reference");
  await expect(saved).toHaveCount(4);
  await expect(saved.first()).toHaveAttribute("data-reviewed", "yes");
  await expect(saved.nth(1)).toHaveAttribute("data-reviewed", "no");

  // Mark the rest: now a Clean result, with the note that the marks are the Reviewer's own statement.
  for (const i of [1, 2, 3]) {
    await saved.nth(i).getByTestId("outside-mark").click();
    await expect(saved.nth(i)).toHaveAttribute("data-reviewed", "yes");
  }
  await expect(page.getByTestId("clean-result")).toBeVisible();
  await expect(page.getByTestId("clean-outside-note")).toHaveText(COPY.clean.outsideReviewed);

  // Take one back.
  await saved.first().getByTestId("outside-mark").click();
  await expect(saved.first()).toHaveAttribute("data-reviewed", "no");
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await expect(page.getByTestId("outside-reference").first()).toHaveAttribute("data-reviewed", "no");

  await page.screenshot({ path: test.info().outputPath("outside-references-saved.png"), fullPage: true });
  expect(requests.filter((u) => u.includes("brightline") || u.includes("example.com"))).toEqual([]);
});
