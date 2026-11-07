// The CV template: turns a CV document (cv-document.ts) into a PDF with pdfmake. This is the only place the CV's look is
// defined: the editor's preview shows this PDF (drawn with pdf.js), and Export PDF and Save version give the same file, so what
// you see is what you get. The font is Source Sans 3 (src/assets/fonts); the photo is cut to a circle first.
//
// `cvDefinition` builds the page from the document and the pictures (no browser needed, so the tests can check it);
// `buildCvPdf` loads the pictures and fonts and makes the file.
import { contactCells, forVariant, shownSections, type CvDoc, type DocEntry, type PageDoc, type VariantKey } from "./cv-document";
import { cvIconSvg } from "./icons";
import { safeUrl } from "./safe-url";
import regular from "../assets/fonts/SourceSans3_400Regular.ttf?url";
import bold from "../assets/fonts/SourceSans3_700Bold.ttf?url";
import italic from "../assets/fonts/SourceSans3_400Regular_Italic.ttf?url";
import boldItalic from "../assets/fonts/SourceSans3_700Bold_Italic.ttf?url";

const GREY = "#7f7f7f";
const RULE = "#4d4d4d";
const LINK = "#467886";
const GAP_MARK = "#ffc2d4"; // the pink of a marked gap (editor preview only)
export const PAGE_MARGINS = [40, 36, 40, 36]; // 14 mm at the sides, 12.7 mm top and bottom: inside what printers can print
const WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2]; // the text width of an A4 page
const MM = 72 / 25.4; // pdf points in a millimetre
const NAME_SIZE = 17;
const BASE_SIZE = 10.5; // the text size everything else is sized against
/** How much bigger or smaller than the base the chosen text size is; set when a page is built. */
let scale = 1;
/** A size in pt as the chosen text size scales it. */
const fs = (pt: number) => pt * scale;
const QR_SIZE = 48; // about 17 mm
/** Source Sans 3's own line height (ascent + descent) is 1.424 times its size; pdfmake's lineHeight multiplies that. */
const FONT_LINE = 1.424;

type Node = Record<string, unknown>;

/** The pictures the page needs, already loaded: the round photo and the certificate badges, as data URLs. */
export interface CvImages {
  photo?: string;
  badges: Record<number, string>;
}

export interface CvPdfOptions {
  /**
   * Mark gaps in pink (the editor's spacing controls): "all", or one gap by its name: a spacing key ("afterName"...),
   * "section:work" (the gap above a section) or "entry:work" (the gaps between a section's entries). Never in the real file.
   */
  markGaps?: string | null;
}

/** **bold**, *italic* and [links](url) in a line of text, as pdfmake runs. */
export function runs(text: string, base: Node = {}): Node[] {
  const out: Node[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > i) out.push({ text: text.slice(i, m.index), ...base });
    if (m[1]) out.push({ text: m[1], bold: true, ...base });
    else if (m[2]) out.push({ text: m[2], italics: true, ...base });
    else out.push({ text: m[3], link: safeUrl(m[4]), color: LINK, decoration: "underline", ...base });
    i = re.lastIndex;
  }
  if (i < text.length) out.push({ text: text.slice(i), ...base });
  return out.length ? out : [{ text: "", ...base }];
}

const rule = (): Node => ({ canvas: [{ type: "line", x1: 0, y1: 0, x2: WIDTH, y2: 0, lineWidth: 0.6, lineColor: RULE }] });
const icon = (name: string) => cvIconSvg(name, fs(11)).replace(/currentColor/g, GREY).replace('class="icon"', "");

/**
 * The contact block: 5 columns, each as wide as its content, the same gap between all of them, centered on the page (with the
 * photo on the left: starting under the name). Each column is two table columns, the icon and its text, so pdfmake measures
 * every text itself and nothing runs into its neighbour. The location takes both rows, with "from Portugal" right under it.
 */
function contact(doc: PageDoc, narrow: boolean): Node {
  return narrow ? contactBeside(doc) : contactWide(doc);
}

/** The "photo on the left" contact block: 4 columns by 3 rows, the last column only for the location (see sideContactCells). */
function contactBeside(doc: PageDoc): Node {
  const cells = contactCells(doc);
  const rows = Math.max(1, ...cells.map((c) => c.row));
  const size = fs(8.5);
  const pair = (c: { icon: string; text: string }, note = false): Node[] => [
    { svg: icon(c.icon), width: fs(11), margin: [0, 1, 0, 0] },
    { width: "auto", text: c.text, color: GREY, fontSize: note ? fs(7) : size, italics: note, noWrap: true, margin: [0, note ? 1.5 : 0, 0, 0] },
  ];
  const body: unknown[][] = Array.from({ length: rows }, () => Array.from({ length: 4 }, () => ({ text: "" })));
  const origin = cells.find((c) => c.kind === "origin");
  for (const c of cells) {
    if (c.kind === "origin") continue;
    if (c.kind === "place") {
      // the location takes rows 1 and 2: the place, and right under it, small, "from Portugal"
      body[0][3] = {
        rowSpan: Math.min(2, rows),
        columns: [
          { svg: icon(c.icon), width: fs(11), margin: [0, 1, 0, 0] },
          { width: "auto", stack: [{ text: c.text, color: GREY, fontSize: size, noWrap: true }, ...(origin ? [{ text: origin.text, fontSize: fs(7.5), color: GREY, noWrap: true, margin: [0, 0.5, 0, 0] }] : [])] },
        ],
        columnGap: 4,
      };
      continue;
    }
    body[c.row - 1][c.col - 1] = { columns: pair(c, c.kind === "hidden"), columnGap: 4 };
  }
  return {
    table: { widths: ["auto", "auto", "auto", "auto"], body },
    layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: (i: number) => (i < 3 ? 12 : 0), paddingTop: () => 2, paddingBottom: () => 2 },
  };
}

function contactWide(doc: PageDoc): Node {
  const narrow = false;
  const cells = contactCells(doc);
  const rows = Math.max(1, ...cells.map((c) => c.row));
  const size = fs(narrow ? 8.5 : 9.5);
  const gap = narrow ? 8.5 : 20;
  const body: unknown[][] = Array.from({ length: rows }, () => Array.from({ length: 10 }, () => ({ text: "" })));
  const origin = cells.find((c) => c.kind === "origin");
  for (const c of cells) {
    const at = (c.col - 1) * 2;
    if (c.kind === "origin") continue;
    if (c.kind === "place") {
      const span = Math.min(2, rows);
      body[0][at] = { svg: icon(c.icon), width: fs(11), margin: [0, 1, 0, 0], rowSpan: span };
      body[0][at + 1] = {
        rowSpan: span,
        stack: [{ text: c.text, color: GREY, fontSize: size, noWrap: true }, ...(origin ? [{ text: origin.text, fontSize: fs(7.5), color: GREY, noWrap: true, margin: [0, 0.5, 0, 0] }] : [])],
      };
      continue;
    }
    const note = c.kind === "hidden"; // "Hidden in web version": small and slanted
    body[c.row - 1][at] = { svg: icon(c.icon), width: fs(11), margin: [0, 1, 0, 0] };
    body[c.row - 1][at + 1] = { text: c.text, color: GREY, fontSize: note ? fs(7) : size, italics: note, noWrap: true, margin: [0, note ? 1.5 : 0, 0, 0] };
  }
  const table: Node = {
    table: { widths: Array(10).fill("auto"), body },
    layout: {
      defaultBorder: false,
      paddingLeft: () => 0,
      paddingRight: (i: number) => (i % 2 === 0 ? 4 : i === 9 ? 0 : gap), // icon to text 4 pt, column to column the gap
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
  };
  return narrow ? table : { columns: [{ width: "*", text: "" }, { width: "auto", ...table }, { width: "*", text: "" }] };
}

/** One job, study or project: the heading line, the line under it, the bullets, papers, and a QR code for a "more details" link. */
function entry(e: DocEntry): Node {
  const head: Node[] = [...(e.org.trim() ? [{ text: e.org, bold: true }, { text: "  ○  ", fontSize: fs(7) }] : []), { text: e.title, bold: true, color: GREY }];
  const place: Node[] = [...(e.location.trim() ? [{ text: `${e.location}  `, color: GREY }] : []), { text: e.period, bold: true }];
  const body: Node[] = [];
  if (e.intro.trim()) body.push({ text: runs(e.intro), margin: [0, 1, 0, 0] });
  const lines = e.lines.filter((l) => l.trim());
  if (lines.length) body.push({ ul: lines.map((l) => ({ text: runs(l) })), margin: [8, 2, 0, 0], markerColor: "#000" });
  for (const p of e.papers.filter((p) => p.title.trim())) {
    body.push({ text: `${p.label}: “${p.title}”`, fontSize: fs(8.5), margin: [12, 3, 0, 0] });
    if (p.detail.trim()) body.push({ text: p.detail, fontSize: fs(8.5), color: "#555", margin: [12, 0, 0, 0] });
  }
  const url = e.moreUrl.trim() ? safeUrl(e.moreUrl.trim()) : "";
  const stack: Node[] = [{ columns: [{ width: "*", text: head }, { width: "auto", text: place, alignment: "right" }], columnGap: 12 }];
  if (url && url !== "#") {
    // "More details here" and its QR code on the right of the bullets, as in the Word CV: for people reading it on paper.
    stack.push({
      columns: [
        { width: "*", stack: body },
        { width: QR_SIZE + 4, stack: [{ text: [{ text: "More details " }, { text: "here", link: url, color: LINK, decoration: "underline" }], fontSize: fs(7.5), alignment: "center", margin: [0, 2, 0, 2] }, { qr: url, fit: QR_SIZE, alignment: "center", eccLevel: "M" }] },
      ],
      columnGap: 10,
    });
  } else stack.push(...body);
  return { stack, unbreakable: true };
}

/** The whole page, ready for pdfmake. */
export function cvDefinition(doc: PageDoc, images: CvImages, options: CvPdfOptions = {}): Node {
  const h = doc.header;
  const [first, ...rest] = h.name.trim().split(/\s+/);
  scale = doc.options.fontSize / BASE_SIZE;
  const nameSize = fs(NAME_SIZE);
  const side = doc.options.photoSide && doc.options.photo && !!images.photo;

  // A gap between two parts: an empty block of the chosen height in mm (pink when the editor marks it).
  const gapOf = (id: string, mm: number): Node => {
    const marked = options.markGaps === "all" || options.markGaps === id;
    return { canvas: [{ type: "rect", x: 0, y: 0, w: WIDTH, h: Math.max(mm * MM, 0.01), color: marked ? GAP_MARK : "#ffffff", fillOpacity: marked ? 1 : 0 }] };
  };
  const sp = doc.options.spacing;
  const gap = (key: keyof typeof sp) => gapOf(key, sp[key]);

  const pictures: Record<string, string> = {};
  const content: Node[] = [];
  const name: Node = {
    // letter spacing 0.22 em on the first name, 0.18 em on the bold surname (bold letters spaced wider look loose)
    text: [
      { text: `${(first ?? "").toUpperCase()} `, bold: false, characterSpacing: nameSize * 0.22 },
      { text: rest.join(" ").toUpperCase(), bold: true, characterSpacing: nameSize * 0.18 },
    ],
    fontSize: nameSize,
    alignment: side ? "left" : "center",
  };
  if (doc.options.photo && images.photo) pictures.photo = images.photo;
  if (side) {
    // The photo is as tall as the block beside it: it starts at the top of the name and ends at the bottom of the last row of details,
    // whatever the line spacing and gaps are. (The name's line, the gap after it, and the rows: icon 12 pt or a line of text, plus 4 pt.)
    const lineSpacing = doc.options.lineSpacing;
    const rows = Math.max(1, ...contactCells(doc).map((c) => c.row));
    // (Measured on the PDF: with very tall lines the last row's text ends higher than its row does, so a little less than that.)
    const beside = nameSize * lineSpacing + sp.afterName * MM + rows * (Math.max(fs(12), fs(8.5) * lineSpacing) + 4) - 11 * Math.max(0, lineSpacing - 1.5);
    const photoSize = Math.min(130, Math.max(60, beside));
    content.push({ columns: [{ image: "photo", width: photoSize }, { width: "*", stack: [name, gap("afterName"), contact(doc, true)] }], columnGap: 14 });
  } else {
    if (pictures.photo) content.push({ image: "photo", width: 88, alignment: "center", margin: [0, 5.7, 0, 8.5] });
    content.push(name, gap("afterName"), contact(doc, false));
  }
  content.push(gap("afterContact"));

  // The skills box: a line, its top gap, the rows (1.8 mm apart), its bottom gap, a line.
  const kv = (label: string, text: string): Node | null => (text.trim() ? { columns: [{ width: 74, text: label, bold: true, color: GREY }, { width: "*", text, color: GREY }] } : null);
  const lines = [kv("Skills/Tools", doc.skills), kv("Interests", doc.interests)].filter((x): x is Node => x !== null);
  content.push(rule(), gap("skillsTop"), ...lines.map((l, i) => (i < lines.length - 1 ? { ...l, margin: [0, 0, 0, 1.8 * MM] } : l)), gap("skillsBottom"), rule());

  shownSections(doc).forEach((s, si) => {
    // The first section starts its own gap under the skills box's line. Every later one: its gap, its own line, the
    // "line → title" gap. Then for all: the title and the "title → first entry" gap.
    const above = gapOf(`section:${s.key}`, doc.options.sectionGap[s.key]);
    const top: Node[] = [...(si === 0 ? [above] : [above, rule(), gap("beforeHeading")]), { text: s.title.toUpperCase(), bold: true, fontSize: fs(13) }, gap("afterHeading")];
    const between = () => gapOf(`entry:${s.key}`, doc.options.entryGap[s.key]);
    if (s.key === "certifications") {
      const cells = s.entries.map((e, i) => {
        const badge = images.badges[i];
        if (badge) pictures[`badge${i}`] = badge;
        return {
          columns: [{ width: 66, stack: [badge ? { image: `badge${i}`, width: 62 } : { text: "" }] }, { width: "*", stack: [{ text: e.title, bold: true }, ...(e.org.trim() ? [{ text: e.org }] : []), { text: e.period, bold: true }] }],
          columnGap: 6,
        };
      });
      const rows: Node[] = [];
      for (let i = 0; i < cells.length; i += 2) {
        if (i > 0) rows.push(between()); // the gap between rows of certificates
        rows.push({ columns: [cells[i], cells[i + 1] ?? { text: "" }], columnGap: 24 });
      }
      content.push({ stack: [...top, ...rows], unbreakable: true });
      return;
    }
    // the title stays with the first entry, so it is never alone at the bottom of a page
    s.entries.forEach((e, i) => content.push(i === 0 ? { stack: [...top, entry(e)], unbreakable: true } : { stack: [between(), entry(e)], unbreakable: true }));
  });

  return {
    pageSize: "A4",
    pageMargins: PAGE_MARGINS,
    // the line spacing chosen in the Look tab is in real terms (1 = lines as tall as the font size)
    defaultStyle: { font: "SourceSans3", fontSize: doc.options.fontSize, lineHeight: doc.options.lineSpacing / FONT_LINE },
    info: { title: `CV ${h.name}`, author: h.name },
    images: pictures,
    content,
  };
}

// ---- in the browser: pictures, fonts and the file ----

async function dataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  return await new Promise((ok, fail) => {
    const reader = new FileReader();
    reader.onload = () => ok(String(reader.result));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The photo cut to a circle (pdfmake cannot clip), as a PNG. */
async function circlePhoto(src: string): Promise<string> {
  const img = new Image();
  img.src = await dataUrl(src);
  await img.decode();
  const size = 400;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

// Pictures are loaded once per address: the preview rebuilds the PDF on every change.
const pictureCache = new Map<string, Promise<string>>();
const cached = (key: string, load: () => Promise<string>) => {
  if (!pictureCache.has(key)) pictureCache.set(key, load().catch((e) => (pictureCache.delete(key), Promise.reject(e))));
  return pictureCache.get(key)!;
};

let fontsLoaded: Promise<void> | undefined;

/** pdfmake reads fonts from its own little file system, not from addresses: put the four Source Sans 3 files there once. */
function loadFonts(pdfMake: any): Promise<void> {
  fontsLoaded ??= (async () => {
    const files = { "SourceSans3-Regular.ttf": regular, "SourceSans3-Bold.ttf": bold, "SourceSans3-Italic.ttf": italic, "SourceSans3-BoldItalic.ttf": boldItalic };
    const vfs: Record<string, string> = {};
    for (const [file, src] of Object.entries(files)) vfs[file] = (await dataUrl(src)).split("base64,")[1];
    pdfMake.addVirtualFileSystem(vfs);
    pdfMake.addFonts({ SourceSans3: { normal: "SourceSans3-Regular.ttf", bold: "SourceSans3-Bold.ttf", italics: "SourceSans3-Italic.ttf", bolditalics: "SourceSans3-BoldItalic.ttf" } });
  })();
  return fontsLoaded;
}

/** The PDF of one template of a CV (the "normal" one unless said otherwise), as a file. */
export async function buildCvPdf(cv: CvDoc, variant: VariantKey = "normal", options: CvPdfOptions = {}): Promise<Blob> {
  const doc = forVariant(cv, variant);
  const pdfMake = (await import("pdfmake/build/pdfmake")).default as any;
  await loadFonts(pdfMake);
  const images: CvImages = { badges: {} };
  if (doc.options.photo && doc.header.photo) images.photo = await cached(`photo:${doc.header.photo}`, () => circlePhoto(doc.header.photo));
  const certs = doc.sections.find((s) => s.key === "certifications");
  const shown = certs?.show ? certs.entries.filter((e) => e.show) : [];
  await Promise.all(shown.map(async (e, i) => { if (e.badge) images.badges[i] = await cached(e.badge, () => dataUrl(e.badge)); }));
  return await pdfMake.createPdf(cvDefinition(doc, images, options)).getBlob();
}
