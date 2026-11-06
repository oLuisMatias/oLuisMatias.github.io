// The cards of the CV page, as the CV Page Editor sees them: Work, Education, Other experience and Certifications.
// Every card is one file (src/content/<section>/*.yml); the order on the page is each file's `order` number.
// The sections name some fields differently, so a Card uses one set of names for all of them and the two functions
// below translate. Fields the editor doesn't know are kept as they were.
import YAML from "yaml";

export type Section = "work" | "education" | "experiences" | "certifications";
export const SECTIONS: readonly Section[] = ["work", "education", "experiences", "certifications"];
export const DEFAULT_KIND = "Paper";

/** A line under the card's text: a label ("Paper", or whatever Luis writes) followed by text, optionally a link. */
export interface Paper {
  kind: string;
  title: string;
  url: string;
}

export interface Card {
  /** The file's name inside its folder, e.g. "04-inegi-research-fellow.yml". */
  file: string;
  /** Job title, degree, role or certification name. */
  title: string;
  /** Company, institution, organization or issuer. */
  org: string;
  link: string;
  location: string;
  /** The period, or the date of a certification. */
  period: string;
  /** The logo, or the badge of a certification. */
  logo: string;
  /** Work and other experience: the bullet points. */
  lines: string[];
  /** Education: the short text under the heading. */
  details: string;
  /** Other experience: the label in front of the title (Volunteer, Internship…). */
  kind: string;
  /** Certification: the credential id, the certificate file and the verification address (a file or a web address). */
  id: string;
  pdf: string;
  verify: string;
  papers: Paper[];
  tools: string[];
  visible: boolean;
  /** Everything else in the file (country, ...), written back unchanged. */
  extra: Record<string, unknown>;
}

type Field = "title" | "org" | "link" | "location" | "period" | "logo" | "lines" | "details" | "kind" | "id" | "pdf" | "verify" | "papers" | "tools";

/** The name each card field has in the section's files. A field a section doesn't have isn't listed. */
const FILE_KEY: Record<Section, Partial<Record<Field, string>>> = {
  work: { title: "title", org: "company", link: "link", location: "location", period: "period", logo: "logo", lines: "responsibilities", papers: "papers", tools: "tools" },
  education: { title: "degree", org: "institution", link: "link", location: "location", period: "period", logo: "logo", details: "details", papers: "papers", tools: "tools" },
  experiences: { kind: "type", title: "title", org: "organization", link: "link", location: "location", period: "period", logo: "logo", lines: "description" },
  certifications: { title: "title", org: "issuer", period: "date", id: "credentialId", logo: "badge", pdf: "pdf", verify: "verify", tools: "tools" },
};

/** The order the fields are written in. */
const ORDER: Record<Section, (Field | "extra")[]> = {
  work: ["title", "org", "link", "location", "extra", "period", "logo", "lines", "papers", "tools"],
  education: ["title", "org", "period", "location", "extra", "link", "logo", "details", "papers", "tools"],
  experiences: ["kind", "title", "org", "period", "link", "location", "extra", "logo", "lines"],
  certifications: ["title", "org", "period", "id", "logo", "pdf", "verify", "tools"],
};

/** Always written, even when empty. */
const REQUIRED = new Set<Field>(["title", "org", "period"]);

const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = (v: unknown) => (Array.isArray(v) ? v.map(text) : []);

/** A card from the data of a file (already read by Astro or by YAML). */
export function cardFromData(section: Section, data: unknown, file = ""): Card {
  const d = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const key = FILE_KEY[section];
  const get = (f: Field) => (key[f] ? d[key[f]!] : undefined);
  const owned = new Set<string>([...Object.values(key), "visible", "order"]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (!owned.has(k)) extra[k] = v;
  const papers = Array.isArray(get("papers")) ? (get("papers") as unknown[]) : [];
  return {
    file,
    title: text(get("title")),
    org: text(get("org")),
    link: text(get("link")),
    location: text(get("location")),
    period: text(get("period")),
    logo: text(get("logo")),
    lines: list(get("lines")),
    details: text(get("details")),
    kind: text(get("kind")),
    id: text(get("id")),
    pdf: text(get("pdf")),
    verify: text(get("verify")),
    papers: papers.map((p) => {
      const r = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
      return { kind: typeof r.kind === "string" ? r.kind : DEFAULT_KIND, title: text(r.title), url: text(r.url) };
    }),
    tools: list(get("tools")),
    visible: d.visible !== false,
    extra,
  };
}

export const cardFromText = (section: Section, source: string, file: string): Card => cardFromData(section, YAML.parse(source), file);

/** The text of the card's file. `order` is its place on the page (1 = first). */
export function cardToText(section: Section, card: Card, order: number): string {
  const key = FILE_KEY[section];
  const out: Record<string, unknown> = {};
  for (const f of ORDER[section]) {
    if (f === "extra") { Object.assign(out, card.extra); continue; }
    const name = key[f];
    if (!name) continue;
    if (f === "lines") out[name] = card.lines;
    else if (f === "papers") {
      if (card.papers.length) out[name] = card.papers.map((p) => ({ ...(p.kind === DEFAULT_KIND ? {} : { kind: p.kind }), title: p.title, url: p.url }));
    } else if (f === "tools") {
      if (card.tools.length) out[name] = card.tools;
    } else {
      const value = card[f];
      if (value || REQUIRED.has(f) || f === "location") out[name] = value;
    }
  }
  out.visible = card.visible;
  out.order = order;
  return YAML.stringify(out, { lineWidth: 0 });
}

/** A file name that no other card uses. */
export function newFileName(cards: Card[]): string {
  const taken = new Set(cards.map((c) => c.file));
  for (let n = 1; ; n++) {
    const name = `new-card-${n}.yml`;
    if (!taken.has(name)) return name;
  }
}

const BLANK: Record<Section, Pick<Card, "title" | "org" | "period" | "location" | "kind">> = {
  work: { title: "Job title", org: "Company", period: "Year - Year", location: "City, Country", kind: "" },
  education: { title: "Degree", org: "Institution", period: "Year - Year", location: "City, Country", kind: "" },
  experiences: { title: "Role", org: "Organization", period: "Year", location: "City, Country", kind: "Volunteer" },
  certifications: { title: "Certification", org: "Issuer", period: "Month Year", location: "", kind: "" },
};

export function blankCard(section: Section, cards: Card[]): Card {
  return {
    file: newFileName(cards),
    ...BLANK[section],
    link: "",
    logo: "",
    lines: [],
    details: "",
    id: "",
    pdf: "",
    verify: "",
    papers: [],
    tools: [],
    visible: true,
    extra: {},
  };
}

/** A new blank card at a place in the list: 0 is the top, cards.length the end. */
export function addCard(section: Section, cards: Card[], at: number): Card[] {
  const next = cards.slice();
  next.splice(Math.max(0, Math.min(at, cards.length)), 0, blankCard(section, cards));
  return next;
}

export function removeCard(cards: Card[], index: number): Card[] {
  return cards.filter((_, i) => i !== index);
}

/** Move a card one place up (-1) or down (+1). */
export function moveCard(cards: Card[], index: number, dir: -1 | 1): Card[] {
  const to = index + dir;
  if (index < 0 || index >= cards.length || to < 0 || to >= cards.length) return cards;
  const next = cards.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** The cards as files: the list to write (name and text) in page order. */
export const cardFiles = (section: Section, cards: Card[]) => cards.map((c, i) => ({ file: c.file, text: cardToText(section, c, i + 1) }));

/** Add a tool to a card, or take it out. */
export function toggleTool(card: Pick<Card, "tools">, id: string): string[] {
  return card.tools.includes(id) ? card.tools.filter((t) => t !== id) : [...card.tools, id];
}
