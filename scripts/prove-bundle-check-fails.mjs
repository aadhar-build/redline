#!/usr/bin/env node
// Proves the client bundle check fails on a real production build with a planted call.
//
// Copies the app to a temporary directory under tmp/, plants two client pages there (never in this repo):
//   1. /planted-adapter imports the fake model adapter, with its "server-only" guard removed;
//   2. /planted-fetch calls the Anthropic API from the browser.
// Runs "next build" on the copy, then the check, and exits 0 only if the check failed and named both
// plants. The copy is deleted afterwards.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The copy lives under the repo's gitignored tmp/ so node_modules resolves by walking up; Turbopack
// rejects a symlinked node_modules outside the project root.
fs.mkdirSync(path.join(repo, "tmp"), { recursive: true });
const tmp = fs.mkdtempSync(path.join(repo, "tmp", "redline-plant-"));

try {
  for (const entry of ["app", "lib", "fixtures", "scripts", "next.config.mjs", "package.json"]) {
    fs.cpSync(path.join(repo, entry), path.join(tmp, entry), { recursive: true });
  }

  const fakePath = path.join(tmp, "lib/review/adapters/fake.js");
  fs.writeFileSync(fakePath, fs.readFileSync(fakePath, "utf8").replace('import "server-only";', ""));

  const plant = (route, src) => {
    fs.mkdirSync(path.join(tmp, "app", route), { recursive: true });
    fs.writeFileSync(path.join(tmp, "app", route, "page.js"), src);
  };
  plant(
    "planted-adapter",
    `"use client";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
export default function P() {
  return <button onClick={() => createFakeAdapter({ responses: [] }).complete("x")}>go</button>;
}
`,
  );
  plant(
    "planted-fetch",
    `"use client";
export default function P() {
  return <button onClick={() => fetch("https://api.anthropic.com/v1/messages", { method: "POST" })}>go</button>;
}
`,
  );

  console.log(`Building the planted copy in ${tmp} ...`);
  execFileSync(path.join(repo, "node_modules/.bin/next"), ["build"], { cwd: tmp, stdio: "inherit" });

  const check = spawnSync(process.execPath, [path.join(repo, "scripts/check-client-bundle.mjs"), path.join(tmp, ".next")], {
    encoding: "utf8",
  });
  process.stdout.write(check.stdout);
  process.stdout.write(check.stderr);

  const named = ["[client] model-adapter", "[client] anthropic-api-host"].every((s) => check.stderr.includes(s));
  if (check.status === 1 && named) {
    console.log("OK: the check failed on the planted build and named both plants.");
  } else {
    console.error(`NOT OK: expected the check to fail naming both plants (exit ${check.status}).`);
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
