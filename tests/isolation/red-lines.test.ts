// The Reviewer's Red lines against the LOCAL Supabase stack (ticket 12). Each account signs in with its
// own anon-key session, as the server routes do. It checks that:
// - the four Default Red lines are saved to the account on first use, once only;
// - adding, editing and removing persist across sessions, and a removed default stays removed;
// - a review after removing a Default Red line does not mark its seeded clause as a Red line match
//   (PRD criterion 4), and a review keeps the exact list it was checked against;
// - another account sees, changes and removes none of them (PRD criterion 15).

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient } from "./local-supabase";
import { openSaved, saveAndReview } from "../../lib/library/library.js";
import { addRedLine, editRedLine, forReview, loadRedLines, removeRedLine } from "../../lib/library/red-lines.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { RED_LINE_SEEDS } from "../../fixtures/contracts/red-line-seeds.js";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

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
  const email = `red-lines-${label}-${runId}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  return { email, password, client: await signIn(email, password) };
}

// A new session for the same account, as after signing out and in again.
const newSession = (a: Account) => signIn(a.email, a.password);

function spyAdapter() {
  const inner = createLocalFakeAdapter({ root });
  const prompts: string[] = [];
  return {
    prompts,
    async complete(prompt: string) {
      prompts.push(prompt);
      return inner.complete(prompt);
    },
  };
}

const sameSources = (flag: any, sentences: string[]) =>
  flag.sourceSentences.length === sentences.length && flag.sourceSentences.every((s: any, i: number) => s.text === sentences[i]);

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("first use", () => {
  it("saves the four Default Red lines to the account, each with its basis", async () => {
    const a = await account("seed");
    const { redLines, removedDefaults } = await loadRedLines({ db: a.client });
    expect(redLines.map((r) => r.id)).toEqual(DEFAULT_RED_LINES.map((r) => r.id));
    expect(redLines.map((r) => r.basis?.label)).toEqual(DEFAULT_RED_LINES.map((r) => r.basis.label));
    expect(removedDefaults).toEqual([]);

    const rows = await a.client.from("red_lines").select("text, default_number").order("default_number");
    expect(rows.data).toEqual(DEFAULT_RED_LINES.map((r, i) => ({ text: r.name, default_number: i + 1 })));
    const settings = await a.client.from("account_settings").select("red_lines_seeded_at, udyam_micro_or_small").single();
    expect(settings.data!.red_lines_seeded_at).toBeTruthy();
    expect(settings.data!.udyam_micro_or_small).toBeNull();
  });

  it("seeds once, even when two requests arrive together", async () => {
    const a = await account("race");
    await Promise.all([loadRedLines({ db: a.client }), loadRedLines({ db: a.client }), loadRedLines({ db: await newSession(a) })]);
    await loadRedLines({ db: a.client });
    const { count } = await a.client.from("red_lines").select("id", { count: "exact", head: true });
    expect(count).toBe(4);
  });

  it("keeps the Udyam answer when it marks the account seeded", async () => {
    const a = await account("udyam");
    await a.client.from("account_settings").insert({ udyam_micro_or_small: true });
    await loadRedLines({ db: a.client });
    const settings = await a.client.from("account_settings").select("red_lines_seeded_at, udyam_micro_or_small").single();
    expect(settings.data).toMatchObject({ udyam_micro_or_small: true });
    expect(settings.data!.red_lines_seeded_at).toBeTruthy();
  });
});

describe("editing the list", () => {
  it("adds, rewords and removes, and every change is there in a new session", async () => {
    const a = await account("edit");
    const first = await loadRedLines({ db: a.client });
    const guarantee = first.redLines[0];
    const fees = first.redLines[2];

    await addRedLine({ db: a.client, text: "  Payment later than\n30 days after invoice. " });
    await editRedLine({ db: a.client, rowId: guarantee.rowId, text: "Any personal guarantee from an owner or director" });
    await removeRedLine({ db: a.client, rowId: fees.rowId });

    const later = await loadRedLines({ db: await newSession(a) });
    expect(later.redLines.map((r) => [r.id.startsWith("own-") ? "own" : r.id, r.name, r.edited])).toEqual([
      ["default-personal-guarantee", "Any personal guarantee from an owner or director", true],
      ["default-auto-renewal-or-long-term", DEFAULT_RED_LINES[1].name, false],
      ["default-uncapped-liability", DEFAULT_RED_LINES[3].name, false],
      ["own", "Payment later than 30 days after invoice", false],
    ]);
    expect(later.redLines[0]).toMatchObject({ catches: null, basis: null });
    expect(later.removedDefaults).toEqual([3]);
  });

  it("a removed Default Red line stays removed, and removing all four leaves the list empty", async () => {
    const a = await account("remove-all");
    const { redLines } = await loadRedLines({ db: a.client });
    for (const r of redLines) await removeRedLine({ db: a.client, rowId: r.rowId });
    const later = await loadRedLines({ db: await newSession(a) });
    expect(later.redLines).toEqual([]);
    expect(later.removedDefaults).toEqual([1, 2, 3, 4]);
  });

  it("refuses empty and over-long wording, here and in the database", async () => {
    const a = await account("bad-text");
    const { redLines } = await loadRedLines({ db: a.client });
    await expect(addRedLine({ db: a.client, text: "   " })).rejects.toMatchObject({ code: "empty-red-line" });
    await expect(editRedLine({ db: a.client, rowId: redLines[0].rowId, text: "x".repeat(301) })).rejects.toMatchObject({
      code: "red-line-too-long",
    });
    const direct = await a.client.from("red_lines").insert({ text: "x".repeat(501) }).select("id");
    expect(direct.error?.code).toBe("23514");
  });
});

describe("reviews against the stored list", () => {
  const { document, seeds } = RED_LINE_SEEDS.find((s: any) => s.document.endsWith("vendor-agreement-02.txt"))!;
  const documentText = read(document);

  it.each(DEFAULT_RED_LINES.map((r, i) => [i + 1, r.id]))(
    "after Default Red line %i is removed, its seeded clause is not a Red line match in the next review",
    async (n, id) => {
      const a = await account(`criterion-4-${n}`);
      const before = await loadRedLines({ db: a.client });
      await removeRedLine({ db: a.client, rowId: before.redLines[(n as number) - 1].rowId });

      const { redLines } = await loadRedLines({ db: await newSession(a) });
      const adapter = spyAdapter();
      const { review, documentId } = await saveAndReview({ db: a.client, text: documentText, redLines: forReview(redLines), adapter });
      expect(documentId).toBeTruthy();

      expect(adapter.prompts[0].split("<document>")[0]).not.toContain(`"${id}"`);
      expect(review.redLinesChecked.map((r: any) => r.id)).toEqual(DEFAULT_RED_LINES.map((r) => r.id).filter((x) => x !== id));
      for (const seed of seeds) {
        const flag = review.riskFlags.find((f: any) => sameSources(f, seed.sentences));
        if (seed.redLine === id) expect(flag.redLineMatch, seed.sentences[0]).toBeNull();
        else expect(flag.redLineMatch?.id, seed.sentences[0]).toBe(seed.redLine);
      }
    },
  );

  it("sends a Red line in the Reviewer's own words with the document, and the review keeps the list it was checked against", async () => {
    const a = await account("own-words");
    await loadRedLines({ db: a.client });
    const { redLines } = await addRedLine({ db: a.client, text: "Card fees that rise without a signed change" });
    const own = redLines.find((r) => r.id.startsWith("own-"))!;

    const adapter = spyAdapter();
    const { review, documentId } = await saveAndReview({ db: a.client, text: documentText, redLines: forReview(redLines), adapter });
    expect(adapter.prompts[0].split("<document>")[0]).toContain(`id "${own.id}": Card fees that rise without a signed change.`);
    const checkedThen = review.redLinesChecked;
    expect(checkedThen.map((r: any) => r.name)).toContain("Card fees that rise without a signed change");

    // Change the list after the review: the saved review still shows the list it was checked against.
    await removeRedLine({ db: a.client, rowId: redLines[0].rowId });
    await editRedLine({ db: a.client, rowId: own.rowId, text: "Something else entirely" });
    const reopened = await openSaved({ db: await newSession(a), documentId });
    expect(reopened!.review!.redLinesChecked).toEqual(checkedThen);
    const stored = await a.client.from("reviews").select("red_lines").eq("document_id", documentId).single();
    expect(stored.data!.red_lines).toEqual(checkedThen);
  });
});

describe("a second account", () => {
  it("sees, changes and removes none of the first account's Red lines", async () => {
    const a = await account("iso-a");
    const b = await account("iso-b");
    const aList = await loadRedLines({ db: a.client });
    await addRedLine({ db: a.client, text: "A's own Red line" });
    const aRows = (await a.client.from("red_lines").select("id, text")).data!;
    expect(aRows).toHaveLength(5);

    // B's own list is its own four defaults, none of A's rows.
    const bList = await loadRedLines({ db: b.client });
    expect(bList.redLines).toHaveLength(4);
    const aIds = new Set(aRows.map((r) => r.id));
    expect(bList.redLines.some((r) => aIds.has(r.rowId))).toBe(false);

    // Directly, B gets no rows of A's Red lines or settings.
    for (const row of aRows) {
      const direct = await b.client.from("red_lines").select("*").eq("id", row.id);
      expect(direct.error).toBeNull();
      expect(direct.data).toEqual([]);
    }
    // B's own settings row only, though both accounts have been seeded.
    const bSettings = await b.client.from("account_settings").select("red_lines_seeded_at");
    expect(bSettings.data).toHaveLength(1);

    // Through the module, B's edits and removals of A's rows find nothing.
    expect(await editRedLine({ db: b.client, rowId: aList.redLines[0].rowId, text: "Changed by B" })).toBeNull();
    expect(await removeRedLine({ db: b.client, rowId: aList.redLines[1].rowId })).toBeNull();
    const after = (await a.client.from("red_lines").select("id, text")).data!;
    expect(after).toEqual(expect.arrayContaining(aRows));
    expect(after).toHaveLength(5);
  });
});
