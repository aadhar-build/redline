// Builds small DOCX files with JSZip for tests, so no real contract is committed.
//   makeDocx({ body, numbering?, styles? }) -> Promise<Buffer>
// body, numbering and styles are WordprocessingML fragments (the inside of w:body, w:numbering, w:styles).

import JSZip from "jszip";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A plain paragraph with one run, and a bare run.
export const p = (text, pPr = "") =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
export const r = (text) => `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
export const numPr = (numId, ilvl = 0) => `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`;

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.wordprocessingml";

export async function makeDocx({ body, numbering, styles }) {
  const zip = new JSZip();
  const overrides = [`<Override PartName="/word/document.xml" ContentType="${CT}.document.main+xml"/>`];
  const docRels = [];
  if (numbering) {
    overrides.push(`<Override PartName="/word/numbering.xml" ContentType="${CT}.numbering+xml"/>`);
    docRels.push(`<Relationship Id="rId1" Type="${REL}/numbering" Target="numbering.xml"/>`);
    zip.file("word/numbering.xml", `${XML}<w:numbering ${W}>${numbering}</w:numbering>`);
  }
  if (styles) {
    overrides.push(`<Override PartName="/word/styles.xml" ContentType="${CT}.styles+xml"/>`);
    docRels.push(`<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>`);
    zip.file("word/styles.xml", `${XML}<w:styles ${W}>${styles}</w:styles>`);
  }
  zip.file(
    "[Content_Types].xml",
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels.join("")}</Relationships>`,
  );
  zip.file("word/document.xml", `${XML}<w:document ${W} ${MC}><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// A three-level legal list ("1.", "1.1", "(a)") and a bullet list.
export const LEGAL_NUMBERING = `
<w:abstractNum w:abstractNumId="0">
  <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
  <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl>
  <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="(%3)"/></w:lvl>
</w:abstractNum>
<w:abstractNum w:abstractNumId="1">
  <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;
