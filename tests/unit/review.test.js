import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { review, ReviewInputError } from "../../lib/review/review.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter, getModelAdapter, isAnalysisAvailable } from "../../lib/review/adapters/index.js";
import { findBannedWording } from "../../lib/review/wording.js";

const root = path.resolve(__dirname, "../..");
const fixtureText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const fixtureReply = fs.readFileSync(path.join(root, "fixtures/model-output/vendor-agreement-01.summary.json"), "utf8");
const fixtureSummary = JSON.parse(fixtureReply).summary;

const reply = (summary) => JSON.stringify({ summary });

describe("Review seam: summary", () => {
  it("takes document text, an empty Red line list and the fake adapter, and returns the summary", async () => {
    const result = await review({
      documentText: fixtureText,
      redLines: [],
      adapter: createFakeAdapter({ responses: [fixtureReply] }),
    });

    expect(result.summary).toEqual({ status: "shown", text: fixtureSummary });
    expect(findBannedWording(result.summary.text, { documentText: fixtureText })).toEqual([]);
  });

  it("returns the rest of the review shape, uncomputed, and never claims a Clean result", async () => {
    const result = await review({
      documentText: fixtureText,
      redLines: [],
      adapter: createFakeAdapter({ responses: [fixtureReply] }),
    });

    expect(result.riskFlags).toEqual([]);
    expect(result.outsideReferences).toEqual([]);
    expect(result.ambiguousClauses).toEqual([]);
    expect(result.withheldCount).toBe(0);
    expect(result.cleanResult).toBeNull();
    expect(result.redLinesChecked).toEqual([]);
  });

  it("withholds a summary that uses a hedge word in Redline's own words", async () => {
    const result = await review({
      documentText: fixtureText,
      redLines: [],
      adapter: createFakeAdapter({ responses: [reply("Customer may owe a large fee for leaving early.")] }),
    });

    expect(result.summary.status).toBe("withheld");
    expect(result.summary.reason).toBe("banned-wording");
    expect(result.summary.bannedWording.map((h) => h.phrase)).toEqual(["may"]);
    expect(result.summary).not.toHaveProperty("text");
  });

  it("withholds a summary that uses a verdict word", async () => {
    const result = await review({
      documentText: fixtureText,
      redLines: [],
      adapter: createFakeAdapter({ responses: [reply("The payment terms are fine and it is good to sign.")] }),
    });

    expect(result.summary.status).toBe("withheld");
    expect(result.summary.bannedWording.map((h) => h.phrase)).toEqual(["fine", "good to sign"]);
  });

  it("shows a summary whose only hedge word sits in a sentence quoted word for word from the document", async () => {
    const summary = 'Clause 3 reads: "Vendor may increase the monthly fee by up to 10% at each renewal."';
    const result = await review({
      documentText: fixtureText,
      redLines: [],
      adapter: createFakeAdapter({ responses: [reply(summary)] }),
    });

    expect(result.summary).toEqual({ status: "shown", text: summary });
  });

  it("withholds output that is not the expected JSON", async () => {
    for (const bad of ["Here is your summary.", "{}", '{"summary": ""}', '{"summary": 4}']) {
      const result = await review({
        documentText: fixtureText,
        redLines: [],
        adapter: createFakeAdapter({ responses: [bad] }),
      });
      expect(result.summary).toEqual({ status: "withheld", reason: "unreadable-output" });
    }
  });

  it("rejects empty text, overlong text and a missing adapter", async () => {
    const adapter = createFakeAdapter({ responses: [fixtureReply] });
    await expect(review({ documentText: "  \n ", redLines: [], adapter })).rejects.toMatchObject({
      code: "empty-document",
    });
    await expect(review({ documentText: "a".repeat(200_001), redLines: [], adapter })).rejects.toBeInstanceOf(
      ReviewInputError,
    );
    await expect(review({ documentText: fixtureText, redLines: [] })).rejects.toMatchObject({ code: "no-adapter" });
  });
});

describe("Which adapter a server gets", () => {
  it("has no adapter, so analysis is unavailable, when nothing is configured", () => {
    expect(getModelAdapter({})).toBeNull();
    expect(isAnalysisAvailable({})).toBe(false);
  });

  it("never has an adapter on Vercel, even when the fake is asked for", () => {
    expect(getModelAdapter({ VERCEL: "1", REDLINE_MODEL_ADAPTER: "fake" })).toBeNull();
    expect(isAnalysisAvailable({ VERCEL: "1", REDLINE_MODEL_ADAPTER: "fake" })).toBe(false);
  });

  it("has no adapter for values it does not know, including the not-yet-built CLI adapter", () => {
    expect(getModelAdapter({ REDLINE_MODEL_ADAPTER: "claude-cli" })).toBeNull();
  });

  it("gives the local fake adapter only when asked for it off Vercel", () => {
    expect(isAnalysisAvailable({ REDLINE_MODEL_ADAPTER: "fake" })).toBe(true);
  });
});

describe("Local fake adapter through Review", () => {
  it("summarises the pasted fixture, whatever its surrounding whitespace", async () => {
    const pasted = `\n\n  ${fixtureText.replace(/\n/g, "\r\n")}  \n`;
    const result = await review({ documentText: pasted, redLines: [], adapter: createLocalFakeAdapter({ root }) });
    expect(result.summary).toEqual({ status: "shown", text: fixtureSummary });
  });

  it("refuses text it has no script for instead of returning a summary written for another document", async () => {
    await expect(
      review({
        documentText: "This lease is between two made-up parties.",
        redLines: [],
        adapter: createLocalFakeAdapter({ root }),
      }),
    ).rejects.toMatchObject({ code: "no-script" });
  });
});
