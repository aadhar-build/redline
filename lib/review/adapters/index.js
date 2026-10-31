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

// The fixtures the local fake adapter has scripted replies for. A reply is the summary file and the
// Risk flags file joined into one JSON object, the shape Review asks the model for.
const SCRIPTS = [
  {
    // Its scripted Risk flags include altered and invented Source sentences, which must be withheld.
    document: "fixtures/contracts/vendor-agreement-01.txt",
    summary: "fixtures/model-output/vendor-agreement-01.summary.json",
    riskFlags: "fixtures/model-output/vendor-agreement-01.risk-flags.json",
    // Scripted replies for the question box, one per question (ticket 04).
    questions: "fixtures/questions/vendor-agreement-01.json",
  },
  {
    // Its scripted summary and Risk flag break the hedge-word ban on purpose, to exercise marking.
    document: "fixtures/contracts/marked-wording-01.txt",
    summary: "fixtures/model-output/marked-wording-01.summary.json",
    riskFlags: "fixtures/model-output/marked-wording-01.risk-flags.json",
  },
];

function loadScripts(root) {
  const read = (file) => fs.readFileSync(path.join(/*turbopackIgnore: true*/ root, file), "utf8");
  return SCRIPTS.map((s) => {
    const { summary } = JSON.parse(read(s.summary));
    const { riskFlags } = JSON.parse(read(s.riskFlags));
    return {
      document: normalise(read(s.document)),
      reply: JSON.stringify({ summary, riskFlags }),
      questions: s.questions ? JSON.parse(read(s.questions)).questions : [],
    };
  });
}

// The question in a question-box prompt (lib/review/ask.js puts it last, inside <question> tags).
const QUESTION = /<question>\n([\s\S]*)\n<\/question>\s*$/;

function noScript(message) {
  const err = new FakeAdapterError(message);
  err.code = "no-script";
  return err;
}

// Replies only for a pasted fixture. For any other text it refuses, so it can never put a scripted
// summary next to a document it was not written for. A question it has no script for is refused too,
// never answered with a default reply.
export function createLocalFakeAdapter({ root = process.cwd() } = {}) {
  const scripts = loadScripts(root);
  return {
    name: FAKE_ADAPTER_NAME,
    async complete(prompt) {
      const p = normalise(prompt);
      const script = scripts.find((s) => p.includes(s.document));
      if (!script) throw noScript("no scripted reply for this document");
      const asked = String(prompt).match(QUESTION);
      if (asked) {
        const entry = script.questions.find((q) => normalise(q.question) === normalise(asked[1]));
        if (!entry) throw noScript("no scripted reply for this question");
        return typeof entry.reply === "string" ? entry.reply : JSON.stringify(entry.reply);
      }
      return script.reply;
    },
  };
}
