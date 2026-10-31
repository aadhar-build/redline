import "server-only";

import { DEFAULT_RED_LINES } from "../review/red-lines.js";

// The Reviewer's own Red lines (ticket 12), stored per account in the red_lines table.
//
// The list starts as the four Default Red lines, saved to the account the first time it is read, once
// only: account_settings.red_lines_seeded_at records that it happened, so a Default Red line the
// Reviewer removes stays removed (ADR 0004). The Reviewer can then add, edit and remove any of them,
// and the next review is checked against the list as it stands.
//
// Every function takes `db`, a Supabase client signed in as the Reviewer with the public anon key. Row
// Level Security decides which rows it sees; nothing here filters by owner, and nothing here uses the
// service-role key.
//
// How a stored row becomes a Red line for Review:
// - A Default Red line keeps its stable id (red-lines.js), edited or not, so a match never depends on
//   its wording. Unedited, it carries the default's catches and basis. Once the Reviewer rewords it, it
//   is their words alone: the default's catches would contradict them, and the basis was gathered for
//   the original wording (QUESTIONS.md, ticket 12).
// - A Red line the Reviewer adds gets the id "own-<row id>" and is sent to the model in their words.

// Limits settled by Fable advisor, 2026-10-31. The database enforces the 300 characters too
// (migration 20261031001210). The 30 per account is enforced only by addRedLine: a Reviewer writing
// rows straight to the database with their own session can go past it. That only lengthens their own
// review prompt, so a longer list still loads and is still reviewed in full.
export const MAX_RED_LINE_LENGTH = 300;
export const MAX_RED_LINES = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RedLineError extends Error {
  constructor(code, message) {
    super(`redline-red-lines: ${message}`);
    this.name = "RedLineError";
    this.code = code;
  }
}

/** Whitespace collapsed to single spaces, trimmed, and any trailing full stops removed. Never throws. */
export function normaliseRedLineText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
}

/**
 * The Reviewer's wording as one line: whitespace collapsed, and no trailing full stop, because Review
 * adds its own after the name. Throws a RedLineError for empty or over-long text.
 */
export function cleanRedLineText(text) {
  const line = normaliseRedLineText(text);
  if (line.length === 0) throw new RedLineError("empty-red-line", "the Red line is empty");
  if (line.length > MAX_RED_LINE_LENGTH) throw new RedLineError("red-line-too-long", "the Red line is too long");
  return line;
}

/** One stored row as the Red line Review takes and the editor shows. */
export function redLineFromRow(row) {
  const n = row.default_number;
  const base = DEFAULT_RED_LINES[n - 1];
  if (base) {
    // Compared after normalising, so a trailing space or full stop is not a rewording.
    const edited = normaliseRedLineText(row.text) !== normaliseRedLineText(base.name);
    return {
      id: base.id,
      rowId: row.id,
      defaultNumber: n,
      edited,
      name: edited ? row.text : base.name,
      catches: edited ? null : base.catches,
      basis: edited ? null : { ...base.basis },
    };
  }
  return { id: `own-${row.id}`, rowId: row.id, defaultNumber: null, edited: false, name: row.text, catches: null, basis: null };
}

// Defaults in their ADR 0004 order, then the Reviewer's own in the order they were added.
function inOrder(rows) {
  return [...rows].sort((a, b) => {
    const da = a.default_number ?? Infinity;
    const db = b.default_number ?? Infinity;
    if (da !== db) return da - db;
    return a.created_at === b.created_at ? String(a.id).localeCompare(String(b.id)) : a.created_at.localeCompare(b.created_at);
  });
}

async function ensureSeeded(db) {
  const settings = await db.from("account_settings").select("red_lines_seeded_at").maybeSingle();
  if (settings.error) throw new RedLineError("load-failed", settings.error.message);
  if (settings.data?.red_lines_seeded_at) return;

  const seeded = await db
    .from("red_lines")
    .insert(DEFAULT_RED_LINES.map((r, i) => ({ text: r.name, default_number: i + 1 })));
  // 23505: another request seeded this account a moment ago. Its rows stand.
  if (seeded.error && seeded.error.code !== "23505") throw new RedLineError("save-failed", seeded.error.message);

  const marked = await db
    .from("account_settings")
    .upsert({ red_lines_seeded_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (marked.error) throw new RedLineError("save-failed", marked.error.message);
}

/**
 * The account's Red lines, seeding the four defaults on first use.
 * @returns {Promise<{ redLines: object[], removedDefaults: number[] }>}
 *   removedDefaults: the numbers of Default Red lines the Reviewer has removed.
 */
export async function loadRedLines({ db }) {
  await ensureSeeded(db);
  const { data, error } = await db.from("red_lines").select("id, text, default_number, created_at");
  if (error) throw new RedLineError("load-failed", error.message);
  const redLines = inOrder(data).map(redLineFromRow);
  const kept = new Set(redLines.map((r) => r.defaultNumber).filter(Boolean));
  const removedDefaults = DEFAULT_RED_LINES.map((_, i) => i + 1).filter((n) => !kept.has(n));
  return { redLines, removedDefaults };
}

/** The list as Review takes it: only what Review reads. */
export function forReview(redLines) {
  return redLines.map(({ id, name, catches, basis }) => ({ id, name, catches, basis }));
}

// What the model was told about one Red line: its id, name and what it catches, trimmed. Anything not
// shaped like a Red line, such as a row stored before ticket 06, becomes a value no real one equals.
function checkedAs(r) {
  if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.name !== "string") return "unreadable";
  const catches = typeof r.catches === "string" && r.catches.trim() ? r.catches.trim() : null;
  return JSON.stringify([r.id.trim(), r.name.trim(), catches]);
}

/**
 * Whether a saved review was checked against the same Red line list as the Reviewer's current one
 * (OQ17). Order counts, because a Red line's number comes from its place in the list. The basis does
 * not: it is shown with a Red line, never sent to the model. Never throws on a stored list of any shape.
 * @param {unknown} stored a reviews.red_lines value
 * @param {{ id: string, name: string, catches?: string | null }[]} current the list forReview returns
 */
export function sameRedLineList(stored, current) {
  if (!Array.isArray(stored) || !Array.isArray(current) || stored.length !== current.length) return false;
  return stored.every((r, i) => checkedAs(r) !== "unreadable" && checkedAs(r) === checkedAs(current[i]));
}

export async function addRedLine({ db, text }) {
  const line = cleanRedLineText(text);
  const { redLines } = await loadRedLines({ db });
  if (redLines.length >= MAX_RED_LINES) throw new RedLineError("too-many-red-lines", "the list is full");
  const { error } = await db.from("red_lines").insert({ text: line });
  if (error) throw new RedLineError("save-failed", error.message);
  return loadRedLines({ db });
}

/** Rewords one Red line. Null when the row is not this account's. */
export async function editRedLine({ db, rowId, text }) {
  const line = cleanRedLineText(text);
  if (typeof rowId !== "string" || !UUID.test(rowId)) return null;
  const { data, error } = await db.from("red_lines").update({ text: line }).eq("id", rowId).select("id");
  if (error) throw new RedLineError("save-failed", error.message);
  if (data.length === 0) return null;
  return loadRedLines({ db });
}

/** Removes one Red line, a Default Red line included. Null when the row is not this account's. */
export async function removeRedLine({ db, rowId }) {
  if (typeof rowId !== "string" || !UUID.test(rowId)) return null;
  const { data, error } = await db.from("red_lines").delete().eq("id", rowId).select("id");
  if (error) throw new RedLineError("save-failed", error.message);
  if (data.length === 0) return null;
  return loadRedLines({ db });
}
