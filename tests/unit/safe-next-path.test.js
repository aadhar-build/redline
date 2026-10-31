// The redirect target after sign-in comes from the request, so it must never leave the site.

import { describe, expect, it } from "vitest";
import { safeNextPath } from "../../lib/supabase/origin.js";

const origin = "http://127.0.0.1:3101";

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
    "evil.com",
    "",
    null,
    undefined,
  ]) {
    it(`never leaves the site for ${JSON.stringify(bad)}`, () => {
      const out = safeNextPath(bad, origin);
      expect(new URL(out, origin).origin).toBe(origin);
      if (bad !== "/%5Cevil.com") expect(out).toBe("/library");
    });
  }

  it("treats an encoded backslash as part of a path on this site", () => {
    expect(safeNextPath("/%5Cevil.com", origin)).toBe("/%5Cevil.com");
  });
});
