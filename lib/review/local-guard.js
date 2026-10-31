import "server-only";

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
//   - no other CLI run is in progress (one at a time; the adapter itself enforces a per-run timeout).
// With the fake adapter or no adapter the guard does nothing, so their behaviour is unchanged.
// Start the server with `npm run dev:local`, which binds to 127.0.0.1 only.

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

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
