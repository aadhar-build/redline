// Red lines in the Reviewer's own words and saved reviews after Red line edits (ticket 15), against the
// LOCAL Supabase stack with the local fake adapter. Each account signs in with its own anon-key session.
// It checks that:
// - a clause seeded for each Red line the Reviewer added is flagged Don't sign as written (PRD 5);
// - a saved review keeps the exact list it was checked against, and is marked as checked against an
//   older list once the Reviewer's list changes, in the library list and on the saved review (OQ17);
// - a re-run reviews the stored text against the current list and saves a new review, keeping the old;
//   a re-run that fails or is incomplete saves nothing and removes nothing;
// - opening and listing never re-run anything, and another account can re-run none of it.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { listDocuments, openSaved, rerunSaved, saveAndReview } from "../../lib/library/library.js";
import { addRedLine, editRedLine, forReview, loadRedLines, removeRedLine } from "../../lib/library/red-lines.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { OWN_RED_LINE_SEEDS, OWN_RED_LINES_DOCUMENT } from "../../fixtures/contracts/own-red-line-seeds.js";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const documentText = read(OWN_RED_LINES_DOCUMENT);

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

type Account = { email: string; password: string; client: SupabaseClient };

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function account(label: string): Promise<Account> {
  const email = `saved-reviews-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  return { email, password, client: await signIn(email, password) };
}

const newSession = (a: Account) => signIn(a.email, a.password);

function countingAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts: string[] = [];
  return { prompts, name: inner.name, complete: (p: string) => (prompts.push(p), inner.complete(p)) };
}

const sameSources = (flag: any, sentences: string[]) =>
  flag.sourceSentences.length === sentences.length && flag.sourceSentences.every((s: any, i: number) => s.text === sentences[i]);

const current = async (db: SupabaseClient) => forReview((await loadRedLines({ db })).redLines);

async function reviewRows(db: SupabaseClient, documentId: string) {
  const { data, error } = await db.from("reviews").select("id, red_lines, created_at").eq("document_id", documentId).order("created_at");
  if (error) throw error;
  return data;
}

// An account with the four defaults plus every own Red line from the seeds, and one saved review.
async function withSavedReview(label: string) {
  const a = await account(label);
  await loadRedLines({ db: a.client });
  for (const s of OWN_RED_LINE_SEEDS) await addRedLine({ db: a.client, text: s.redLine });
  const redLines = await current(a.client);
  const { review, documentId } = await saveAndReview({ db: a.client, text: documentText, redLines, adapter: countingAdapter() });
  expect(documentId).toBeTruthy();
  return { a, review, documentId: documentId as string, redLines };
}

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("Red lines the Reviewer adds (PRD criterion 5)", () => {
  it("flags the clause seeded for each added Red line Don't sign as written, naming that Red line, with the seeded sentences", async () => {
    const { a, review, documentId, redLines } = await withSavedReview("criterion-5");
    const own = redLines.filter((r: any) => r.id.startsWith("own-"));
    expect(own.map((r: any) => r.name)).toEqual(OWN_RED_LINE_SEEDS.map((s) => s.redLine));

    for (const [i, seed] of OWN_RED_LINE_SEEDS.entries()) {
      const flag = review.riskFlags.find((f: any) => sameSources(f, seed.sentences));
      expect(flag, seed.redLine).toBeDefined();
      expect(flag.severity).toBe("dont-sign-as-written");
      expect(flag.redLineMatch).toMatchObject({ id: own[i].id, name: seed.redLine });
    }
    // The invented sentence naming an own Red line is withheld, like any flag.
    expect(review.withheldCount).toBe(1);

    // Reopened in a new session, every match still names the Red line, rebuilt from the stored list.
    const reopened = await openSaved({ db: await newSession(a), documentId });
    for (const seed of OWN_RED_LINE_SEEDS) {
      const flag = reopened!.review!.riskFlags.find((f: any) => sameSources(f, seed.sentences));
      expect(flag).toMatchObject({ severity: "dont-sign-as-written", redLineMatch: { name: seed.redLine } });
    }
  });
});

describe("saved reviews after the Red lines change (OQ17)", () => {
  it("is not marked while the list is unchanged", async () => {
    const { a, documentId } = await withSavedReview("unchanged");
    const db = await newSession(a);
    const list = await listDocuments({ db, currentRedLines: await current(db) });
    expect(list.find((d: any) => d.id === documentId)!.olderRedLines).toBe(false);
    expect((await openSaved({ db, documentId, currentRedLines: await current(db) }))!.olderRedLines).toBe(false);
  });

  it.each([
    ["an added Red line", async (db: SupabaseClient) => addRedLine({ db, text: "A notice period longer than 30 days" })],
    ["a reworded Red line", async (db: SupabaseClient) => {
      const { redLines } = await loadRedLines({ db });
      return editRedLine({ db, rowId: redLines[4].rowId, text: "A customer taking more than 45 days to pay" });
    }],
    ["a removed Default Red line", async (db: SupabaseClient) => {
      const { redLines } = await loadRedLines({ db });
      return removeRedLine({ db, rowId: redLines[0].rowId });
    }],
  ])("after %s, keeps its list and is marked as checked against an older list, without re-running", async (_, change) => {
    const { a, documentId, review } = await withSavedReview(`changed-${randomUUID().slice(0, 4)}`);
    await change(a.client);
    const db = await newSession(a);
    const now = await current(db);

    const list = await listDocuments({ db, currentRedLines: now });
    expect(list.find((d: any) => d.id === documentId)!.olderRedLines).toBe(true);
    const opened = await openSaved({ db, documentId, currentRedLines: now });
    expect(opened!.olderRedLines).toBe(true);
    // The review shown is the saved one, against the list it was checked against.
    expect(opened!.review!.redLinesChecked).toEqual(review.redLinesChecked);
    // Listing and opening called no model and saved nothing new.
    expect(await reviewRows(db, documentId)).toHaveLength(1);
  });

  it("re-runs on request: reviews the stored text against the current list, saves a new review and keeps the old", async () => {
    const { a, documentId, review: first } = await withSavedReview("rerun");
    const { redLines } = await loadRedLines({ db: a.client });
    const removed = redLines.find((r) => r.name === OWN_RED_LINE_SEEDS[0].redLine)!;
    await removeRedLine({ db: a.client, rowId: removed.rowId });

    const db = await newSession(a);
    const now = await current(db);
    const adapter = countingAdapter();
    const rerun = await rerunSaved({ db, documentId, redLines: now, adapter });
    expect(rerun).toMatchObject({ documentId, saved: true });
    expect(adapter.prompts).toHaveLength(1);
    // Reviewed against the current list: the removed Red line is not sent and its clause is no match.
    expect(adapter.prompts[0].split("<document>")[0]).not.toContain(removed.name);
    expect(adapter.prompts[0]).toContain(documentText.trim());
    expect(rerun!.review.redLinesChecked.map((r: any) => r.id)).toEqual(now.map((r: any) => r.id));
    const seeded = rerun!.review.riskFlags.find((f: any) => sameSources(f, OWN_RED_LINE_SEEDS[0].sentences));
    expect(seeded.redLineMatch).toBeNull();

    // Two reviews now: the old one with its old list, the new one with the current list.
    const rows = await reviewRows(db, documentId);
    expect(rows).toHaveLength(2);
    expect(rows[0].red_lines).toEqual(first.redLinesChecked);
    expect(rows[1].red_lines).toEqual(rerun!.review.redLinesChecked);

    // The library opens the new one, unmarked, and still lists the document once.
    const opened = await openSaved({ db, documentId, currentRedLines: now });
    expect(opened!.olderRedLines).toBe(false);
    expect(opened!.review!.redLinesChecked).toEqual(rerun!.review.redLinesChecked);
    const list = await listDocuments({ db, currentRedLines: now });
    expect(list.filter((d: any) => d.id === documentId)).toHaveLength(1);
    expect(list.find((d: any) => d.id === documentId)!.olderRedLines).toBe(false);
  });

  it("an incomplete re-run saves nothing and keeps the document and its review", async () => {
    const { a, documentId, redLines } = await withSavedReview("rerun-incomplete");
    const adapter = createFakeAdapter({ responses: [JSON.stringify({ summary: "A summary." })] });
    const rerun = await rerunSaved({ db: a.client, documentId, redLines, adapter });
    expect(rerun).toMatchObject({ documentId, saved: false });
    expect(await reviewRows(a.client, documentId)).toHaveLength(1);
    expect(await openSaved({ db: a.client, documentId })).not.toBeNull();
  });

  it("a re-run whose model call fails saves nothing and keeps the document and its review", async () => {
    const { a, documentId, redLines } = await withSavedReview("rerun-throws");
    const adapter = createFakeAdapter({ responses: [] });
    await expect(rerunSaved({ db: a.client, documentId, redLines, adapter })).rejects.toThrow();
    expect(await reviewRows(a.client, documentId)).toHaveLength(1);
    expect(await openSaved({ db: a.client, documentId })).not.toBeNull();
  });

  it("marks a review stored with a list in an older shape, and never throws on it", async () => {
    const { a, documentId } = await withSavedReview("legacy");
    const db = await newSession(a);
    const doc = await db.from("documents").select("id").eq("id", documentId).single();
    const legacy = await db.from("reviews").insert({
      document_id: doc.data!.id,
      red_lines: [{ text: "An old Red line", default_number: 1 }],
      summary: "A summary.",
      flags: [],
    });
    expect(legacy.error).toBeNull();
    const now = await current(db);
    expect((await openSaved({ db, documentId, currentRedLines: now }))!.olderRedLines).toBe(true);
  });
});

describe("a second account", () => {
  it("cannot re-run, open or see the marker of the first account's saved review", async () => {
    const { a, documentId } = await withSavedReview("iso-a");
    const b = await account("iso-b");
    const bList = await current(b.client);
    const adapter = countingAdapter();

    expect(await rerunSaved({ db: b.client, documentId, redLines: bList, adapter })).toBeNull();
    expect(adapter.prompts).toHaveLength(0);
    expect(await openSaved({ db: b.client, documentId, currentRedLines: bList })).toBeNull();
    expect((await listDocuments({ db: b.client, currentRedLines: bList })).some((d: any) => d.id === documentId)).toBe(false);

    // Directly: B gets no rows of A's reviews and cannot add one to A's document.
    const direct = await b.client.from("reviews").select("id").eq("document_id", documentId);
    expect(direct.data).toEqual([]);
    const planted = await b.client.from("reviews").insert({ document_id: documentId, red_lines: [], summary: "B's", flags: [] });
    expect(planted.error).not.toBeNull();
    expect(await reviewRows(a.client, documentId)).toHaveLength(1);
  });
});
