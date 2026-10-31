// Ticket 21, items 5 and 6: PDF running headers and page numbers are stripped, and pages are joined
// with one "\n" (ticket 22, ruling A). The PDFs are built by tests/support/make-pdf.mjs and read by
// the real extraction code (readPdf) on pdf.js's Node build; the quotes go through the real
// Source-sentence check.
import { describe, expect, it } from "vitest";
import { readPdf } from "../../lib/extraction/pdf.js";
import { assemblePages } from "../../lib/extraction/pdf-text.js";
import { checkSource } from "../../lib/review/source-check.js";
import { makePdf, textPage } from "../support/make-pdf.mjs";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const read = (pages) => readPdf(pdfjs, makePdf(pages));
// Body text starts 100 points down, clear of the top band; header and footer sit inside the bands.
const body = (lines, opts = {}) => textPage(lines, { top: 100, ...opts });

describe("PDF pages join with a single newline", () => {
  it("withholds a fragment that ends at a page join and shows the whole sentence", async () => {
    const result = await read([
      body(["1. Payment", "The Licensee shall pay the licence fee on the first day of each month. If the Licensee fails to"]),
      body(["pay the licence fee within thirty days, the Licensor may terminate this agreement."]),
    ]);
    expect(result.kind).toBe("text");
    expect(result.text).toContain("If the Licensee fails to\npay the licence fee");
    expect(checkSource(result.text, "If the Licensee fails to").found).toBe(false);
    expect(checkSource(result.text, "If the Licensee fails to pay the licence fee within thirty days, the Licensor may terminate this agreement.")).toMatchObject({ found: true });
  });

  it("keeps the boundaries after a page that ends a sentence and a heading that opens the next page", async () => {
    const result = await read([
      body(["11. Notices", "Notices must be in writing and sent to the address of the Licensor."]),
      body(["12. Termination", "The Licensee may end this agreement on one month's notice."]),
    ]);
    expect(result.text).toContain("address of the Licensor.\n12. Termination\nThe Licensee");
    expect(checkSource(result.text, "Notices must be in writing and sent to the address of the Licensor.").found).toBe(true);
    expect(checkSource(result.text, "The Licensee may end this agreement on one month's notice.").found).toBe(true);
  });

  it("does not treat a page that ends on a ';' list item as a boundary", async () => {
    const result = await read([
      body(["The fee is due monthly. The Licensee shall:", "(a) pay the licence fee on time;"]),
      body(["(b) keep the premises clean."]),
    ]);
    expect(checkSource(result.text, "The Licensee shall: (a) pay the licence fee on time;").found).toBe(false);
    expect(checkSource(result.text, "The Licensee shall: (a) pay the licence fee on time; (b) keep the premises clean.").found).toBe(true);
  });
});

describe("PDF running headers and page numbers", () => {
  const HEADER = "Kesari Cleaning Services - Vendor Agreement";

  it("strips them, so a sentence crossing a 'Page 2 of 3' footer is one sentence whose quote passes", async () => {
    const result = await read([
      body(["1. Services", "The Vendor will clean the kitchen every night after closing."], { header: HEADER, footer: "Page 1 of 3" }),
      body(["2. Assignment", "The Vendor shall not assign this agreement or any of its rights under it without the"], {
        header: HEADER,
        footer: "Page 2 of 3",
      }),
      body(["prior written consent of the Client.", "3. Term", "This agreement runs for two years."], { header: HEADER, footer: "Page 3 of 3" }),
    ]);
    expect(result.kind).toBe("text");
    expect(result.text).not.toContain("Page 2 of 3");
    expect(result.text).not.toContain(HEADER);
    expect(
      checkSource(
        result.text,
        "The Vendor shall not assign this agreement or any of its rights under it without the prior written consent of the Client.",
      ),
    ).toMatchObject({ found: true });
    expect(result.removed).toEqual([
      { text: HEADER, count: 3 },
      { text: "Page 1 of 3", count: 1 },
      { text: "Page 2 of 3", count: 1 },
      { text: "Page 3 of 3", count: 1 },
    ]);
  });

  it("leaves a single-page PDF's header alone but takes out its page number", async () => {
    const result = await read([body(["The Vendor will clean the kitchen."], { header: "Vendor Agreement", footer: "- 1 -" })]);
    expect(result.text).toBe("Vendor Agreement\nThe Vendor will clean the kitchen.");
    expect(result.removed).toEqual([{ text: "- 1 -", count: 1 }]);
  });
});

describe("assemblePages rules", () => {
  const line = (text, top) => ({ text, top });
  const page = (...lines) => lines;
  const mid = (text) => line(text, 0.5);

  it("removes page-number lines only inside the top and bottom bands", () => {
    const { text } = assemblePages([
      page(line("3", 0.05), mid("Body."), mid("12"), line("Page 4", 0.95)),
      page(mid("More."), line("Page 5 of 9", 0.92), line("– 6 –", 0.97)),
    ]);
    expect(text).toBe("Body.\n12\nMore.");
  });

  it("removes a repeated band line only when it is on at least 3 pages and at least half of them", () => {
    const pages = (n, onPages) =>
      Array.from({ length: n }, (_, i) => (i < onPages ? page(line(`Draft ${i + 1} - Confidential`, 0.04), mid(`P${i}.`)) : page(mid(`P${i}.`))));
    expect(assemblePages(pages(2, 2)).text).toContain("Draft 1 - Confidential");
    expect(assemblePages(pages(7, 3)).text).toContain("Draft 1 - Confidential");
    const removed = assemblePages(pages(6, 3));
    expect(removed.text).not.toContain("Confidential");
    expect(removed.removed).toEqual([1, 2, 3].map((n) => ({ text: `Draft ${n} - Confidential`, count: 1 })));
  });

  it("counts the top and bottom bands apart, and never strips the same words from the body", () => {
    const pages = [1, 2, 3].map((i) =>
      page(line("Acme Ltd", i === 2 ? 0.96 : 0.04), mid("Acme Ltd"), mid(`Clause ${i}.`)),
    );
    // Top band on pages 1 and 3 only: two pages, not three.
    expect(assemblePages(pages).text.match(/Acme Ltd/g)).toHaveLength(6);
  });

  it("trims each page after stripping and joins pages with one newline", () => {
    const { text } = assemblePages([page(mid("ends here"), line("", null), line("7", 0.95)), page(mid("next page."))]);
    expect(text).toBe("ends here\nnext page.");
  });
});
