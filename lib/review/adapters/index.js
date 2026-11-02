import "server-only";

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FAKE_ADAPTER_NAME, FakeAdapterError } from "./fake.js";
import { normalise } from "../normalise.js";

// Picks the model adapter for this server, or none.
//
// REDLINE_MODEL_ADAPTER=fake turns on the scripted fake adapter for local runs and tests.
// REDLINE_MODEL_ADAPTER=cli turns on the Claude Code CLI adapter, on the product owner's machine only
// (ticket 09). Any other value, or no value, means no adapter: analysis is unavailable. On Vercel there
// is never an adapter, whatever the environment says, because nothing deployed calls Claude
// (CLAUDE.md) and scripted output on a deployed page would pass for a real review.

export function getModelAdapter(env = process.env) {
  if (env.VERCEL) return null;
  if (env.REDLINE_MODEL_ADAPTER === "fake") return createLocalFakeAdapter();
  // The CLI adapter also needs REDLINE_LOOPBACK_ONLY=1, which `npm run dev:local` sets together with
  // binding the server to 127.0.0.1. Without it the server may be listening on the LAN, so no CLI.
  if (env.REDLINE_MODEL_ADAPTER === "cli") return env.REDLINE_LOOPBACK_ONLY === "1" ? createLocalCliAdapter({ env }) : null;
  return null;
}

// The CLI adapter lives in claude-cli.mjs and is loaded from disk at call time, with the bundler told
// to ignore the import, so no code that calls Claude is compiled into the build or deployed (see that
// file). The name is repeated here so reporting it does not load the module.
export const CLI_ADAPTER_NAME = "redline-model-adapter:claude-cli";

export function createLocalCliAdapter({ env = process.env, root = process.cwd() } = {}) {
  let adapter = null;
  return {
    name: CLI_ADAPTER_NAME,
    async complete(prompt) {
      if (!adapter) {
        const file = path.join(/*turbopackIgnore: true*/ root, "lib/review/adapters/claude-cli.mjs");
        const href = pathToFileURL(file).href;
        const { createCliAdapter } = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ /* @vite-ignore */ href);
        adapter = createCliAdapter({ env });
      }
      return adapter.complete(prompt);
    },
  };
}

export function isAnalysisAvailable(env = process.env) {
  return getModelAdapter(env) !== null;
}

// The fixtures the local fake adapter has scripted replies for. A reply is the summary file and the
// Risk flags file joined into one JSON object, the shape Review asks the model for.
const SCRIPTS = [
  // QUESTIONS.md 36, 37, 38 and 41: referenced-02 with the documents added to it, the most added first,
  // so a script is picked only when the prompt carries every text it was written for.
  ...[
    [["referenced-02.schedule-b-nested", "referenced-02.order-details"], "with-nested-order-details"],
    [["referenced-02.schedule-b"], "with-schedule-b"],
    [["referenced-02.wrong"], "with-wrong"],
    [["referenced-02.schedule-b-nested"], "with-nested"],
  ].map(([referenced, combined]) => ({
    document: "fixtures/contracts/referenced-02.txt",
    referenced: referenced.map((r) => `fixtures/contracts/${r}.txt`),
    combined: `fixtures/model-output/referenced-02.${combined}.json`,
  })),
  // Ticket 18: outside-references-01 reviewed together with the Schedule B it refers to. Listed first,
  // so it is picked only when the prompt carries both texts; one flag cites Schedule B's own sentence.
  {
    document: "fixtures/contracts/outside-references-01.txt",
    referenced: "fixtures/contracts/outside-references-01.schedule-b.txt",
    combined: "fixtures/model-output/outside-references-01.with-schedule-b.json",
  },
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
  // A clause seeded for every Default Red line, one fixture per contract type (ticket 06). Their scripts
  // name the Red line each clause matches, some at a lower Severity than Don't sign as written.
  // Ticket 22: a form with blanks, scripted with a number the document lacks, a judgment that claims
  // what is typical, and the Owner's side.
  // Ticket 13: no Risk flags from the model, and Outside references only Redline's patterns find.
  // Ticket 07: clauses written to support two readings, scripted as Ambiguous clauses; and a contract
  // whose only flag is one Ambiguous clause, which must not be a Clean result.
  ...["vendor-agreement-02", "vendor-agreement-03", "commercial-lease-01", "client-agreement-01", "licence-form-01", "clean-agreement-01", "ambiguous-clauses-01", "ambiguous-clause-only-01", "outside-references-01", "outside-references-02", "referenced-02", "stamp-page-01"].map((name) => ({
    document: `fixtures/contracts/${name}.txt`,
    summary: `fixtures/model-output/${name}.summary.json`,
    riskFlags: `fixtures/model-output/${name}.risk-flags.json`,
  })),
  // Tickets 08 and 17: scripted Counter-offer breaches (a "may", a number the document lacks, a new
  // term) and a flag with no Counter-offer at all.
  {
    document: "fixtures/contracts/counter-offers-01.txt",
    summary: "fixtures/model-output/counter-offers-01.summary.json",
    riskFlags: "fixtures/model-output/counter-offers-01.risk-flags.json",
  },
  // A clause seeded for each of several Red lines in the Reviewer's own words (ticket 15). Its script
  // names each Red line by its wording, resolved against the prompt (see ownWordsResolved).
  {
    document: "fixtures/contracts/own-red-lines-01.txt",
    summary: "fixtures/model-output/own-red-lines-01.summary.json",
    riskFlags: "fixtures/model-output/own-red-lines-01.risk-flags.json",
  },
];

function loadScripts(root) {
  const read = (file) => fs.readFileSync(path.join(/*turbopackIgnore: true*/ root, file), "utf8");
  return SCRIPTS.map((s) => {
    if (s.combined) {
      const { summary, riskFlags, ownerParty, parties, questions } = JSON.parse(read(s.combined));
      const referenced = (Array.isArray(s.referenced) ? s.referenced : [s.referenced]).map((r) => normalise(read(r)));
      return { document: normalise(read(s.document)), referenced, summary, riskFlags, ownerParty, parties, questions: questions ?? [] };
    }
    const { summary } = JSON.parse(read(s.summary));
    // ownerParty and parties are scripted only where a fixture needs them (ticket 22).
    const { riskFlags, ownerParty, parties } = JSON.parse(read(s.riskFlags));
    return {
      document: normalise(read(s.document)),
      summary,
      riskFlags,
      ownerParty,
      parties,
      questions: s.questions ? JSON.parse(read(s.questions)).questions : [],
    };
  });
}

// A Red line in the Reviewer's own words has an id ("own-<row id>") that only exists once it is stored,
// so a script names it by its wording instead ("redLineWords"). Like a model reading the list, the fake
// looks for that wording on a line of the prompt's instructions (before <document>, since the contract
// can hold the same words) and answers with the id quoted on that line. Wording that is not on the list
// is no match. This relies only on the prompt listing each Red line on one line with its id and wording.
function ownWordsResolved(riskFlags, prompt) {
  const lines = String(prompt).split("<document>")[0].split("\n").map(normalise);
  return riskFlags.map((f) => {
    if (!f || typeof f.redLineWords !== "string") return f;
    const { redLineWords, ...flag } = f;
    const line = lines.find((l) => l.includes(normalise(redLineWords)));
    return { ...flag, redLine: line?.match(/id "([^"]+)"/)?.[1] ?? null };
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
      const script = scripts.find((s) => p.includes(s.document) && (!s.referenced || s.referenced.every((r) => p.includes(r))));
      if (!script) throw noScript("no scripted reply for this document");
      const asked = String(prompt).match(QUESTION);
      if (asked) {
        const entry = script.questions.find((q) => normalise(q.question) === normalise(asked[1]));
        if (!entry) throw noScript("no scripted reply for this question");
        return typeof entry.reply === "string" ? entry.reply : JSON.stringify(entry.reply);
      }
      return JSON.stringify({
        ownerParty: script.ownerParty,
        parties: script.parties,
        summary: script.summary,
        riskFlags: ownWordsResolved(script.riskFlags, prompt),
      });
    },
  };
}
