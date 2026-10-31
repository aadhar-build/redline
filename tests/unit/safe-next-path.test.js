// The redirect target after sign-in comes from the request, so it must never leave the site.

import { describe, expect, it } from "vitest";
import { safeNextPath, safeRedirectUrl } from "../../lib/supabase/origin.js";

const origin = "http://127.0.0.1:3101";
// Percent-encoded separators stay inside the path; they never change the host.
const ENCODED = ["/%5Cevil.com", "/%2F/evil.com"];

describe("safeNextPath", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeNextPath("/library?x=1", origin)).toBe("/library?x=1");
    expect(safeNextPath("/library/abc#flags", origin)).toBe("/library/abc#flags");
  });

  for (const bad of [
    "/\\evil.com",
    "//evil.com",
    "/%5Cevil.com",
    "https://evil.com",
    "/\tevil.com",
    "/\nevil.com",
    "/\\/evil.com",
    "\\\\evil.com",
    "/.//evil.com",
    "/a/..//evil.com",
    "/./\\evil.com",
    "/%2F/evil.com",
    "/..//evil.com",
    "/././/evil.com",
    "evil.com",
    "",
    null,
    undefined,
  ]) {
    it(`never leaves the site for ${JSON.stringify(bad)}`, () => {
      const out = safeNextPath(bad, origin);
      expect(new URL(out, origin).origin).toBe(origin);
      expect(out.startsWith("//")).toBe(false);
      expect(safeRedirectUrl(bad, origin).origin).toBe(origin);
      if (!ENCODED.includes(bad)) expect(out).toBe("/library");
    });
  }

  it("treats an encoded slash or backslash as part of a path on this site", () => {
    for (const p of ENCODED) expect(safeNextPath(p, origin)).toBe(p);
  });

  it("builds a full URL on this origin", () => {
    expect(safeRedirectUrl("/library?x=1", origin).href).toBe(`${origin}/library?x=1`);
  });
});
