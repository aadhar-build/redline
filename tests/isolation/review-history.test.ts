// Change on a saved document and earlier reviews (ticket 24 part 2, rulings 23 and 24), against the LOCAL
// Supabase stack with the local fake adapter. Each account signs in with its own anon-key session.
// It checks that:
// - Change re-runs the same document: two Changes leave one documents row and three reviews rows;
// - each review stores owner_party, owner_fixed and judgments_dropped, and a reopened review shows them;
// - the earlier reviews are listed newest first and open read-only by id, through the same reopen path;
// - another account can neither re-run, open, read nor write any of it.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { openSaved, rerunSaved, saveAndReview } from "../../lib/library/library.js";
import { forReview, loadRedLines, addRedLine } from "../../lib/library/red-lines.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { OWN_RED_LINES_DOCUMENT } from "../../fixtures/contracts/own-red-line-seeds.js";

const root = path.resolve(__dirname, "../..");
const documentText = fs.readFileSync(path.join(root, OWN_RED_LINES_DOCUMENT), "utf8");

const admin = adminClient();
const runId = randomUUID().slice(0, 8);
const created: string[] = [];

async function account(label: string): Promise<SupabaseClient> {
  const email = `review-history-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

function countingAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts: string[] = [];
  return { prompts, name: inner.name, complete: (p: string) => (prompts.push(p), inner.complete(p)) };
}

const current = async (db: SupabaseClient) => forReview((await loadRedLines({ db })).redLines);

async function saved(label: string) {
  const db = await account(label);
  const redLines = await current(db);
  const { documentId } = await saveAndReview({ db, text: documentText, redLines, adapter: countingAdapter() });
  expect(documentId).toBeTruthy();
  return { db, documentId: documentId as string, redLines };
}

const rows = async (db: SupabaseClient, table: string) => {
  const { data, error } = await db.from(table).select("*");
  if (error) throw error;
  return data;
};

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("Change on a saved document (ruling 23)", () => {
  it("re-runs the same document: two Changes leave one documents row and three reviews rows", async () => {
    const { db, documentId, redLines } = await saved("change");
    const first = await rerunSaved({ db, documentId, redLines, adapter: countingAdapter(), ownerParty: "Supplier" });
    expect(first).toMatchObject({ documentId, saved: true });
    expect(first!.review.ownerParty).toEqual({ term: "Supplier", fixed: true });
    const second = await rerunSaved({ db, documentId, redLines, adapter: countingAdapter(), ownerParty: "Buyer" });
    expect(second).toMatchObject({ documentId, saved: true });

    expect(await rows(db, "documents")).toHaveLength(1);
    const reviews = await db.from("reviews").select("owner_party, owner_fixed, judgments_dropped, created_at").eq("document_id", documentId).order("created_at");
    expect(reviews.data).toHaveLength(3);
    expect(reviews.data![1]).toMatchObject({ owner_party: "Supplier", owner_fixed: true, judgments_dropped: 0 });
    expect(reviews.data![2]).toMatchObject({ owner_party: "Buyer", owner_fixed: true });

    // The reopened latest review says whose side it was for.
    const opened = await openSaved({ db, documentId, currentRedLines: redLines });
    expect(opened!.review.ownerParty).toEqual({ term: "Buyer", fixed: true });
    expect(opened!.latest).toBe(true);
  });

  it("refuses a party the document does not name and saves nothing", async () => {
    const { db, documentId, redLines } = await saved("bad-party");
    await expect(rerunSaved({ db, documentId, redLines, adapter: countingAdapter(), ownerParty: "Zebra Holdings" })).rejects.toThrow();
    expect(await rows(db, "reviews")).toHaveLength(1);
  });

  it("shows the stored dropped-judgment count on reopen, added to any dropped again", async () => {
    const { db, documentId, redLines } = await saved("dropped");
    const updated = await db.from("reviews").update({ judgments_dropped: 2 }).eq("document_id", documentId).select("id");
    expect(updated.data).toHaveLength(1);
    expect((await openSaved({ db, documentId, currentRedLines: redLines }))!.review.judgmentsDropped).toBe(2);
    // The database refuses a negative count.
    const negative = await db.from("reviews").update({ judgments_dropped: -1 }).eq("document_id", documentId).select("id");
    expect(negative.error).not.toBeNull();
  });
});

describe("earlier reviews (ruling 24)", () => {
  it("lists reviews newest first and opens the older one read-only by id, with the older-list tag", async () => {
    const { db, documentId, redLines } = await saved("history");
    // Change the Red lines, then re-run, so the first review was checked against an older list.
    await addRedLine({ db, text: "No exclusivity that stops us selling to anyone else." });
    const now = await current(db);
    const adapter = countingAdapter();
    const rerun = await rerunSaved({ db, documentId, redLines: now, adapter });
    expect(rerun!.saved).toBe(true);
    const calls = adapter.prompts.length;

    const latest = await openSaved({ db, documentId, currentRedLines: now });
    expect(latest!.history).toHaveLength(2);
    expect(latest!.history.map((h: any) => h.latest)).toEqual([true, false]);
    expect(latest!.history[0].reviewedAt >= latest!.history[1].reviewedAt).toBe(true);
    expect(latest!.history.map((h: any) => h.olderRedLines)).toEqual([false, true]);

    const older = await openSaved({ db, documentId, currentRedLines: now, reviewId: latest!.history[1].id });
    expect(older!.reviewId).toBe(latest!.history[1].id);
    expect(older!.latest).toBe(false);
    expect(older!.olderRedLines).toBe(true);
    expect(older!.review.redLinesChecked.map((r: any) => r.id)).toEqual(redLines.map((r: any) => r.id));
    // Opening never calls the model.
    expect(adapter.prompts.length).toBe(calls);
  });

  it("does not open a review of another document, or an id that is not a review", async () => {
    const a = await saved("two-docs");
    const second = await saveAndReview({ db: a.db, text: documentText, redLines: a.redLines, adapter: countingAdapter() });
    const other = await openSaved({ db: a.db, documentId: second.documentId });
    expect(await openSaved({ db: a.db, documentId: a.documentId, reviewId: other!.reviewId })).toBeNull();
    expect(await openSaved({ db: a.db, documentId: a.documentId, reviewId: randomUUID() })).toBeNull();
    expect(await openSaved({ db: a.db, documentId: a.documentId, reviewId: "not-a-uuid" })).toBeNull();
  });
});

describe("a second account", () => {
  it("can't Change, open, read or write the first account's reviews or their new columns", async () => {
    const a = await saved("iso-a");
    await rerunSaved({ db: a.db, documentId: a.documentId, redLines: a.redLines, adapter: countingAdapter(), ownerParty: "Supplier" });
    const aReviews = await a.db.from("reviews").select("id").eq("document_id", a.documentId);
    const reviewId = aReviews.data![0].id;

    const b = await account("iso-b");
    const bList = await current(b);
    const adapter = countingAdapter();
    expect(await rerunSaved({ db: b, documentId: a.documentId, redLines: bList, adapter, ownerParty: "Buyer" })).toBeNull();
    expect(adapter.prompts).toHaveLength(0);
    expect(await openSaved({ db: b, documentId: a.documentId, reviewId })).toBeNull();

    const read = await b.from("reviews").select("owner_party, owner_fixed, judgments_dropped").eq("id", reviewId);
    expect(read.data).toEqual([]);
    const write = await b.from("reviews").update({ owner_party: "Buyer", owner_fixed: false, judgments_dropped: 9 }).eq("id", reviewId).select("id");
    expect(write.data ?? []).toEqual([]);
    const planted = await b.from("reviews").insert({ document_id: a.documentId, red_lines: [], summary: "B's", flags: [], owner_party: "Buyer" });
    expect(planted.error).not.toBeNull();

    const after = await a.db.from("reviews").select("owner_party, owner_fixed, judgments_dropped").eq("id", reviewId).single();
    expect(after.data).toMatchObject({ judgments_dropped: 0 });
    expect(after.data!.owner_party).not.toBe("Buyer");
    expect(await a.db.from("reviews").select("id").eq("document_id", a.documentId).then((r) => r.data)).toHaveLength(2);
  });
});
