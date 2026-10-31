import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ask } from "../../lib/review/ask.js";
import { createFakeAdapter } from "../../lib/review/adapters/fake.js";
import { createLocalFakeAdapter } from "../../lib/review/adapters/index.js";
import { findBannedWording } from "../../lib/review/wording.js";
import { ASK_COPY } from "../../app/(app)/review/ask-copy.js";

const root = path.resolve(__dirname, "../..");
const documentText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");
const questionSet = JSON.parse(fs.readFileSync(path.join(root, "fixtures/questions/vendor-agreement-01.json"), "utf8"))
  .questions;

const scripted = (reply) => createFakeAdapter({ responses: [typeof reply === "string" ? reply : JSON.stringify(reply)] });
const localAdapter = () => createLocalFakeAdapter({ root });

describe("Question box: the fixture question set (PRD criterion 10)", () => {
  const notAnswered = questionSet.filter((q) => !q.inDocument);

  it("has questions the document does not answer, including ones a model is tempted to answer from general knowledge", () => {
    expect(notAnswered.length).toBeGreaterThanOrEqual(5);
  });

  for (const q of notAnswered) {
    it(`gives no answer to "${q.question}"`, async () => {
      const result = await ask({ documentText, question: q.question, adapter: localAdapter() });
      expect(result.status).toBe(q.expect);
      expect(result.status).not.toBe("answered");
      // No model text of any kind travels with a result that is not an answer.
      expect(Object.keys(result).sort()).toEqual(q.expect === "withheld" ? ["reason", "status"] : ["status"]);
    });
  }

  it("returns not-in-document for every question the fake model honestly says the document does not answer", async () => {
    const honest = notAnswered.filter((q) => q.reply?.status === "not-in-document");
    expect(honest.length).toBeGreaterThanOrEqual(5);
    for (const q of honest) {
      expect(await ask({ documentText, question: q.question, adapter: localAdapter() })).toEqual({
        status: "not-in-document",
      });
    }
  });

  for (const q of questionSet.filter((q) => q.inDocument)) {
    it(`returns ${q.expect} for "${q.question}"`, async () => {
      const result = await ask({ documentText, question: q.question, adapter: localAdapter() });
      expect(result.status).toBe(q.expect);
    });
  }
});

describe("Question box: answers and their Source sentences", () => {
  it("shows an answer with each Source sentence as the stored span", async () => {
    const result = await ask({
      documentText,
      question: "When is each invoice due, and what happens if it is paid late?",
      adapter: localAdapter(),
    });
    expect(result.status).toBe("answered");
    expect(result.text).toBe(
      "Each invoice is due within seven days of its date. Any amount not paid on time carries interest at 2% a month.",
    );
    expect(result.marked).toEqual([]);
    expect(result.sources.map((s) => s.text)).toEqual([
      "Customer will pay each invoice within seven days of the invoice date.",
      "Customer will pay interest at 2% per month on any amount not paid on time.",
    ]);
    for (const s of result.sources) expect(documentText.slice(s.start, s.end)).toBe(s.text);
  });

  it("shows the stored text when the model's quote differs only by the ADR 0010 normalisations", async () => {
    const doc = "Intro. The \u201CPremises\u201D means Shop 4\u2014Aundh Road,\nPune. End.";
    const result = await ask({
      documentText: doc,
      question: "What are the Premises?",
      adapter: scripted({
        status: "answered",
        answer: "Shop 4, Aundh Road, Pune.",
        sources: ['The "Premises" means Shop 4-Aundh Road, Pune.'],
      }),
    });
    expect(result.sources).toEqual([
      { text: "The \u201CPremises\u201D means Shop 4\u2014Aundh Road,\nPune.", start: 7, end: 52 },
    ]);
  });

  it("withholds an answer that cites nothing, an invented sentence, an altered sentence or a part sentence", async () => {
    const bad = [
      [],
      undefined,
      ["Vendor will give Customer thirty days' written notice of any fee increase."],
      ["Customer will pay each invoice within ten days of the invoice date."],
      ["Customer will pay each invoice within seven days"],
      ["Customer will pay each invoice ... of the invoice date."],
    ];
    for (const sources of bad) {
      const result = await ask({
        documentText,
        question: "When is an invoice due?",
        adapter: scripted({ status: "answered", answer: "Within seven days.", sources }),
      });
      expect(result).toEqual({ status: "withheld", reason: "source-not-found" });
    }
  });

  it("never turns a withheld answer into not-in-document", async () => {
    const result = await ask({
      documentText,
      question: "When is an invoice due?",
      adapter: scripted({ status: "answered", answer: "Within ten days.", sources: ["Invented."] }),
    });
    expect(result.status).toBe("withheld");
  });
});

describe("Question box: the hedge-word and verdict-word check (PRD criterion 8)", () => {
  it("marks a banned word in Redline's own wording and shows the answer", async () => {
    const result = await ask({ documentText, question: "Can Vendor raise the fee?", adapter: localAdapter() });
    expect(result.status).toBe("answered");
    expect(result.marked).toEqual([{ phrase: "may", start: 12, end: 15 }]);
    expect(result.text.slice(12, 15)).toBe("may");
  });

  it("does not mark a banned word quoted word for word from the document", async () => {
    const answer = 'Clause 3 reads: "Vendor may increase the monthly fee by up to 10% at each renewal."';
    const result = await ask({
      documentText,
      question: "Can Vendor raise the fee?",
      adapter: scripted({
        status: "answered",
        answer,
        sources: ["Vendor may increase the monthly fee by up to 10% at each renewal."],
      }),
    });
    expect(result).toMatchObject({ status: "answered", text: answer, marked: [] });
  });

  it("finds no banned word in any answer from the fixture set other than the one scripted to break the rule", async () => {
    for (const q of questionSet) {
      const result = await ask({ documentText, question: q.question, adapter: localAdapter() });
      if (result.status !== "answered") continue;
      const expected = q.question === "Can Vendor raise the fee?" ? 1 : 0;
      expect(result.marked.length).toBe(expected);
    }
  });

  it("uses no banned word in the question box's own copy", () => {
    const strings = [];
    const walk = (v) => (typeof v === "string" ? strings.push(v) : Object.values(v).forEach(walk));
    walk(ASK_COPY);
    for (const s of strings) expect(findBannedWording(s)).toEqual([]);
  });
});

describe("Question box: model output it cannot read", () => {
  it("withholds anything that is not one of the two expected shapes", async () => {
    const bad = [
      "Clause 6 caps liability.",
      "{}",
      "null",
      '{"status": "maybe"}',
      '{"status": "answered"}',
      '{"status": "answered", "answer": "  "}',
      '{"status": "answered", "answer": "Yes.", "sources": "Customer will pay."}',
    ];
    for (const reply of bad) {
      const result = await ask({ documentText, question: "Anything?", adapter: scripted(reply) });
      expect(result).toEqual({ status: "withheld", reason: "unreadable-output" });
    }
  });

  it("drops any answer text sent with a not-in-document reply", async () => {
    const result = await ask({
      documentText,
      question: "What does Indian law say about late interest?",
      adapter: scripted({ status: "not-in-document", answer: "The MSMED Act sets three times the bank rate." }),
    });
    expect(result).toEqual({ status: "not-in-document" });
  });
});

describe("Question box: input and prompt", () => {
  it("rejects an empty or overlong question, an empty or overlong document and a missing adapter", async () => {
    const adapter = scripted({ status: "not-in-document" });
    await expect(ask({ documentText, question: "  ", adapter })).rejects.toMatchObject({ code: "empty-question" });
    await expect(ask({ documentText, question: "a".repeat(1001), adapter })).rejects.toMatchObject({
      code: "question-too-long",
    });
    await expect(ask({ documentText: " ", question: "Why?", adapter })).rejects.toMatchObject({ code: "empty-document" });
    await expect(ask({ documentText: "a".repeat(200_001), question: "Why?", adapter })).rejects.toMatchObject({
      code: "document-too-long",
    });
    await expect(ask({ documentText, question: "Why?" })).rejects.toMatchObject({ code: "no-adapter" });
  });

  it("sends the document and the question, and tells the model to answer from the document only", async () => {
    let seen = "";
    const adapter = createFakeAdapter({
      responses: [
        (prompt) => {
          seen = prompt;
          return '{"status": "not-in-document"}';
        },
      ],
    });
    await ask({ documentText, question: "Is there a deposit?", adapter });
    expect(seen).toContain(documentText);
    expect(seen).toMatch(/<question>\nIs there a deposit\?\n<\/question>$/);
    expect(seen).toContain("Answer only from the document");
    expect(seen).toContain('{"status": "not-in-document"}');
  });

  it("refuses, rather than answers, a question the local fake adapter has no script for", async () => {
    await expect(ask({ documentText, question: "What colour is the shop?", adapter: localAdapter() })).rejects.toMatchObject({
      code: "no-script",
    });
  });
});
