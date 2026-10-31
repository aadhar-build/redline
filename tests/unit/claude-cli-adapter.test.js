import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { CLI_ADAPTER_NAME, CLI_MODEL, createCliAdapter } from "../../lib/review/adapters/claude-cli.mjs";
import { getModelAdapter } from "../../lib/review/adapters/index.js";

// A stand-in for child_process.spawn. It records each call and answers like the CLI would, so these
// tests never start the Claude Code CLI.
function fakeSpawn({ stdout = "", code = 0 } = {}) {
  const calls = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    const call = { command, args, options, stdin: "" };
    calls.push(call);
    child.stdin.on("data", (d) => (call.stdin += d));
    child.stdin.on("finish", () => {
      child.stdout.end(stdout);
      child.stderr.end("account details the adapter must drop");
      setImmediate(() => child.emit("close", code));
    });
    return child;
  };
  return { spawn, calls };
}

const envelope = (fields) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: "s-123", usage: {}, ...fields });

describe("Claude Code CLI adapter", () => {
  it("refuses to run when VERCEL is set, and never starts the CLI", async () => {
    const { spawn, calls } = fakeSpawn({ stdout: envelope({ result: "{}" }) });
    const adapter = createCliAdapter({ env: { VERCEL: "1", PATH: "/usr/bin" }, spawn });
    await expect(adapter.complete("prompt")).rejects.toMatchObject({ code: "refused" });
    expect(calls).toHaveLength(0);
  });

  it("is never selected on Vercel, whatever REDLINE_MODEL_ADAPTER says", () => {
    expect(getModelAdapter({ VERCEL: "1", REDLINE_MODEL_ADAPTER: "cli" })).toBeNull();
  });

  it("is selected locally only with REDLINE_MODEL_ADAPTER=cli", () => {
    expect(getModelAdapter({ REDLINE_MODEL_ADAPTER: "cli" })?.name).toBe(CLI_ADAPTER_NAME);
    expect(getModelAdapter({})).toBeNull();
  });

  it("sends the prompt on stdin with tools off, and returns only the model's reply", async () => {
    const { spawn, calls } = fakeSpawn({ stdout: envelope({ result: '{"summary": "x"}' }) });
    const adapter = createCliAdapter({ env: { PATH: "/usr/bin", HOME: "/home/o" }, spawn });
    const reply = await adapter.complete("the contract prompt");

    expect(reply).toBe('{"summary": "x"}');
    expect(calls).toHaveLength(1);
    const [{ command, args, stdin, options }] = calls;
    expect(command).toBe("claude");
    expect(stdin).toBe("the contract prompt");
    expect(args).not.toContain("the contract prompt");
    expect(args).toEqual(expect.arrayContaining(["-p", "--no-session-persistence", "--safe-mode", "--strict-mcp-config"]));
    expect(args[args.indexOf("--model") + 1]).toBe(CLI_MODEL);
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args).not.toContain("--bare");
    expect(options.cwd).not.toBe(process.cwd());
  });

  it("hands the CLI no keys or tokens from the server's environment", async () => {
    const { spawn, calls } = fakeSpawn({ stdout: envelope({ result: "ok" }) });
    const env = {
      PATH: "/usr/bin",
      HOME: "/home/o",
      ANTHROPIC_API_KEY: "planted-api-key",
      CLAUDE_CODE_OAUTH_TOKEN: "planted-oauth-token",
      SUPABASE_SECRET_KEY: "planted-supabase-key",
      REDLINE_MODEL_ADAPTER: "cli",
    };
    await createCliAdapter({ env, spawn }).complete("p");
    expect(calls[0].options.env).toEqual({ PATH: "/usr/bin", HOME: "/home/o" });
  });

  it.each([
    ["the CLI reports an error", { stdout: envelope({ is_error: true, subtype: "error", result: "x" }) }, "cli-error"],
    ["the CLI exits non-zero", { stdout: "", code: 1 }, "exit"],
    ["the CLI output is not JSON", { stdout: "not json" }, "bad-envelope"],
  ])("throws when %s", async (_, answer, code) => {
    const { spawn } = fakeSpawn(answer);
    await expect(createCliAdapter({ env: { PATH: "/usr/bin" }, spawn }).complete("p")).rejects.toMatchObject({ code });
  });
});
