// Connection details for the LOCAL Supabase stack started by `supabase start`.
// Keys are read at runtime from the environment, then .env.local, then
// `supabase status -o env`. None are written into the repo.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const root = resolve(__dirname, "../..");

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function fromStatus(): Record<string, string> {
  const raw = parseEnv(
    execFileSync("supabase", ["status", "-o", "env"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  return {
    SUPABASE_URL: raw.API_URL,
    SUPABASE_ANON_KEY: raw.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: raw.SERVICE_ROLE_KEY,
  };
}

function loadConfig() {
  const envFile = resolve(root, ".env.local");
  const file = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const pick = (k: string) => process.env[k] || file[k];
  let url = pick("SUPABASE_URL");
  let anonKey = pick("SUPABASE_ANON_KEY");
  let serviceKey = pick("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    const s = fromStatus();
    url ||= s.SUPABASE_URL;
    anonKey ||= s.SUPABASE_ANON_KEY;
    serviceKey ||= s.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Local Supabase is not running. Run `supabase start` first.");
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Isolation tests run only against a local stack, not ${host}.`);
  }
  return { url, anonKey, serviceKey };
}

export const config = loadConfig();

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient(): SupabaseClient {
  return createClient(config.url, config.anonKey, noSession);
}

export function adminClient(): SupabaseClient {
  return createClient(config.url, config.serviceKey, noSession);
}

/** Runs SQL as postgres inside the local database container. */
export function psql(sql: string): string {
  const projectId = readFileSync(resolve(root, "supabase/config.toml"), "utf8").match(
    /^project_id\s*=\s*"([^"]+)"/m,
  )?.[1];
  return execFileSync(
    "docker",
    ["exec", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres", "-tA", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}
