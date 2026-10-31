// Builds small PDFs byte by byte for tests, so no real contract or scan is ever committed and no
// PDF-writing dependency is needed. Text uses the standard Helvetica font (ASCII only).
//
//   textPage(lines)            a page of visible text, one line per entry
//   scanPage()                 a page that is one full-page image and no text
//   hiddenOcrPage(lines)       a full-page image with the lines drawn invisibly (text render mode 3),
//                              the way a scanner's OCR makes a scan searchable
//   makePdf(pages) -> Buffer

const WIDTH = 612;
const HEIGHT = 792;

const escapePdfString = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);

function textOps(lines, mode = 0) {
  const out = ["BT", "/F1 11 Tf", `${mode} Tr`, "14 TL", `72 ${HEIGHT - 72} Td`];
  for (const line of lines) out.push(`(${escapePdfString(line)}) Tj`, "T*");
  out.push("ET");
  return out.join("\n");
}

const IMAGE_DRAW = `q ${WIDTH} 0 0 ${HEIGHT} 0 0 cm /Im1 Do Q`;

export const textPage = (lines) => ({ content: textOps(lines), image: false });
export const scanPage = () => ({ content: IMAGE_DRAW, image: true });
export const hiddenOcrPage = (lines) => ({ content: `${IMAGE_DRAW}\n${textOps(lines, 3)}`, image: true });

// Wraps text into lines of at most `width` characters, breaking at spaces.
export function wrap(text, width = 90) {
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (line && (line + " " + word).length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

export function makePdf(pages) {
  // Object numbers: 1 catalog, 2 pages, 3 font, 4 image, then a page and its content per page.
  const objects = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  // An 8x8 grey checker, uncompressed, so pdf.js needs no image decoder.
  const pixels = Buffer.alloc(64, 0).map((_, i) => ((i + Math.floor(i / 8)) % 2 ? 0x30 : 0xd0));
  objects[4] = { dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8", data: pixels };
  pages.forEach((page, i) => {
    const resources = page.image ? "<< /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >>" : "<< /Font << /F1 3 0 R >> >>";
    objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources ${resources} /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = { dict: "<<", data: Buffer.from(page.content, "latin1") };
  });

  const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let length = chunks[0].length;
  const offsets = [];
  const push = (buf) => {
    chunks.push(buf);
    length += buf.length;
  };
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = length;
    const obj = objects[id];
    if (typeof obj === "string") push(Buffer.from(`${id} 0 obj\n${obj}\nendobj\n`, "latin1"));
    else {
      push(Buffer.from(`${id} 0 obj\n${obj.dict} /Length ${obj.data.length} >>\nstream\n`, "latin1"));
      push(obj.data);
      push(Buffer.from("\nendstream\nendobj\n", "latin1"));
    }
  }
  const xrefAt = length;
  const xref = [`xref\n0 ${objects.length}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id < objects.length; id++) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  push(Buffer.from(xref.join(""), "latin1"));
  return Buffer.concat(chunks);
}
