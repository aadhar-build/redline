import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { CLI_ADAPTER_NAME } from "./adapters/index.js";

// The guard in front of every route that can reach the Claude Code CLI adapter.
//
// The CLI runs on the product owner's own Claude subscription, for the owner's own use only
// (CLAUDE.md). A local dev server can still be reached by others: a web page the owner visits can
// POST to localhost (CSRF), DNS rebinding can point a foreign name at 127.0.0.1, and `next dev`
// listens on every interface by default, so a device on the LAN can reach it. With the CLI adapter
// selected, a request runs only when all of these hold:
//   - the Host header is localhost, 127.0.0.1 or [::1] on the configured port (PORT, default 3000);
//   - an Origin header is present and is that same origin, and Sec-Fetch-Site, when sent, is
//     "same-origin";
//   - the body is declared as application/json (an HTML form cannot send that without CORS);
//   - it carries this server's run token (RUN_TOKEN_HEADER), a random value made when the server
//     starts and rendered only into the /review page, which another origin cannot read;
//   - no other CLI run is in progress (one at a time; the adapter itself enforces a per-run timeout).
// With the fake adapter or no adapter the guard does nothing, so their behaviour is unchanged.
//
// These checks stop browsers. A non-browser client can forge every header, so the guarantee that
// nothing off this machine reaches the CLI is the loopback binding: the CLI adapter is selected only
// with REDLINE_LOOPBACK_ONLY=1, which `npm run dev:local` sets together with `-H 127.0.0.1`. A Next
// route handler cannot see the client's socket address (x-forwarded-for can be forged), so there is
// no per-request remote-address check here.

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export const RUN_TOKEN_HEADER = "x-redline-run-token";

// One token per server process, shared by the page and every route bundle.
const TOKEN = Symbol.for("redline.cli-run-token");

export function runToken() {
  globalThis[TOKEN] ??= randomBytes(32).toString("hex");
  return globalThis[TOKEN];
}

/** The token to render into the page, or null when the CLI adapter is not the one selected. */
export function runTokenFor(adapter) {
  return adapter?.name === CLI_ADAPTER_NAME ? runToken() : null;
}

function tokenMatches(given) {
  const want = Buffer.from(runToken());
  const got = Buffer.from(String(given ?? ""));
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * @returns {null | { status: number, error: string }} why the request is refused, or null.
 */
export function localRequestRefusal(request, env = process.env) {
  const port = String(env.PORT || "3000");
  const allowedHosts = LOCAL_HOSTNAMES.map((h) => `${h}:${port}`);
  const headers = request.headers;

  const host = (headers.get("host") ?? "").toLowerCase();
  if (!allowedHosts.includes(host)) return { status: 403, error: "forbidden" };

  const origin = (headers.get("origin") ?? "").toLowerCase();
  if (origin !== `http://${host}`) return { status: 403, error: "forbidden" };

  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return { status: 403, error: "forbidden" };

  const type = (headers.get("content-type") ?? "").toLowerCase();
  if (type.split(";")[0].trim() !== "application/json") return { status: 415, error: "unsupported-media-type" };

  if (!tokenMatches(headers.get(RUN_TOKEN_HEADER))) return { status: 403, error: "forbidden" };

  return null;
}

// One CLI run at a time, across every route. Kept on globalThis because each route can be compiled
// into its own bundle with its own copy of this module.
const LOCK = Symbol.for("redline.cli-run-in-progress");

function acquireRun() {
  if (globalThis[LOCK]) return null;
  globalThis[LOCK] = true;
  return () => {
    globalThis[LOCK] = false;
  };
}

/**
 * Runs handler() only if the request passes the guard. Pass-through for any adapter but the CLI one.
 * @param {Request} request
 * @param {{ name: string }} adapter
 * @param {() => Promise<Response>} handler
 */
export async function guardModelRun(request, adapter, handler, env = process.env) {
  if (adapter?.name !== CLI_ADAPTER_NAME) return handler();
  const refused = localRequestRefusal(request, env);
  if (refused) return Response.json({ error: refused.error }, { status: refused.status });
  const release = acquireRun();
  if (!release) return Response.json({ error: "busy" }, { status: 429 });
  try {
    return await handler();
  } finally {
    release();
  }
}
