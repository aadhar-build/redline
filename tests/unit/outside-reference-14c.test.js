// Ticket 14c: "for the time being in force" (bug 3) and government verification addresses (bug 2).
// Made-up strings only.
import { describe, expect, it } from "vitest";
import { cleanResultOf, review } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { DEFAULT_RED_LINES } from "../../lib/review/red-lines.js";
import { findOutsideReferences, isVerificationAddress, ONE_SIDED_CHANGES_ID } from "../../lib/review/outside-references.js";

async function withNoFlags(documentText) {
  const reply = JSON.stringify({ summary: "A summary.", riskFlags: [] });
  return review({ documentText, redLines: DEFAULT_RED_LINES, adapter: createFakeAdapter({ responses: [reply] }) });
}
const kindsOf = (text) => findOutsideReferences(text).found.map((f) => f.kinds);

describe("Bug 3: for the time being in force", () => {
  it.each([
    "1. The Lender may recover dues under the Recovery of Debts Act, 1993 for the time being in force.",
    "2. Each party will follow the Registration Act 1908, for the time being in force.",
  ])("after an Act with its year it is Negotiate, not a Red line 3 match: %s", async (text) => {
    expect(kindsOf(text)).toEqual([["other"]]);
    const r = await withNoFlags(text);
    expect(r.outsideReferences.map((o) => [o.severity, o.redLineMatch])).toEqual([["negotiate", null]]);
    expect(cleanResultOf(r)).toBe(false);
  });

  it("a Counterparty's rules for the time being in force match Red line 3", async () => {
    const text = "3. The Customer will follow the rules for the time being in force of the Provider.";
    const { found } = findOutsideReferences(text);
    expect(found.map((f) => f.kinds)).toEqual([["as-amended"]]);
    expect(found[0].labels).toEqual(["for the time being in force"]);
    const r = await withNoFlags(text);
    expect(r.outsideReferences.map((o) => o.severity)).toEqual(["dont-sign-as-written"]);
    expect(r.outsideReferences[0].redLineMatch).toMatchObject({ id: ONE_SIDED_CHANGES_ID });
  });

  it("an Act without a year is not exempt (fail closed)", () => {
    expect(kindsOf("4. The Customer will follow the Shops Act for the time being in force.")).toEqual([["as-amended"]]);
  });
});

describe("Bug 2: government e-stamp and registration verification addresses", () => {
  it.each([
    "www.shcilestamp.com",
    "WWW.SHCILESTAMP.COM",
    "https://www.shcilestamp.com/eStampIndia/verify",
    "shcilestamp.com",
    "igrs.telangana.gov.in",
    "https://igrsup.gov.in/igrsup/",
    "egras.raj.nic.in",
    "https://egrashry.nic.in",
  ])("is not an Outside reference: %s", async (address) => {
    expect(isVerificationAddress(address)).toBe(true);
    const text = `Certificate No. IN-XX1234. The authenticity of this certificate may be verified at ${address} only.`;
    expect(kindsOf(text)).toEqual([]);
  });

  it.each([
    "www.shcilestamp.com.example.net",
    "shcilestamp.co",
    "fake-shcilestamp.com",
    "igrs.example.com",
    "egras.state.gov.in.example.org",
    "www.igrs-verify.in",
    "provider.gov.in",
    "www.example.com",
    "https://shcilestamp.com@evil.com/verify",
    "evil.com\\shcilestamp.com",
    "shcilestamp.com.evil.com",
  ])("still flags any other address: %s", (address) => {
    expect(isVerificationAddress(address)).toBe(false);
    const text = `The Customer will follow the terms at ${address} at all times.`;
    expect(kindsOf(text)).toEqual([["web-address"]]);
  });

  it("never treats a domain in the query or path as the host", () => {
    expect(isVerificationAddress("https://evil.com/?next=shcilestamp.com")).toBe(false);
    expect(isVerificationAddress("https://evil.com#shcilestamp.com")).toBe(false);
    expect(isVerificationAddress("shcilestamp.com@evil.com")).toBe(false);
    expect(isVerificationAddress("https://www.shcilestamp.com/verify?ref=evil.com")).toBe(false);
    expect(isVerificationAddress("https://www.shcilestamp.com/eStampIndia/verify?no=IN-XX1234")).toBe(true);
  });

  it("a domain inside an allowlisted URL's path or query is still raised", () => {
    for (const url of ["https://www.shcilestamp.com/provider-terms.com", "https://www.shcilestamp.com/verify?terms=provider-terms.com"]) {
      const { found } = findOutsideReferences(`The Customer will follow the terms at ${url} at all times.`);
      // The whole address is raised, so the Reviewer sees the domain it carries.
      expect(found.map((f) => f.kinds), url).toEqual([["web-address"]]);
      expect(found[0].labels[0], url).toContain("provider-terms.com");
    }
  });

  it("an allowlisted address does not hide another address in the same sentence", () => {
    const text = "Verify at www.shcilestamp.com and follow the terms at www.example.com at all times.";
    const { found } = findOutsideReferences(text);
    expect(found.map((f) => f.kinds)).toEqual([["web-address"]]);
    expect(found[0].labels).toEqual(["www.example.com"]);
  });
});
