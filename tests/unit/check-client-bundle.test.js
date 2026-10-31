import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBuild } from "../../scripts/check-client-bundle.mjs";

const dirs = [];
function fakeBuild(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redline-check-"));
  dirs.push(dir);
  for (const [rel, src] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), src);
  }
  return dir;
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const harmless = 'function spawnDynamicRequests(){};fetch("/api/review",{method:"POST"});';
const rules = (dir) => checkBuild(dir).findings.map((f) => `${f.side}:${f.rule}`);

describe("Client bundle check", () => {
  it("passes a build whose client code only posts to the server route", () => {
    const dir = fakeBuild({
      "static/chunks/a.js": harmless,
      "server/app/page.js": 'const name="redline-model-adapter:fake";',
    });
    expect(rules(dir)).toEqual([]);
  });

  it.each([
    ["child-process", 'require("child_process")'],
    ["process-spawn", 'r.spawn("node",[])'],
    ["process-spawn", "execFileSync(cmd)"],
    ["model-adapter", 'name:"redline-model-adapter:fake"'],
    ["review-module", '"redline-review:server: no model adapter configured"'],
    ["review-prompt", '"You are summarising a contract for the person"'],
    ["anthropic-api-host", 'fetch("https://api.anthropic.com/v1/messages")'],
    ["anthropic-sdk", 'from "@anthropic-ai/sdk"'],
    ["claude-cli-call", 'x("claude", ["-p", prompt])'],
    ["fake-scripted-reply-1", '"Kesari Cleaning Services will clean Tulsi Tiffin House\'s kitchen"'],
  ])("fails when %s is planted in a client bundle", (rule, planted) => {
    const dir = fakeBuild({ "static/chunks/a.js": harmless, "static/chunks/b.js": planted });
    expect(rules(dir)).toContain(`client:${rule}`);
  });

  it("fails when server output calls Claude", () => {
    const dir = fakeBuild({
      "static/chunks/a.js": harmless,
      "server/chunks/x.js": 'spawn("claude", ["-p", prompt])',
    });
    expect(rules(dir)).toEqual(["server:claude-cli-call"]);
  });

  it("refuses to pass when there is no build to check", () => {
    const dir = fakeBuild({ "server/x.js": "" });
    expect(() => checkBuild(dir)).toThrow(/next build/);
  });
});
