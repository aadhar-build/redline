// Adding the document an Outside reference brings in (ticket 18), signed in, against the LOCAL Supabase
// stack and the fake model adapter. The referenced Schedule B is uploaded as a Word file: it is read in
// the browser and only its text is posted. The two are reviewed together, the reference resolves, and the
// flag from Schedule B quotes Schedule B's own sentence. All of it survives reopening from the library.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";
import { makeDocx, p } from "../support/make-docx.mjs";
import { makePdf, textPage } from "../support/make-pdf.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const contract = fs.readFileSync(path.join(root, "fixtures/contracts/outside-references-01.txt"), "utf8");
const scheduleB = fs.readFileSync(path.join(root, "fixtures/contracts/outside-references-01.schedule-b.txt"), "utf8");
const SUSPEND = "3. The Supplier can suspend the services for maintenance at any time without notice.";

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

const email = `referenced-e2e-${randomUUID().slice(0, 8)}@example.test`;
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

test("adding the referenced document reviews the two together and resolves the reference", async ({ page }) => {
  const posted = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/referenced-documents")) posted.push(r.postData() ?? "");
  });

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
  const b = refs.nth(3);
  await expect(b.getByTestId("source-sentence")).toHaveText("1.4 The service levels in Schedule B apply to the services.");
  await b.getByTestId("outside-add-open").click();
  // A PDF over the page limit is refused here too, and nothing is posted.
  await b.getByTestId("outside-add-file").setInputFiles({
    name: "long.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(Array.from({ length: 301 }, (_, i) => textPage([`Clause ${i + 1} sets the rent.`]))),
  });
  await expect(b.getByText(COPY.errors["too-many-pages"])).toBeVisible();
  expect(posted).toHaveLength(0);
  const docx = Buffer.from(await makeDocx({ body: scheduleB.split("\n").filter((l) => l.trim()).map((l) => p(l)).join("") }));
  await b.getByTestId("outside-add-file").setInputFiles({
    name: "schedule-b.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: docx,
  });
  await expect(b.getByTestId("outside-add-text")).toHaveValue(/suspend the services for maintenance/);
  await b.getByTestId("outside-add-submit").click();

  await expect(b.getByTestId("outside-added")).toBeVisible();
  await expect(b.getByTestId("outside-state")).toHaveText(COPY.outside.addedTag);
  const flag = page.getByTestId("flag-from-referenced");
  await expect(flag).toHaveCount(1);
  await expect(page.getByTestId("source-sentence").filter({ hasText: SUSPEND })).toHaveCount(1);
  // The other three references are still open, so no Clean result.
  await expect(page.getByTestId("clean-result")).toHaveCount(0);

  // Only the text was posted, never the file.
  expect(posted).toHaveLength(1);
  const body = JSON.parse(posted[0]);
  expect(body.source).toBe("docx");
  expect(body.text).toContain("suspend the services for maintenance");
  expect(posted[0]).not.toContain("word/document.xml");

  // Reopened from the library, both texts are read back and the reference stays resolved.
  await page.goto("/library");
  await page.getByRole("link", { name: /SERVICES AGREEMENT/ }).first().click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("outside-reference").nth(3).getByTestId("outside-added")).toBeVisible();
  await expect(page.getByTestId("flag-from-referenced")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("referenced-upload-saved.png"), fullPage: true });
});
