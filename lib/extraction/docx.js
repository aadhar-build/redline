// DOCX extraction in the browser: JSZip opens the file, the browser's DOMParser reads the XML, and
// this module walks word/document.xml itself (owner's choice, ticket 07), so that:
//  - automatic clause numbers ("12.3", "(b)") are put back in front of their paragraphs;
//  - tracked changes are read in the accepted view: insertions kept, deletions dropped;
//  - a line break (w:br, w:cr) becomes "\n", never nothing, so words are not glued together;
//  - one sentence split across many runs comes out whole;
//  - each text box is read once (one branch of mc:AlternateContent) and placed after its paragraph.
//  - footnotes and endnotes are read (ticket 21): after the body, under a plain "Footnotes" line and
//    then an "Endnotes" line, one note per paragraph with a blank line between, in the order their
//    references appear in the document.
// Not read: headers and footers (they sit outside the body, so skipping them never splits a sentence)
// and comments. Hidden text (run-level w:vanish) is skipped because it is not on the page the
// Reviewer sees, but each hidden run with a letter or digit in it is counted, so the upload can say
// the file has text Word hides. Hiding that comes from a style is not detected.

import JSZip from "jszip";
import { createNumberer } from "./docx-numbering.js";
import { rejected, textResult } from "./result.js";

const W_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main", // Strict OOXML
]);
const MC_NAMESPACE = "http://schemas.openxmlformats.org/markup-compatibility/2006";

const isW = (el, name) => el.nodeType === 1 && el.localName === name && W_NAMESPACES.has(el.namespaceURI);
const isMc = (el, name) => el.nodeType === 1 && el.localName === name && el.namespaceURI === MC_NAMESPACE;
const elements = (el) => Array.from(el?.childNodes ?? []).filter((n) => n.nodeType === 1);
const child = (el, name) => elements(el).find((c) => isW(c, name)) ?? null;
const children = (el, name) => elements(el).filter((c) => isW(c, name));

function attr(el, name) {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name && (a.namespaceURI === null || W_NAMESPACES.has(a.namespaceURI))) return a.value;
  }
  return null;
}

const intAttr = (el, name) => {
  const v = attr(el, name);
  return v === null || v === "" ? undefined : Number.parseInt(v, 10);
};

// An on/off property such as <w:vanish/> or <w:vanish w:val="false"/>.
const isOn = (el) => el !== null && !["0", "false", "off"].includes(attr(el, "val") ?? "true");

function parseXml(source) {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("bad xml");
  return doc;
}

async function readPart(zip, path) {
  const file = zip.file(path);
  return file ? parseXml(await file.async("string")) : null;
}

// The main document part is named in _rels/.rels; it is almost always word/document.xml.
async function mainPartPath(zip) {
  const rels = await readPart(zip, "_rels/.rels");
  const rel = rels && Array.from(rels.getElementsByTagName("*")).find((r) =>
    r.localName === "Relationship" && /\/officeDocument$/.test(r.getAttribute("Type") ?? ""));
  const target = rel?.getAttribute("Target");
  return target ? target.replace(/^\//, "") : "word/document.xml";
}

// The footnotes and endnotes parts are named in the main part's relationships; Word calls them
// footnotes.xml and endnotes.xml, next to document.xml.
async function notePartPaths(zip, mainPath) {
  const slash = mainPath.lastIndexOf("/");
  const dir = mainPath.slice(0, slash + 1);
  const rels = await readPart(zip, `${dir}_rels/${mainPath.slice(slash + 1)}.rels`);
  const target = (kind) => {
    const rel = rels && Array.from(rels.getElementsByTagName("*")).find((r) =>
      r.localName === "Relationship" && (r.getAttribute("Type") ?? "").endsWith(`/${kind}`));
    const t = rel?.getAttribute("Target");
    if (!t) return `${dir}${kind}.xml`;
    return t.startsWith("/") ? t.slice(1) : `${dir}${t}`;
  };
  return { footnotes: target("footnotes"), endnotes: target("endnotes") };
}

// Word's own separator "notes" are not part of the document.
const SEPARATOR_NOTES = new Set(["separator", "continuationSeparator", "continuationNotice"]);

function readNotes(doc, name) {
  const notes = new Map();
  for (const n of children(doc?.documentElement, name)) {
    if (SEPARATOR_NOTES.has(attr(n, "type") ?? "normal")) continue;
    notes.set(attr(n, "id"), n);
  }
  return notes;
}

// ---- numbering.xml and styles.xml ----

function readLevel(lvl) {
  return {
    start: intAttr(child(lvl, "start"), "val") ?? 1,
    numFmt: attr(child(lvl, "numFmt"), "val") ?? "decimal",
    lvlText: attr(child(lvl, "lvlText"), "val") ?? "",
    isLgl: isOn(child(lvl, "isLgl")),
    restart: intAttr(child(lvl, "lvlRestart"), "val"),
    pStyle: attr(child(lvl, "pStyle"), "val"),
  };
}

function readNumbering(doc) {
  const abstracts = new Map();
  const nums = new Map();
  const styleLinks = new Map(); // abstractId -> numbering style it borrows its levels from
  const root = doc?.documentElement;
  for (const a of children(root, "abstractNum")) {
    const levels = new Map(children(a, "lvl").map((l) => [intAttr(l, "ilvl") ?? 0, readLevel(l)]));
    const id = attr(a, "abstractNumId");
    abstracts.set(id, { levels });
    const link = attr(child(a, "numStyleLink"), "val");
    if (link) styleLinks.set(id, link);
  }
  for (const n of children(root, "num")) {
    const overrides = new Map();
    for (const o of children(n, "lvlOverride")) {
      const lvl = child(o, "lvl");
      overrides.set(intAttr(o, "ilvl") ?? 0, {
        start: intAttr(child(o, "startOverride"), "val"),
        level: lvl ? readLevel(lvl) : undefined,
      });
    }
    nums.set(attr(n, "numId"), { abstractId: attr(child(n, "abstractNumId"), "val"), overrides });
  }
  return { abstracts, nums, styleLinks };
}

function readStyles(doc) {
  const styles = new Map();
  let defaultParagraphStyle = null;
  for (const s of children(doc?.documentElement, "style")) {
    const id = attr(s, "styleId");
    const numPr = child(child(s, "pPr"), "numPr");
    styles.set(id, {
      numId: attr(child(numPr, "numId"), "val"),
      ilvl: intAttr(child(numPr, "ilvl"), "val"),
      basedOn: attr(child(s, "basedOn"), "val"),
    });
    if (attr(s, "type") === "paragraph" && ["1", "true", "on"].includes(attr(s, "default"))) {
      defaultParagraphStyle = id;
    }
  }
  return { styles, defaultParagraphStyle };
}

// A w:numStyleLink points an abstract list at a numbering style, whose numPr names the list that
// really holds the levels. Follow it once.
function resolveStyleLinks(numbering, styles) {
  for (const [abstractId, styleId] of numbering.styleLinks) {
    const linkedNum = numbering.nums.get(styles.get(styleId)?.numId);
    const target = linkedNum && numbering.abstracts.get(linkedNum.abstractId);
    if (target && target.levels.size > 0) numbering.abstracts.set(abstractId, target);
  }
}

// ---- document.xml ----

function createReader({ numbering, styles, defaultParagraphStyle }) {
  const next = createNumberer(numbering);
  const blocks = []; // finished paragraphs, in order
  let carry = ""; // text of a paragraph whose mark was deleted, joined onto the next one
  let hiddenRuns = 0; // hidden runs with a letter or digit in them
  const references = { footnote: [], endnote: [] }; // note ids, in the order they are referred to

  // A style's list and level, each taken from the nearest style in the w:basedOn chain that sets it.
  function styleNumPr(styleId) {
    let numId;
    let ilvl;
    let numStyle = null;
    for (let id = styleId, hops = 0; id && hops < 20; hops++) {
      const s = styles.get(id);
      if (!s) break;
      if (numId === undefined && s.numId !== null && s.numId !== undefined) {
        numId = s.numId;
        numStyle = id;
      }
      if (ilvl === undefined && s.ilvl !== undefined) ilvl = s.ilvl;
      id = s.basedOn;
    }
    return numId === undefined ? null : { numId, ilvl, styleId: styleId ?? numStyle };
  }

  function numberingOf(p) {
    const pPr = child(p, "pPr");
    const styleId = attr(child(pPr, "pStyle"), "val") ?? defaultParagraphStyle;
    const own = child(pPr, "numPr");
    const fromStyle = styleNumPr(styleId);
    const numId = attr(child(own, "numId"), "val") ?? fromStyle?.numId;
    if (numId === undefined || numId === null || numId === "0") return null;
    let ilvl = intAttr(child(own, "ilvl"), "val") ?? fromStyle?.ilvl;
    if (ilvl === undefined && fromStyle) {
      // A style tied to a level through w:pStyle in the list definition.
      const abstract = numbering.abstracts.get(numbering.nums.get(numId)?.abstractId);
      for (const [l, def] of abstract?.levels ?? []) if (def.pStyle === fromStyle.styleId) ilvl = l;
    }
    return { numId, ilvl: ilvl ?? 0 };
  }

  // Inline content of a paragraph. Text boxes found inside are collected into `boxes`.
  function inline(el, out, boxes) {
    for (const c of elements(el)) {
      if (isW(c, "r")) run(c, out, boxes);
      else if (isW(c, "del") || isW(c, "moveFrom")) continue;
      else if (isW(c, "sdt")) inline(child(c, "sdtContent"), out, boxes);
      else if (isMc(c, "AlternateContent")) inline(alternate(c), out, boxes);
      else if (["ins", "moveTo", "hyperlink", "smartTag", "customXml", "fldSimple", "dir", "bdo"].some((n) => isW(c, n))) {
        inline(c, out, boxes);
      }
    }
  }

  function run(r, out, boxes) {
    if (isOn(child(child(r, "rPr"), "vanish"))) {
      const hidden = elements(r).filter((c) => isW(c, "t")).map((c) => c.textContent).join("");
      if (/[\p{L}\p{N}]/u.test(hidden)) hiddenRuns += 1;
      return;
    }
    for (const c of elements(r)) {
      if (isW(c, "t")) out.push(c.textContent);
      else if (isW(c, "tab") || isW(c, "ptab")) out.push("\t");
      else if (isW(c, "br") || isW(c, "cr")) out.push("\n");
      else if (isW(c, "noBreakHyphen")) out.push("‑");
      else if (isW(c, "softHyphen")) out.push("­");
      else if (isW(c, "sym")) out.push(symbol(attr(c, "char")));
      else if (isW(c, "footnoteReference")) references.footnote.push(attr(c, "id"));
      else if (isW(c, "endnoteReference")) references.endnote.push(attr(c, "id"));
      else if (isW(c, "drawing") || isW(c, "pict") || isW(c, "object")) collectBoxes(c, boxes);
      else if (isMc(c, "AlternateContent")) collectBoxes(alternate(c), boxes);
      // w:delText and w:instrText (a field's code, not its shown result) are skipped.
    }
  }

  // Read one branch only: Word writes a text box into both the Choice and the Fallback.
  function alternate(ac) {
    const branches = elements(ac);
    return branches.find((b) => isMc(b, "Fallback")) ?? branches.find((b) => isMc(b, "Choice")) ?? null;
  }

  function collectBoxes(el, boxes) {
    for (const c of elements(el)) {
      if (isW(c, "txbxContent")) boxes.push(c);
      else if (isMc(c, "AlternateContent")) collectBoxes(alternate(c), boxes);
      else collectBoxes(c, boxes);
    }
  }

  function paragraph(p) {
    const out = [];
    const boxes = [];
    inline(p, out, boxes);
    const text = carry + out.join("");
    carry = "";

    const markDeleted = child(child(child(p, "pPr"), "rPr"), "del") !== null;
    if (markDeleted) {
      // Accepting a deleted paragraph mark joins this paragraph onto the next, which keeps its
      // own number. So this one takes no number.
      carry = text;
    } else {
      const num = numberingOf(p);
      const label = num ? next(num.numId, num.ilvl) : "";
      const line = label && text.trim() ? `${label} ${text}` : text;
      if (line.trim()) blocks.push(line);
    }
    for (const box of boxes) block(box);
  }

  function block(el) {
    for (const c of elements(el)) {
      if (isW(c, "p")) paragraph(c);
      else if (isW(c, "tbl")) {
        for (const tr of children(c, "tr")) {
          if (child(child(tr, "trPr"), "del")) continue; // a deleted table row
          for (const tc of children(tr, "tc")) block(tc);
        }
      } else if (isW(c, "sdt")) block(child(c, "sdtContent"));
      else if (isMc(c, "AlternateContent")) block(alternate(c));
      else if (isW(c, "customXml") || isW(c, "ins") || isW(c, "moveTo")) block(c);
    }
  }

  // The paragraphs of one element (the body, or one note), each a string.
  function paragraphsOf(el) {
    blocks.length = 0;
    carry = "";
    block(el);
    if (carry.trim()) blocks.push(carry);
    carry = "";
    return blocks.splice(0);
  }

  // One string per note, in the order the notes are referred to. Word shows no note that nothing
  // refers to, so such a note is not read.
  function notesText(notes, kind) {
    const out = [];
    const done = new Set();
    for (const id of references[kind]) {
      if (done.has(id) || !notes.has(id)) continue;
      done.add(id);
      const text = paragraphsOf(notes.get(id)).map((t) => t.trim()).filter(Boolean).join("\n");
      if (text) out.push(text);
    }
    return out;
  }

  return {
    read(body, { footnotes = new Map(), endnotes = new Map() } = {}) {
      const parts = [paragraphsOf(body).join("\n\n")];
      // Notes are read after the whole body, so every reference in it has been seen.
      const foot = notesText(footnotes, "footnote");
      const end = notesText(endnotes, "endnote");
      if (foot.length > 0) parts.push("Footnotes", ...foot);
      if (end.length > 0) parts.push("Endnotes", ...end);
      return { text: parts.filter(Boolean).join("\n\n"), hiddenRuns };
    },
  };
}

// w:sym usually points into a symbol font's private-use range (F020-F0FF mirrors ASCII 20-FF).
function symbol(code) {
  const n = Number.parseInt(code ?? "", 16);
  if (!Number.isFinite(n)) return "";
  const c = n >= 0xf000 && n <= 0xf0ff ? n - 0xf000 : n;
  return c >= 0x20 ? String.fromCodePoint(c) : "";
}

/** @param {ArrayBuffer} data the file's bytes; they stay in this browser tab */
export async function extractDocx(data) {
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return rejected("unreadable");
  }
  if (zip.file("EncryptedPackage")) return rejected("password");

  try {
    const mainPath = await mainPartPath(zip);
    const document = await readPart(zip, mainPath);
    const body = document && child(document.documentElement, "body");
    if (!body) return rejected("unreadable");
    const dir = mainPath.includes("/") ? mainPath.slice(0, mainPath.lastIndexOf("/") + 1) : "";
    const notePaths = await notePartPaths(zip, mainPath);
    const [numberingDoc, stylesDoc, footnotesDoc, endnotesDoc] = await Promise.all([
      readPart(zip, `${dir}numbering.xml`),
      readPart(zip, `${dir}styles.xml`),
      readPart(zip, notePaths.footnotes),
      readPart(zip, notePaths.endnotes),
    ]);
    const numbering = readNumbering(numberingDoc);
    const { styles, defaultParagraphStyle } = readStyles(stylesDoc);
    resolveStyleLinks(numbering, styles);

    const { text, hiddenRuns } = createReader({ numbering, styles, defaultParagraphStyle }).read(body, {
      footnotes: readNotes(footnotesDoc, "footnote"),
      endnotes: readNotes(endnotesDoc, "endnote"),
    });
    if (text.trim().length === 0) return rejected("no-text");
    return textResult(text, "docx", { hiddenRuns });
  } catch {
    return rejected("unreadable");
  }
}
