import { describe, expect, it } from "vitest";
import { BANNED_PHRASES, findBannedWording } from "../../lib/review/wording.js";

const phrases = (text, documentText) => findBannedWording(text, { documentText }).map((h) => h.phrase);

describe("Hedge-word and verdict-word check", () => {
  it("bans exactly the words in PRD criterion 8", () => {
    expect([...BANNED_PHRASES]).toEqual([
      "may",
      "could potentially",
      "consider consulting a lawyer",
      "safe",
      "fine",
      "good to sign",
    ]);
  });

  it("finds each banned word or phrase, in any case", () => {
    expect(phrases("Customer MAY pay more.")).toEqual(["may"]);
    expect(phrases("This could potentially cost you.")).toEqual(["could potentially"]);
    expect(phrases("Consider consulting a lawyer before signing.")).toEqual(["consider consulting a lawyer"]);
    expect(phrases("The cap is Safe.")).toEqual(["safe"]);
    expect(phrases("The notice period is fine.")).toEqual(["fine"]);
    expect(phrases("It is Good To Sign.")).toEqual(["good to sign"]);
  });

  it("matches phrases across line breaks and runs of spaces", () => {
    expect(phrases("This could\n  potentially cost you.")).toEqual(["could potentially"]);
  });

  it("matches whole words only", () => {
    expect(phrases("The mayor's office, safety rules, a defined term and the finest print.")).toEqual([]);
    expect(phrases("Mayday. Unsafe. Refined. Fines.")).toEqual([]);
  });

  it("returns hits in text order with their positions", () => {
    const hits = findBannedWording("It is fine. You may sign.");
    expect(hits).toEqual([
      { phrase: "fine", match: "fine", index: 6 },
      { phrase: "may", match: "may", index: 16 },
    ]);
  });

  it("finds nothing in clean text", () => {
    expect(phrases("Customer pays Rs. 18,000 a month plus GST.")).toEqual([]);
  });
});

describe("Exclusion of text reproduced word for word from the document", () => {
  const documentText =
    "3. Fees. Customer will pay Vendor Rs. 18,000 per month, plus GST. Vendor may increase the monthly fee by up to 10% at each renewal.";

  it("excuses a hit inside a quoted span found in the document", () => {
    expect(phrases('Clause 3 says "Vendor may increase the monthly fee" at renewal.', documentText)).toEqual([]);
  });

  it("excuses a hit inside curly quotes, after normalising whitespace and quote marks", () => {
    expect(phrases("Clause 3 says \u201CVendor  may\u00A0increase the monthly fee\u201D at renewal.", documentText)).toEqual(
      [],
    );
  });

  it("excuses a hit in a sentence reproduced whole from the document", () => {
    expect(phrases("Vendor may increase the monthly fee by up to 10% at each renewal.", documentText)).toEqual([]);
  });

  it("still flags the word when the document contains it but the summary uses it in its own words", () => {
    expect(phrases("The Vendor may raise prices whenever it likes.", documentText)).toEqual(["may"]);
  });

  it("still flags a quote that is altered from the document", () => {
    expect(phrases('Clause 3 says "Vendor may increase the fee by up to 20%".', documentText)).toEqual(["may"]);
  });

  it("does not excuse a bare quoted word", () => {
    expect(phrases('The clause uses the word "may".', documentText)).toEqual(["may"]);
  });

  it("flags the unquoted hit even when another hit in the same text is excused", () => {
    expect(
      phrases('Clause 3 says "Vendor may increase the monthly fee". The rest is fine.', documentText),
    ).toEqual(["fine"]);
  });

  it("excuses nothing when there is no document text", () => {
    expect(phrases('Clause 3 says "Vendor may increase the monthly fee".')).toEqual(["may"]);
  });
});

describe("Exemptions by context (product owner, 2026-10-31)", () => {
  it.each([
    "Late payment carries a fine of Rs. 5,000.",
    "Late payment carries a fine of Rs 5,000.",
    "A \u20B9500 fine applies to each late day.",
    "The fine of INR 2,000 is charged monthly.",
    "Each breach costs a 1,000 rupees fine.",
    "Fine of \u20B9750 per missed visit.",
  ])("allows \"fine\" next to an amount: %s", (text) => {
    expect(phrases(text)).toEqual([]);
  });

  it.each(["Rent is due from 1 May.", "The term starts on 1st May.", "Notice is due by May 1.", "It ends in May 2026.", "Signed on May, 2026."])(
    "allows \"May\" the month: %s",
    (text) => {
      expect(phrases(text)).toEqual([]);
    },
  );

  it.each([
    ["That is fine.", ["fine"]],
    ["The fine print says nothing about refunds.", ["fine"]],
    ["A fine applies, of an amount the contract leaves open.", ["fine"]],
    ["The terms are fine, and the fee is Rs. 5,000.", ["fine"]],
    ["Customer may be charged more.", ["may"]],
    ["May be charged more at renewal.", ["may"]],
    ["Rent is due on may 1.", ["may"]],
    ["Vendor may 10% raise.", ["may"]],
    ["In May, the fee rises.", ["may"]],
  ])("still flags near-misses: %s", (text, expected) => {
    expect(phrases(text)).toEqual(expected);
  });
});
