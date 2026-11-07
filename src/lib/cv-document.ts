// A CV as the CV Builder handles it: the header, the skills lines and sections of entries (work, studies, projects, ...),
// plus a few look options. Every saved version keeps a full copy of this document (src/data/cv-docs/v<id>.yml), so a CV
// never changes when something else on the site does. src/data/cv-document.yml is the starting point for the first one.
// Every field has a default, so a missing or half-written file never breaks the builder.
import YAML from "yaml";

export const SECTION_KEYS = ["work", "studies", "projects", "experiences", "certifications"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_TITLES: Record<SectionKey, string> = {
  work: "Work",
  studies: "Studies",
  projects: "My projects",
  experiences: "Experiences",
  certifications: "Certifications",
};

/** A line under an entry: a paper, with its label ("Paper"), title and a second line (journal, DOI...). */
export interface DocPaper {
  label: string;
  title: string;
  detail: string;
}

export interface DocEntry {
  show: boolean;
  /** The role, degree, certificate or project name. */
  title: string;
  /** The company, institution or issuer; empty for a project. */
  org: string;
  location: string;
  /** The period or date. */
  period: string;
  /** A line under the heading, for example the project or thesis title. */
  intro: string;
  lines: string[];
  papers: DocPaper[];
  /** A "More details here" link (projects). */
  moreUrl: string;
  /** A picture next to the entry (the badge of a certificate). */
  badge: string;
}

export interface DocSection {
  key: SectionKey;
  title: string;
  show: boolean;
  entries: DocEntry[];
}

export interface DocHeader {
  name: string;
  photo: string;
  email: string;
  phone: string;
  birth: string;
  licence: string;
  location: string;
  /** "from Portugal", shown small under the location. */
  origin: string;
  /** Languages, separated by commas: "Portuguese (Native), English (C1)". */
  languages: string;
  website: string;
  linkedin: string;
}

/**
 * The gaps of the page, in mm, changed in the Look tab. Some are fixed places (name, details, the skills box, around a section
 * title); every section also has its own gap above it (from the block before it) and its own gap between its entries.
 */
export const SPACING_KEYS = ["afterName", "afterContact", "skillsTop", "skillsBottom", "beforeHeading", "afterHeading"] as const;
export type SpacingKey = (typeof SPACING_KEYS)[number];
export const SPACING_LABELS: Record<SpacingKey, string> = {
  afterName: "Name → details",
  afterContact: "Details → skills",
  skillsTop: "Skills box: top (line → text)",
  skillsBottom: "Skills box: bottom (text → line)",
  beforeHeading: "Every section: line → title",
  afterHeading: "Every section: title → first entry",
};
export const DEFAULT_SPACING: Record<SpacingKey, number> = { afterName: 4, afterContact: 3, skillsTop: 2.5, skillsBottom: 2.5, beforeHeading: 3.5, afterHeading: 2.5 };
export const DEFAULT_SECTION_GAP = 4;
export const DEFAULT_ENTRY_GAP = 4;
export const MAX_SPACING = 15;
/** Line spacing: the height of a line of text as a multiple of the font size (1 = as tall as the letters are big). */
export const DEFAULT_LINE_SPACING = 1.25;
/** The size of the text, in pt. Everything on the page (name, titles, details) scales with it. */
export const DEFAULT_FONT_SIZE = 10.5;
export const FONT_SIZE_RANGE = [8, 13] as const;
export const LINE_SPACING_RANGE = [1, 1.8] as const;

/** A gap's value: a number from 0 to 15 mm (one decimal), or the fallback. */
export function spacingValue(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= MAX_SPACING ? Math.round(n * 10) / 10 : fallback;
}

/**
 * Every CV has the same content in six templates: three layouts (normal, photo on the left, no photo), each with the phone number
 * and with it hidden. The look (line spacing and gaps) is chosen for each layout; the "phone hidden" template of a layout has the
 * same look, only the number is hidden. Only the phone-hidden ones can be put on the website.
 */
export const VARIANT_KEYS = ["normal", "hidden", "side", "sideHidden", "nophoto", "nophotoHidden"] as const;
export type VariantKey = (typeof VARIANT_KEYS)[number];
/** The layouts whose look is edited. */
export const LOOK_KEYS = ["normal", "side", "nophoto"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

export const VARIANT_LABELS: Record<VariantKey, string> = {
  normal: "Normal",
  hidden: "Normal · no phone",
  side: "Photo left",
  sideHidden: "Photo left · no phone",
  nophoto: "No photo",
  nophotoHidden: "No photo · no phone",
};
export const VARIANT_HINTS: Record<VariantKey, string> = {
  normal: "photo on top, with the phone number",
  hidden: "photo on top, phone number hidden: can go on the website",
  side: "photo on the left, with the phone number",
  sideHidden: "photo on the left, phone number hidden: can go on the website",
  nophoto: "no photo, with the phone number",
  nophotoHidden: "no photo, phone number hidden: can go on the website",
};
/** What each template shows. */
export const VARIANT_LAYOUT: Record<VariantKey, { photo: boolean; photoSide: boolean; phone: boolean }> = {
  normal: { photo: true, photoSide: false, phone: true },
  hidden: { photo: true, photoSide: false, phone: false },
  side: { photo: true, photoSide: true, phone: true },
  sideHidden: { photo: true, photoSide: true, phone: false },
  nophoto: { photo: false, photoSide: false, phone: true },
  nophotoHidden: { photo: false, photoSide: false, phone: false },
};
/** The layout (and so the look) a template belongs to. */
export const lookKeyOf = (key: VariantKey): LookKey => (key.startsWith("side") ? "side" : key.startsWith("nophoto") ? "nophoto" : "normal");
/** Templates without the phone number: the only ones the website may offer. */
export const NO_PHONE_KEYS = VARIANT_KEYS.filter((k) => !VARIANT_LAYOUT[k].phone);
export const isNoPhone = (key: VariantKey) => !VARIANT_LAYOUT[key].phone;

/** The look of one template: its own line spacing and gaps. */
export interface VariantLook {
  /** The size of the text in pt (the name, titles and details scale with it). */
  fontSize: number;
  /** The height of a line of text, as a multiple of the font size. */
  lineSpacing: number;
  spacing: Record<SpacingKey, number>;
  /** The gap above each section (from the block before it, down to the section's line). */
  sectionGap: Record<SectionKey, number>;
  /** The gap between the entries of each section. */
  entryGap: Record<SectionKey, number>;
}

/** What the page builder reads: a template's layout and look together. */
export interface DocOptions extends VariantLook {
  photo: boolean;
  photoSide: boolean;
  phone: boolean;
}

export interface CvDoc {
  header: DocHeader;
  skills: string;
  interests: string;
  sections: DocSection[];
  /** The look of each layout (a phone-hidden template shares its layout's look). */
  variants: Record<LookKey, VariantLook>;
}

/** One template of a CV, ready to be drawn: the content and that template's options. */
export interface PageDoc {
  header: DocHeader;
  skills: string;
  interests: string;
  sections: DocSection[];
  options: DocOptions;
}

export const defaultLook = (): VariantLook => ({
  fontSize: DEFAULT_FONT_SIZE,
  lineSpacing: DEFAULT_LINE_SPACING,
  spacing: { ...DEFAULT_SPACING },
  sectionGap: Object.fromEntries(SECTION_KEYS.map((k) => [k, DEFAULT_SECTION_GAP])) as Record<SectionKey, number>,
  entryGap: Object.fromEntries(SECTION_KEYS.map((k) => [k, DEFAULT_ENTRY_GAP])) as Record<SectionKey, number>,
});

/** One template of a CV, ready to be drawn. */
export function forVariant(doc: CvDoc, key: VariantKey): PageDoc {
  return { header: doc.header, skills: doc.skills, interests: doc.interests, sections: doc.sections, options: { ...structuredClone(doc.variants[lookKeyOf(key)]), ...VARIANT_LAYOUT[key] } };
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const blankEntry = (): DocEntry => ({ show: true, title: "", org: "", location: "", period: "", intro: "", lines: [], papers: [], moreUrl: "", badge: "" });
export const blankPaper = (): DocPaper => ({ label: "Paper", title: "", detail: "" });

function entryFromRaw(raw: unknown): DocEntry {
  const r = obj(raw);
  return {
    show: r.show !== false,
    title: str(r.title), org: str(r.org), location: str(r.location), period: str(r.period), intro: str(r.intro),
    lines: list(r.lines).map(str).filter((l) => l.trim() !== ""),
    papers: list(r.papers).map((p) => {
      const q = obj(p);
      return { label: str(q.label) || "Paper", title: str(q.title), detail: str(q.detail) };
    }),
    moreUrl: str(r.moreUrl), badge: str(r.badge),
  };
}

/** A layout's look from the file. A file saved before the layouts had their own looks has one look (in `options`): all three start from it. */
function lookFromRaw(own: Record<string, unknown>, legacy: Record<string, unknown>): VariantLook {
  const o = Object.keys(own).length ? own : legacy;
  const n = Number(o.lineSpacing);
  const old = obj(o.spacing).betweenEntries; // files from before each section had its own gaps had one "betweenEntries" gap
  return {
    // files from before the font size had its own control have a "smaller text" switch (10 pt)
    fontSize: (() => {
      const n = Number(o.fontSize);
      return Number.isFinite(n) && n >= FONT_SIZE_RANGE[0] && n <= FONT_SIZE_RANGE[1] ? Math.round(n * 10) / 10 : o.compact === true ? 10 : DEFAULT_FONT_SIZE;
    })(),
    lineSpacing: Number.isFinite(n) && n >= LINE_SPACING_RANGE[0] && n <= LINE_SPACING_RANGE[1] ? Math.round(n * 100) / 100 : DEFAULT_LINE_SPACING,
    spacing: Object.fromEntries(SPACING_KEYS.map((k) => [k, spacingValue(obj(o.spacing)[k], DEFAULT_SPACING[k])])) as Record<SpacingKey, number>,
    sectionGap: Object.fromEntries(SECTION_KEYS.map((k) => [k, spacingValue(obj(o.sectionGap)[k], spacingValue(old, DEFAULT_SECTION_GAP))])) as Record<SectionKey, number>,
    entryGap: Object.fromEntries(SECTION_KEYS.map((k) => [k, spacingValue(obj(o.entryGap)[k], spacingValue(old, DEFAULT_ENTRY_GAP))])) as Record<SectionKey, number>,
  };
}

export function docFromRaw(raw: unknown): CvDoc {
  const r = obj(raw);
  const h = obj(r.header);
  const given = new Map(list(r.sections).map((s) => [str(obj(s).key), obj(s)]));
  // Every known section is there, in the order of the file; a section the file lacks is added at the end, hidden.
  const keys = [...list(r.sections).map((s) => str(obj(s).key)).filter((k): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k)), ...SECTION_KEYS];
  const sections = [...new Set(keys)].map((key): DocSection => {
    const s = given.get(key);
    return { key, title: str(s?.title) || SECTION_TITLES[key], show: s ? s.show !== false : false, entries: list(s?.entries).map(entryFromRaw) };
  });
  return {
    header: {
      name: str(h.name), photo: str(h.photo), email: str(h.email), phone: str(h.phone), birth: str(h.birth), licence: str(h.licence),
      location: str(h.location), origin: str(h.origin), languages: str(h.languages), website: str(h.website), linkedin: str(h.linkedin),
    },
    skills: str(r.skills),
    interests: str(r.interests),
    sections,
    variants: Object.fromEntries(LOOK_KEYS.map((k) => [k, lookFromRaw(obj(obj(r.variants)[k]), obj(r.options))])) as Record<LookKey, VariantLook>,
  };
}

export const parseDoc = (text: string): CvDoc => docFromRaw(YAML.parse(text));
export const stringifyDoc = (doc: CvDoc): string => YAML.stringify(doc, { lineWidth: 0, singleQuote: true });

/** A new list with one item moved one place up (-1) or down (+1). */
export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const next = items.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** What the page shows: shown sections with their shown entries (a section without entries is left out). */
export function shownSections(doc: { sections: DocSection[] }): DocSection[] {
  return doc.sections
    .filter((s) => s.show)
    .map((s) => ({ ...s, entries: s.entries.filter((e) => e.show) }))
    .filter((s) => s.entries.length > 0);
}

/** The small note in the phone's place when the number is hidden. */
export const PHONE_HIDDEN_NOTE = "Hidden in web version";

export interface ContactCell {
  icon: string;
  text: string;
  col: number;
  row: number;
  kind?: "origin" | "place" | "hidden";
}

/** The age on a day, from a birth date written 20/06/1994 (or 1994-06-20); null if it can't be read. */
export function ageOn(birth: string, today: Date): number | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(birth.trim()) ?? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(birth.trim());
  if (!m) return null;
  const [day, month, year] = m[1].length === 4 ? [Number(m[3]), Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** The birth date as shown on the CV, with the age worked out from it: "20/06/1994 (32)". As written if it can't be read. */
export function birthWithAge(birth: string, today: Date): string {
  const age = ageOn(birth, today);
  return age === null ? birth : `${birth.trim()} (${age})`;
}

/**
 * The contact block of the "photo on the left" templates, which have less room: 4 columns by 3 rows.
 * Column 1: email, phone (or its note), birth date with the age worked out from it (20/06/1994 (32)).
 * Column 2: driving licence, website, LinkedIn. Column 3: the languages, one per row. Column 4: only the location, with
 * "from Portugal" under it.
 */
function sideContactCells(doc: Pick<PageDoc, "header" | "options">, today: Date): ContactCell[] {
  const h = doc.header;
  const phone: ContactCell = doc.options.phone && h.phone.trim()
    ? { icon: "phone", text: h.phone, col: 1, row: 2 }
    : { icon: "phone", text: PHONE_HIDDEN_NOTE, col: 1, row: 2, kind: "hidden" };
  const languages = h.languages.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const cells: ContactCell[] = [
    { icon: "mail", text: h.email, col: 1, row: 1 },
    phone,
    { icon: "cake", text: birthWithAge(h.birth, today), col: 1, row: 3 },
    { icon: "car", text: h.licence, col: 2, row: 1 },
    { icon: "world", text: h.website, col: 2, row: 2 },
    { icon: "brand-linkedin", text: h.linkedin, col: 2, row: 3 },
    ...languages.map((l, i) => ({ icon: "language", text: l, col: 3, row: i + 1 })),
  ].filter((c) => c.text.trim() !== "");
  if (h.location.trim()) cells.push({ icon: "map-pin", text: h.location, col: 4, row: 1, kind: "place" });
  if (h.origin.trim()) cells.push({ icon: "", text: h.origin, col: 4, row: 2, kind: "origin" });
  return cells;
}

/**
 * The contact block under the name: 5 columns. Row 1: email, phone, birth date, licence (the phone's place stays when it is
 * hidden, with a small note). Row 2 on: languages, website, LinkedIn. Column 5: the location, with "from Portugal" under it.
 */
export function contactCells(doc: Pick<PageDoc, "header" | "options">, today: Date = new Date()): ContactCell[] {
  if (doc.options.photoSide && doc.options.photo) return sideContactCells(doc, today);
  const h = doc.header;
  const phone: ContactCell = doc.options.phone && h.phone.trim()
    ? { icon: "phone", text: h.phone, col: 2, row: 1 }
    : { icon: "phone", text: PHONE_HIDDEN_NOTE, col: 2, row: 1, kind: "hidden" };
  const personal: ContactCell[] = [
    { icon: "mail", text: h.email, col: 1, row: 1 },
    phone,
    { icon: "cake", text: birthWithAge(h.birth, today), col: 3, row: 1 },
    { icon: "car", text: h.licence, col: 4, row: 1 },
  ];
  const more = [
    ...h.languages.split(",").map((l) => ({ icon: "language", text: l.trim() })),
    { icon: "world", text: h.website },
    { icon: "brand-linkedin", text: h.linkedin },
  ].filter((c) => c.text.trim());
  const cells: ContactCell[] = [
    ...personal.filter((c) => c.text.trim()),
    ...more.map((c, i) => ({ ...c, col: (i % 4) + 1, row: 2 + Math.floor(i / 4) })),
  ];
  if (h.location.trim()) cells.push({ icon: "map-pin", text: h.location, col: 5, row: 1, kind: "place" });
  if (h.origin.trim()) cells.push({ icon: "", text: h.origin, col: 5, row: 2, kind: "origin" });
  return cells;
}

