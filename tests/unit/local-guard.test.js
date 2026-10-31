import { describe, expect, it } from "vitest";
import { CLI_ADAPTER_NAME } from "../../lib/review/adapters/index.js";
import { FAKE_ADAPTER_NAME } from "../../lib/review/adapters/fake.js";
import { guardModelRun, localRequestRefusal } from "../../lib/review/local-guard.js";

const ENV = { PORT: "3000" };
const cli = { name: CLI_ADAPTER_NAME };
const ok = () => Response.json({ ran: true }, { status: 200 });

function request(headers) {
  const base = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };
  const merged = { ...base, ...headers };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  return new Request("http://localhost:3000/api/review", { method: "POST", headers: merged, body: "{}" });
}

describe("Local-only guard for the Claude Code CLI adapter", () => {
  it("lets a same-origin JSON request to localhost through", () => {
    expect(localRequestRefusal(request({}), ENV)).toBeNull();
    expect(localRequestRefusal(request({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }), ENV)).toBeNull();
    expect(localRequestRefusal(request({ host: "[::1]:3000", origin: "http://[::1]:3000" }), ENV)).toBeNull();
    // Older browsers send no Sec-Fetch-Site; Origin still has to match.
    expect(localRequestRefusal(request({ "sec-fetch-site": undefined }), ENV)).toBeNull();
  });

  it.each([
    ["a foreign Origin (CSRF from another site)", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }],
    ["a foreign Origin without Sec-Fetch-Site", { origin: "https://evil.example", "sec-fetch-site": undefined }],
    ["a missing Origin", { origin: undefined }],
    ["a cross-site Sec-Fetch-Site with a matching Origin", { "sec-fetch-site": "cross-site" }],
    ["a LAN Host", { host: "192.168.1.20:3000", origin: "http://192.168.1.20:3000" }],
    ["a DNS-rebinding Host", { host: "attacker.example:3000", origin: "http://attacker.example:3000" }],
    ["the right host on another port", { host: "localhost:4000", origin: "http://localhost:4000" }],
    ["a host with no port", { host: "localhost", origin: "http://localhost" }],
  ])("refuses %s with 403", (_, headers) => {
    expect(localRequestRefusal(request(headers), ENV)).toEqual({ status: 403, error: "forbidden" });
  });

  it.each([
    ["a form post", "application/x-www-form-urlencoded"],
    ["a multipart form", "multipart/form-data; boundary=x"],
    ["plain text", "text/plain"],
    ["no content type", undefined],
  ])("refuses %s with 415", (_, type) => {
    expect(localRequestRefusal(request({ "content-type": type }), ENV)).toEqual({ status: 415, error: "unsupported-media-type" });
  });

  it("uses the configured port", () => {
    const req = request({ host: "localhost:3109", origin: "http://localhost:3109" });
    expect(localRequestRefusal(req, { PORT: "3109" })).toBeNull();
    expect(localRequestRefusal(req, {})).toEqual({ status: 403, error: "forbidden" });
  });

  it("does not run the handler for a refused request", async () => {
    let ran = false;
    const res = await guardModelRun(request({ origin: "https://evil.example" }), cli, async () => ((ran = true), ok()), ENV);
    expect(res.status).toBe(403);
    expect(ran).toBe(false);
  });

  it("allows one CLI run at a time and answers 429 to a second, then frees the slot", async () => {
    let finish;
    const first = guardModelRun(request({}), cli, () => new Promise((r) => (finish = () => r(ok()))), ENV);
    const second = await guardModelRun(request({}), cli, async () => ok(), ENV);
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "busy" });
    finish();
    expect((await first).status).toBe(200);
    expect((await guardModelRun(request({}), cli, async () => ok(), ENV)).status).toBe(200);
  });

  it("frees the slot when a run throws", async () => {
    await expect(guardModelRun(request({}), cli, async () => { throw new Error("boom"); }, ENV)).rejects.toThrow("boom");
    expect((await guardModelRun(request({}), cli, async () => ok(), ENV)).status).toBe(200);
  });

  it("leaves the fake adapter's behaviour unchanged", async () => {
    const res = await guardModelRun(request({ origin: undefined, host: "anything", "content-type": "text/plain" }), { name: FAKE_ADAPTER_NAME }, async () => ok(), ENV);
    expect(res.status).toBe(200);
  });
});
