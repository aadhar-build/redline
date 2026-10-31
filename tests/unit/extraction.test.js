import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { looksEnglish } from "../../lib/extraction/language.js";
import { pageNeedsOcr, summariseOperators } from "../../lib/extraction/pdf-pages.js";
import { createNumberer, formatNumber } from "../../lib/extraction/docx-numbering.js";
import { COPY } from "../../app/(app)/review/copy.js";
import { MAX_FILE_BYTES } from "../../lib/extraction/result.js";
import { hiddenOcrPage, makePdf, scanPage, textPage, wrap } from "../support/make-pdf.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const vendorText = fs.readFileSync(path.join(root, "fixtures/contracts/vendor-agreement-01.txt"), "utf8");

describe("looksEnglish (ADR 0009)", () => {
  it("accepts the English fixture contracts", () => {
    for (const f of ["vendor-agreement-01.txt", "marked-wording-01.txt"]) {
      expect(looksEnglish(fs.readFileSync(path.join(root, "fixtures/contracts", f), "utf8"))).toBe(true);
    }
  });

  it("accepts an English contract with a Devanagari heading and Indian names", () => {
    const text = `भारतीय गैर न्यायिक\n${vendorText}\nSigned by Shri Ramesh Venkataraman Iyer and Smt. Lakshmi Deshpande.`;
    expect(looksEnglish(text)).toBe(true);
  });

  it("rejects a contract in Hindi", () => {
    const hindi =
      "यह अनुबंध पुणे में दिनांक 1 नवंबर 2026 को किया गया। विक्रेता हर रात ग्राहक की रसोई की सफाई करेगा। ग्राहक हर महीने अठारह हज़ार रुपये देगा। यह अनुबंध दो वर्ष तक चलेगा और अपने आप नवीनीकृत होगा।";
    expect(looksEnglish(hindi)).toBe(false);
  });

  it("rejects Latin-script contracts in French, Spanish, German and romanised Hindi", () => {
    const samples = [
      "Le présent contrat est conclu entre le prestataire et le client. Le prestataire s'engage à nettoyer la cuisine du client chaque nuit après la fermeture. Le client paiera au prestataire la somme de dix-huit mille roupies par mois, plus la taxe applicable. Le contrat est conclu pour une durée de deux ans et se renouvelle automatiquement.",
      "El presente contrato se celebra entre el proveedor y el cliente. El proveedor limpiará la cocina del cliente cada noche después del cierre. El cliente pagará al proveedor la suma de dieciocho mil rupias al mes, más el impuesto aplicable. El contrato tiene una duración de dos años y se renueva automáticamente.",
      "Dieser Vertrag wird zwischen dem Anbieter und dem Kunden geschlossen. Der Anbieter reinigt die Küche des Kunden jede Nacht nach Geschäftsschluss. Der Kunde zahlt dem Anbieter monatlich achtzehntausend Rupien zuzüglich der geltenden Steuer. Der Vertrag läuft zwei Jahre und verlängert sich automatisch um weitere zwei Jahre.",
      "Yeh anubandh vikreta aur grahak ke beech kiya gaya hai. Vikreta har raat grahak ki rasoi ki safai karega. Grahak har mahine vikreta ko atharah hazaar rupaye dega, aur kar alag se dega. Yeh anubandh do saal tak chalega aur apne aap aage badh jayega jab tak grahak likhit soochna na de.",
    ];
    for (const s of samples) expect(looksEnglish(s)).toBe(false);
  });

  it("judges the whole document, so a Hindi stamp-paper block, a Devanagari seal and ₹ amounts don't reject it", () => {
    const stampPaper =
      "भारतीय गैर न्यायिक\nदिल्ली DELHI\nई-स्टाम्प प्रमाणपत्र संख्या\nमुहर\n" +
      "This agreement is made between the Licensor and the Licensee. The Licensee shall pay ₹ 1,50,000 every month to the Licensor, and a deposit of ₹ 4,50,000 which shall be returned within thirty days of the end of the term. The Licensee shall not sublet the premises without the consent of the Licensor.\n" +
      "मुहर / सील";
    expect(looksEnglish(stampPaper)).toBe(true);
  });

  it("does not judge text too short to tell", () => {
    expect(looksEnglish("Kesari Cleaning Services Private Limited")).toBe(true);
  });
});

describe("page classification on real pdf.js operator lists", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  async function classify(pages) {
    const task = pdfjs.getDocument({ data: new Uint8Array(makePdf(pages)), isEvalSupported: false });
    const doc = await task.promise;
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0, y0, x1, y1] = page.view;
      const summary = summariseOperators(await page.getOperatorList(), pdfjs.OPS, (x1 - x0) * (y1 - y0));
      out.push({ ...summary, needsOcr: pageNeedsOcr(summary) });
    }
    await task.destroy();
    return out;
  }

  it("a page of typed text has a text layer", async () => {
    const [page] = await classify([textPage(wrap(vendorText))]);
    expect(page.imageCount).toBe(0);
    expect(page.visibleChars).toBeGreaterThan(1000);
    expect(page.needsOcr).toBe(false);
  });

  it("a full-page image with no text needs OCR", async () => {
    const [page] = await classify([scanPage()]);
    expect(page.imageCoverage).toBeCloseTo(1, 5);
    expect(page.visibleChars).toBe(0);
    expect(page.needsOcr).toBe(true);
  });

  it("a scan with a hidden OCR text layer needs OCR", async () => {
    const [page] = await classify([hiddenOcrPage(wrap(vendorText))]);
    expect(page.invisibleChars).toBeGreaterThan(1000);
    expect(page.visibleChars).toBe(0);
    expect(page.needsOcr).toBe(true);
  });
});

describe("pageNeedsOcr thresholds", () => {
  it("keeps typed text over a letterhead image", () => {
    expect(pageNeedsOcr({ visibleChars: 1200, invisibleChars: 0, imageCount: 1, imageCoverage: 1 })).toBe(false);
  });
  it("treats a stamped page number on a scan as no text layer", () => {
    expect(pageNeedsOcr({ visibleChars: 12, invisibleChars: 0, imageCount: 1, imageCoverage: 0.98 })).toBe(true);
  });
  it("keeps a short page with a small logo", () => {
    expect(pageNeedsOcr({ visibleChars: 25, invisibleChars: 0, imageCount: 1, imageCoverage: 0.05 })).toBe(false);
  });
  it("keeps a blank page", () => {
    expect(pageNeedsOcr({ visibleChars: 0, invisibleChars: 0, imageCount: 0, imageCoverage: 0 })).toBe(false);
  });
});

describe("Word list numbering", () => {
  const level = (numFmt, lvlText, extra = {}) => ({ start: 1, numFmt, lvlText, isLgl: false, ...extra });
  const legal = () => ({
    abstracts: new Map([
      ["0", { levels: new Map([[0, level("decimal", "%1.")], [1, level("decimal", "%1.%2")], [2, level("lowerLetter", "(%3)")]]) }],
    ]),
    nums: new Map([
      ["1", { abstractId: "0", overrides: new Map() }],
      ["2", { abstractId: "0", overrides: new Map([[0, { start: 1 }]]) }],
    ]),
  });

  it("numbers a legal list the way Word shows it", () => {
    const next = createNumberer(legal());
    const labels = [[0], [1], [1], [2], [2], [0], [1], [2]].map(([l]) => next("1", l));
    expect(labels).toEqual(["1.", "1.1", "1.2", "(a)", "(b)", "2.", "2.1", "(a)"]);
  });

  it("continues one sequence across nums that share a list, and restarts on startOverride", () => {
    const n = createNumberer(legal());
    expect([n("1", 0), n("1", 0)]).toEqual(["1.", "2."]);
    expect(n("2", 0)).toBe("1.");
  });

  it("leaves bullets and unknown lists unlabelled", () => {
    const next = createNumberer({
      abstracts: new Map([["0", { levels: new Map([[0, level("bullet", "•")]]) }]]),
      nums: new Map([["5", { abstractId: "0", overrides: new Map() }]]),
    });
    expect(next("5", 0)).toBe("");
    expect(next("99", 0)).toBe("");
  });

  it("formats letters and roman numerals", () => {
    expect([1, 26, 27].map((n) => formatNumber(n, "lowerLetter"))).toEqual(["a", "z", "aa"]);
    expect([4, 9, 14].map((n) => formatNumber(n, "upperRoman"))).toEqual(["IV", "IX", "XIV"]);
    expect(formatNumber(3, "decimalZero")).toBe("03");
  });
});

describe("upload copy", () => {
  it("counts scanned pages from one while OCR reads them", () => {
    expect(COPY.ocrProgress(0, 1)).toBe("Reading the scanned page…");
    expect(COPY.ocrProgress(0, 12)).toBe("Reading scanned page 1 of 12…");
    expect(COPY.ocrProgress(11, 12)).toBe("Reading scanned page 12 of 12…");
    expect(COPY.ocrProgress(12, 12)).toBe("Reading scanned page 12 of 12…");
  });

  it("states the same file size limit the code applies", () => {
    expect(COPY.errors["too-large"]).toContain(`${MAX_FILE_BYTES / 1024 / 1024} MB`);
  });

  it("rejects a file over the limit before reading a byte of it", async () => {
    const { extractFile } = await import("../../lib/extraction/index.js");
    const file = {
      name: "big.pdf",
      size: MAX_FILE_BYTES + 1,
      arrayBuffer() {
        throw new Error("the file was read");
      },
    };
    expect(MAX_FILE_BYTES).toBe(100 * 1024 * 1024);
    expect(await extractFile(file)).toEqual({ kind: "rejected", reason: "too-large" });
  });

  it("names up to five left-out running lines and the total line count", () => {
    expect(COPY.removedLines([{ text: "Page 2", count: 1 }])).toBe(
      'Redline left out 1 line it read as a running header or page number: "Page 2".',
    );
    expect(COPY.removedLines([{ text: "Acme Ltd", count: 3 }, { text: "Draft", count: 3 }])).toBe(
      'Redline left out 6 lines it read as running headers or page numbers: "Acme Ltd" and "Draft".',
    );
    const eight = Array.from({ length: 8 }, (_, i) => ({ text: `Page ${i + 1}`, count: 1 }));
    expect(COPY.removedLines(eight)).toBe(
      'Redline left out 8 lines it read as running headers or page numbers: "Page 1", "Page 2", "Page 3", "Page 4", "Page 5" and 3 more.',
    );
  });

});
