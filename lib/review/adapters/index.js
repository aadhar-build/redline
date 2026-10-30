import "server-only";

import fs from "node:fs";
import path from "node:path";
import { FAKE_ADAPTER_NAME, FakeAdapterError } from "./fake.js";
import { normalise } from "../normalise.js";

// Picks the model adapter for this server, or none.
//
// REDLINE_MODEL_ADAPTER=fake turns on the scripted fake adapter for local runs and tests. Any other
// value, or no value, means no adapter: analysis is unavailable. On Vercel there is never an adapter,
// whatever the environment says, because nothing deployed calls Claude (CLAUDE.md) and scripted
// output on a deployed page would pass for a real review. The real Claude Code CLI adapter is ticket 09.

export function getModelAdapter(env = process.env) {
  if (env.VERCEL) return null;
  if (env.REDLINE_MODEL_ADAPTER === "fake") return createLocalFakeAdapter();
  return null;
}

export function isAnalysisAvailable(env = process.env) {
  return getModelAdapter(env) !== null;
}

// The fixtures the local fake adapter has scripted replies for.
const SCRIPTS = [
  {
    document: "fixtures/contracts/vendor-agreement-01.txt",
    summary: "fixtures/model-output/vendor-agreement-01.summary.json",
  },
];

function loadScripts(root) {
  return SCRIPTS.map((s) => ({
    document: normalise(fs.readFileSync(path.join(root, s.document), "utf8")),
    reply: fs.readFileSync(path.join(root, s.summary), "utf8"),
  }));
}

// Replies only for a pasted fixture. For any other text it refuses, so it can never put a scripted
// summary next to a document it was not written for.
export function createLocalFakeAdapter({ root = process.cwd() } = {}) {
  const scripts = loadScripts(root);
  return {
    name: FAKE_ADAPTER_NAME,
    async complete(prompt) {
      const p = normalise(prompt);
      const script = scripts.find((s) => p.includes(s.document));
      if (!script) {
        const err = new FakeAdapterError("no scripted reply for this document");
        err.code = "no-script";
        throw err;
      }
      return script.reply;
    },
  };
}
