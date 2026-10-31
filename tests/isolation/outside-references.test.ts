// Outside references on saved reviews (ticket 13), against the LOCAL Supabase stack with the local fake
// adapter. Each account signs in with its own anon-key session. It checks that:
// - a saved review keeps its Outside references, and the Reviewer's "reviewed" mark is saved as their
//   statement, with when they made it, and read back in a new session;
// - marking every Statement of Work, web address and Order Form reference reviewed makes the rule give
//   a Clean result (held back by the gate until ticket 07), and an "as amended" reference never does;
// - another account can neither read nor change the references or marks, in the database itself;
// - the database refuses an entry of any other shape, so no prose is stored with a reference.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { markOutsideReference, openSaved, saveAndReview } from "../../lib/library/library.js";
import { forReview, loadRedLines } from "../../lib/library/red-lines.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { cleanResultOf } from "../../lib/review/review.js";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const doc1 = read("fixtures/contracts/outside-references-01.txt");
const doc2 = read("fixtures/contracts/outside-references-02.txt");

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
  const email = `outside-refs-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  return { email, password, client: await signIn(email, password) };
}

async function saved(a: Account, text: string) {
  const redLines = forReview((await loadRedLines({ db: a.client })).redLines);
  const { review, documentId } = await saveAndReview({ db: a.client, text, redLines, adapter: createLocalFakeAdapter({ root }) });
  expect(documentId).toBeTruthy();
  return { review, documentId: documentId as string };
}

const sentenceOf = (r: any) => r.sourceSentences[0].text;

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("Outside references on a saved review", () => {
  it("saves each reference unmarked, then saves the Reviewer's mark as their statement", async () => {
    const a = await account("owner");
    const { review, documentId } = await saved(a, doc1);
    expect(review.outsideReferences.map((r: any) => r.kinds[0])).toEqual(["statement-of-work", "web-address", "order-form", "schedule"]);

    const { data: rows } = await a.client.from("reviews").select("outside_references").eq("document_id", documentId);
    expect(rows![0].outside_references).toHaveLength(4);
    expect(rows![0].outside_references.every((o: any) => o.reviewed === false && o.reviewed_at === null)).toBe(true);

    const first = sentenceOf(review.outsideReferences[0]);
    const now = new Date("2026-10-31T09:30:00.000Z");
    const marked = await markOutsideReference({ db: a.client, documentId, sourceSentence: first, reviewed: true, now });
    expect(marked!.review.outsideReferences[0].reviewed).toEqual({ at: now.toISOString() });

    // Read back in a new session.
    const opened = await openSaved({ db: await signIn(a.email, a.password), documentId });
    const refs = opened!.review!.outsideReferences;
    expect(refs[0].reviewed).toEqual({ at: now.toISOString() });
    expect(refs.slice(1).every((r: any) => r.reviewed === null)).toBe(true);
    expect(cleanResultOf(opened!.review)).toBe(false);

    // Every reference marked: the rule gives a Clean result, which the gate still holds back.
    let last: any = null;
    for (const r of refs.slice(1)) {
      last = await markOutsideReference({ db: a.client, documentId, sourceSentence: sentenceOf(r), reviewed: true });
    }
    expect(cleanResultOf(last.review)).toBe(true);
    expect(last.review.cleanResult).toBeNull();
    expect(last.review.cleanResultHeld).toBe(true);

    // Taking a mark back is saved too.
    const undone = await markOutsideReference({ db: a.client, documentId, sourceSentence: first, reviewed: false });
    expect(undone!.review.outsideReferences[0].reviewed).toBeNull();
    expect(cleanResultOf((await openSaved({ db: a.client, documentId }))!.review)).toBe(false);

    // A sentence the review has no reference for changes nothing.
    expect(await markOutsideReference({ db: a.client, documentId, sourceSentence: "Not a reference.", reviewed: true })).toBeNull();
  });

  it('never gives a Clean result with an "as amended" reference, even with every reference marked', async () => {
    const a = await account("amended");
    const { review, documentId } = await saved(a, doc2);
    let last: any = null;
    for (const r of review.outsideReferences) {
      last = await markOutsideReference({ db: a.client, documentId, sourceSentence: sentenceOf(r), reviewed: true });
    }
    expect(last.review.outsideReferences.every((r: any) => r.reviewed !== null)).toBe(true);
    expect(last.review.outsideReferences.find((r: any) => r.kinds.includes("as-amended")).severity).toBe("dont-sign-as-written");
    expect(cleanResultOf(last.review)).toBe(false);
  });

  it("lets no other account read or change the references or marks", async () => {
    const a = await account("a");
    const b = await account("b");
    const { review, documentId } = await saved(a, doc1);
    const sentence = sentenceOf(review.outsideReferences[0]);

    expect(await markOutsideReference({ db: b.client, documentId, sourceSentence: sentence, reviewed: true })).toBeNull();
    expect(await openSaved({ db: b.client, documentId })).toBeNull();

    const { data: seen } = await b.client.from("reviews").select("outside_references").eq("document_id", documentId);
    expect(seen).toEqual([]);
    // A direct update with B's session reaches no row.
    const forged = [{ kinds: ["statement-of-work"], source_sentence: sentence, reviewed: true, reviewed_at: "2026-10-31T00:00:00.000Z" }];
    const upd = await b.client.from("reviews").update({ outside_references: forged }).eq("document_id", documentId).select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);

    const { data: still } = await admin.from("reviews").select("outside_references").eq("document_id", documentId);
    expect(still![0].outside_references.every((o: any) => o.reviewed === false)).toBe(true);
  });

  it.each([
    ["model prose in an entry", { kinds: ["order-form"], source_sentence: "x", reviewed: false, reviewed_at: null, says: "anything" }],
    ["an unknown kind", { kinds: ["master-agreement"], source_sentence: "x", reviewed: false, reviewed_at: null }],
    ["no kinds", { kinds: [], source_sentence: "x", reviewed: false, reviewed_at: null }],
    ["an empty sentence", { kinds: ["order-form"], source_sentence: " ", reviewed: false, reviewed_at: null }],
    ["reviewed with no time", { kinds: ["order-form"], source_sentence: "x", reviewed: true, reviewed_at: null }],
    ["a time with no mark", { kinds: ["order-form"], source_sentence: "x", reviewed: false, reviewed_at: "2026-10-31T00:00:00.000Z" }],
    ["a mark that is not true or false", { kinds: ["order-form"], source_sentence: "x", reviewed: "yes", reviewed_at: null }],
  ])("refuses %s", async (_, entry) => {
    const a = await account(`shape-${randomUUID().slice(0, 4)}`);
    const { documentId } = await saved(a, doc1);
    const upd = await a.client.from("reviews").update({ outside_references: [entry] }).eq("document_id", documentId).select("id");
    expect(upd.error?.code).toBe("23514");
  });
});
