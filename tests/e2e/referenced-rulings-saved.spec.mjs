// The Fable advisor's rulings on QUESTIONS.md 36 to 41 (2026-10-31) in the browser, signed in, against the
// LOCAL Supabase stack and the fake model adapter, with fixtures/contracts/referenced-02.txt (two Outside
// references, Schedule B and the Order Form, and no Risk flags) and the documents scripted with it.
// Signs in with an emailed magic link read from the local inbox (Mailpit), on 127.0.0.1.


import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { COPY } from "../../app/(app)/review/copy.js";
import { LIBRARY_COPY } from "../../app/(app)/library/library-copy.js";
import { ASK_COPY } from "../../app/(app)/review/ask-copy.js";

const root = path.resolve(import.meta.dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, `fixtures/contracts/${name}.txt`), "utf8");
const contract = read("referenced-02");
const scheduleB = read("referenced-02.schedule-b");
const wrong = read("referenced-02.wrong");
const nestedB = read("referenced-02.schedule-b-nested");
const orderDetails = read("referenced-02.order-details");

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

const email = `referenced-rulings-e2e-${randomUUID().slice(0, 8)}@example.test`;
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

async function signedIn(browser, baseURL) {
  if (!session) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/sign-in");
    await page.getByLabel(LIBRARY_COPY.signIn.emailLabel).fill(email);
    await page.getByRole("button", { name: LIBRARY_COPY.signIn.submit }).click();
    await expect(page.getByTestId("link-sent")).toBeVisible();
    await page.goto(await signInLink(email));
    await expect(page).toHaveURL(/\/library$/);
    session = await context.storageState();
    await context.close();
  }
  const context = await browser.newContext({ baseURL, storageState: session });
  return { context, page: await context.newPage() };
}

// Reviews referenced-02 as a new saved document and returns its library path.
async function reviewed(page) {
  await page.goto("/review");
  await page.getByLabel(COPY.fieldLabel).fill(contract);
  await page.getByRole("button", { name: COPY.submit }).click();
  await expect(page.getByTestId("saved-note")).toBeVisible();
  await expect(page.getByTestId("outside-reference")).toHaveCount(2);
  return page.getByTestId("saved-note").getByRole("link").getAttribute("href");
}

async function addTo(reference, text) {
  await reference.getByTestId("outside-add-open").click();
  await reference.getByTestId("outside-add-text").fill(text);
  await reference.getByTestId("outside-add-submit").click();
  await expect(reference.getByTestId("outside-added")).toBeVisible();
}

const refs = (page) => page.getByTestId("outside-reference");

test("38: a mark carries over when a document is added, and the review comes out Clean", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  const savedPath = await reviewed(page);
  await refs(page).nth(1).getByTestId("outside-mark").click();
  await expect(refs(page).nth(1)).toHaveAttribute("data-reviewed", "yes");
  const statement = await refs(page).nth(1).getByTestId("outside-statement").textContent();
  await addTo(refs(page).nth(0), scheduleB);
  await expect(refs(page).nth(1).getByTestId("outside-statement")).toHaveText(statement);
  await expect(page.getByTestId("clean-result")).toBeVisible();

  await page.goto(savedPath);
  await expect(page.getByTestId("clean-result")).toBeVisible();
  await expect(refs(page).nth(1)).toHaveAttribute("data-reviewed", "yes");
  await context.close();
});

test("41: the question box answers from the added document and labels its source", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  const savedPath = await reviewed(page);
  await addTo(refs(page).nth(0), scheduleB);
  await page.goto(savedPath);
  await page.getByLabel(ASK_COPY.fieldLabel).fill("How fast does the Supplier deliver?");
  await page.getByRole("button", { name: ASK_COPY.submit, exact: true }).click();
  await expect(page.getByTestId("answer-source")).toHaveCount(1);
  await expect(page.getByTestId("answer-source")).toContainText(ASK_COPY.sourceFrom("SCHEDULE B"));
  await expect(page.getByTestId("answer-source")).toContainText("1. The Supplier will deliver within two days of each order.");
  await page.getByLabel(ASK_COPY.fieldLabel).fill("Who pays for insurance?");
  await page.getByRole("button", { name: ASK_COPY.submit, exact: true }).click();
  await expect(page.getByTestId("not-in-document")).toHaveText(ASK_COPY.notInAdded);
  await context.close();
});

test("37: add the wrong document, remove it, add the right one, and reopen", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  const savedPath = await reviewed(page);
  await addTo(refs(page).nth(0), wrong);
  await expect(page.getByTestId("flag-from-referenced")).toHaveCount(1);
  // A second document for the same reference is not offered.
  await expect(refs(page).nth(0).getByTestId("outside-add-open")).toHaveCount(0);
  await refs(page).nth(0).getByTestId("outside-remove").click();
  await expect(refs(page).nth(0).getByTestId("outside-added")).toHaveCount(0);
  await expect(page.getByTestId("flag-from-referenced")).toHaveCount(0);
  await expect(page.getByTestId("withheld")).toHaveCount(0);
  await addTo(refs(page).nth(0), scheduleB);

  await page.goto(savedPath);
  await expect(refs(page).nth(0).getByTestId("outside-added")).toContainText("SCHEDULE B");
  await expect(page.getByTestId("history-row")).toHaveCount(4);
  // The review that had the wrong document reopens with its flag withheld, for the new reason.
  await page.getByTestId("history-row").nth(2).getByTestId("history-date").click();
  await expect(page.getByTestId("withheld")).toContainText(COPY.flags.withheldReason["referenced-document-removed"](1, 1));
  await context.close();
});

test("40: the browser refuses a document that would take the total over the cap, before sending it", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  await reviewed(page);
  let posts = 0;
  page.on("request", (r) => { if (r.url().includes("/api/referenced-documents")) posts += 1; });
  const b = refs(page).nth(0);
  await b.getByTestId("outside-add-open").click();
  const big = `SCHEDULE B\n${"The Supplier will deliver the goods. ".repeat(5400)}`.slice(0, 199_900);
  await b.getByTestId("outside-add-text").fill(big);
  await b.getByTestId("outside-add-submit").click();
  const left = Math.floor((200_000 - contract.length) / 1000) * 1000;
  await expect(b.getByRole("alert")).toHaveText(COPY.outside.tooLongTogether(new Intl.NumberFormat("en-US").format(left)));
  expect(posts).toBe(0);
  await context.close();
});

test("36: a reference inside an added document gets its own document, and marking the rest gives a Clean result", async ({ browser, baseURL }) => {
  const { context, page } = await signedIn(browser, baseURL);
  const savedPath = await reviewed(page);
  await addTo(refs(page).nth(0), nestedB);
  await expect(refs(page)).toHaveCount(3);
  const inner = refs(page).nth(2);
  await expect(inner.getByTestId("outside-in-added")).toHaveText(COPY.outside.inAdded("SCHEDULE B"));
  await expect(inner.getByTestId("source-sentence")).toHaveText("1. The service credits are set out in the Order Form.");
  await expect(page.getByTestId("clean-result")).toHaveCount(0);
  await addTo(inner, orderDetails);
  await expect(refs(page).nth(2).getByTestId("outside-state")).toHaveText(COPY.outside.addedTag);
  await expect(page.getByTestId("flag-from-referenced")).toHaveCount(1);
  await refs(page).nth(1).getByTestId("outside-mark").click();
  await expect(page.getByTestId("clean-result")).toBeVisible();

  await page.goto(savedPath);
  await expect(refs(page)).toHaveCount(3);
  await expect(page.getByTestId("clean-result")).toBeVisible();
  await context.close();
});
