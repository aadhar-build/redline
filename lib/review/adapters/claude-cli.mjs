// The Claude Code CLI model adapter (ticket 09). Local runs on the product owner's machine only.
//
// It carries Review's prompt to the unmodified Claude Code CLI already installed and signed in on this
// machine, and returns the model's raw reply. It has the same shape as every adapter:
// { name, complete(prompt) => Promise<string> }.
//
// Why this file is plain Node and not part of the Next build: nothing deployed may call Claude
// (CLAUDE.md, PRD criterion 16). lib/review/adapters/index.js loads this module at run time from disk,
// with the bundler told to ignore the import, so it is never compiled into .next/ and never shipped to
// Vercel or the browser. scripts/check-client-bundle.mjs fails the build if a Claude CLI call ever
// shows up in .next/server or .next/static, which is what would happen if this file were imported
// statically. For the same reason it cannot import "server-only" (that marker only resolves inside
// Next), so it guards itself: it refuses to run on Vercel or in a browser.
//
// Credentials: this module never reads, copies, stores, logs or passes on any Claude credential,
// config or session token. The CLI finds its own sign-in. The child gets a short allowlist of
// environment variables (no API keys, no Supabase keys), runs in an empty temporary directory with
// tools, MCP servers, slash commands, settings files and customisations switched off, and keeps no
// session on disk. Only the reply text is returned; the CLI's envelope (session id, usage) and stderr
// are dropped, never logged.

import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CLI_ADAPTER_NAME = "redline-model-adapter:claude-cli";

// OQ20, decided 2026-10-31 (ticket 09): Sonnet 5.5.
export const CLI_MODEL = "claude-sonnet-5-5";

export const CLI_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

// The only environment variables the CLI child sees.
const ENV_ALLOWLIST = ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR", "SHELL", "TERM"];

export class CliAdapterError extends Error {
  constructor(code, message) {
    super(`${CLI_ADAPTER_NAME}: ${message}`);
    this.name = "CliAdapterError";
    this.code = code;
  }
}

export function refusalReason(env = process.env) {
  if (env.VERCEL) return "the Claude Code CLI adapter never runs on Vercel";
  if (typeof window !== "undefined") return "the Claude Code CLI adapter never runs in a browser";
  return null;
}

// The server must have been started bound to 127.0.0.1 (`npm run dev:local` sets this flag with
// `-H 127.0.0.1`), so nothing on the LAN can reach a route that runs the CLI.
export function loopbackRefusal(env = process.env) {
  if (env.REDLINE_LOOPBACK_ONLY !== "1") return "the Claude Code CLI adapter runs only with REDLINE_LOOPBACK_ONLY=1 (npm run dev:local)";
  return null;
}

function childEnv(env) {
  const out = {};
  for (const key of ENV_ALLOWLIST) if (typeof env[key] === "string") out[key] = env[key];
  return out;
}

/**
 * @param {{ env?: Record<string, string | undefined>, spawn?: typeof nodeSpawn, timeoutMs?: number }} [options]
 *   spawn is injectable so tests can prove the CLI is never started where it must not be.
 */
export function createCliAdapter({ env = process.env, spawn = nodeSpawn, timeoutMs = CLI_TIMEOUT_MS } = {}) {
  return {
    name: CLI_ADAPTER_NAME,
    async complete(prompt) {
      // Checked on every call, against both the given environment and this process's own.
      const refused = refusalReason(env) ?? refusalReason(process.env) ?? loopbackRefusal(env);
      if (refused) throw new CliAdapterError("refused", refused);
      if (typeof prompt !== "string" || prompt.length === 0) throw new CliAdapterError("bad-prompt", "empty prompt");

      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "redline-cli-"));
      try {
        const stdout = await run(spawn, prompt, { cwd, env: childEnv(env), timeoutMs });
        return readEnvelope(stdout);
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

function run(spawn, prompt, { cwd, env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    // The prompt goes on stdin, not the command line, so contract text never shows in a process list.
    const child = spawn("claude", [
      "-p",
      "--model", CLI_MODEL,
      "--tools", "",
      "--output-format", "json",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--safe-mode",
      "--setting-sources", "",
    ], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });

    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new CliAdapterError("timeout", "the Claude Code CLI did not answer in time"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new CliAdapterError("too-much-output", "the Claude Code CLI reply was too large"));
        return;
      }
      chunks.push(chunk);
    });
    // stderr is drained and dropped: it can hold account or session details.
    child.stderr.on("data", () => {});
    child.on("error", (err) =>
      finish(new CliAdapterError(err?.code === "ENOENT" ? "not-installed" : "spawn-failed", "could not start the Claude Code CLI")),
    );
    child.on("close", (code) => {
      if (code !== 0) finish(new CliAdapterError("exit", `the Claude Code CLI exited with code ${code}`));
      else finish(null, Buffer.concat(chunks).toString("utf8"));
    });

    child.stdin.on("error", () => {});
    child.stdin.end(prompt, "utf8");
  });
}

// With --output-format json the CLI prints one JSON envelope; the model's reply is its "result".
function readEnvelope(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new CliAdapterError("bad-envelope", "the Claude Code CLI output was not JSON");
  }
  if (!envelope || envelope.is_error || envelope.subtype !== "success" || typeof envelope.result !== "string") {
    throw new CliAdapterError("cli-error", "the Claude Code CLI reported an error");
  }
  return envelope.result;
}
