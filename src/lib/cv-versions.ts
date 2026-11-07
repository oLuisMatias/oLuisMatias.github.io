// The saved CVs (src/data/cv-versions.yml, edited in the CV Builder): every version is a PDF with a number, a date and a
// note. One of them is "in use": the CV page of the website offers that PDF for download.
// Every field has a default, so a missing or half-written file never breaks the site.
import YAML from "yaml";
import { VARIANT_KEYS, isNoPhone, type VariantKey } from "./cv-document";

export const TAGS = ["Generic", "Application", "Imported", "Other"] as const;
export const VERSIONS_FOLDER = "/data/cvs/";

export interface CvVersion {
  id: number;
  /** The day it was saved, YYYY-MM-DD. */
  date: string;
  tag: string;
  note: string;
  /** The version it was made from, if any. */
  from: number | null;
  /** The PDF of the "normal" template (or the only PDF of a CV that was uploaded); empty until it is made. */
  pdf: string;
  /** The PDFs of the other five templates of a built CV. */
  pdfs: Partial<Record<Exclude<VariantKey, "normal">, string>>;
  /** True when the content of this CV is saved (src/data/cv-docs/v<id>.yml), so it can be drawn and copied into a new version. */
  doc: boolean;
  /**
   * A finished CV (in use in applications): it can no longer be edited, only copied into a new version. A version that is not
   * locked is a draft: "Edit" changes it in place. Putting a CV on the website locks it.
   */
  locked: boolean;
  /** The days it was put on the website and taken off again (YYYY-MM-DD), for the history. */
  liveFrom: string;
  liveTo: string;
}

export interface CvVersions {
  /** The id of the version in use on the website. */
  live: number | null;
  /** Which of its templates the website offers: one without the phone number. Empty for an uploaded CV (it has just one PDF). */
  liveTemplate: VariantKey | null;
  versions: CvVersion[];
}

export const EMPTY_VERSIONS: CvVersions = { live: null, liveTemplate: null, versions: [] };

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const day = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");

export function versionsFromRaw(raw: unknown): CvVersions {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const seen = new Set<number>();
  const versions: CvVersion[] = [];
  for (const item of Array.isArray(r.versions) ? r.versions : []) {
    const v = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id = Number(v.id);
    const pdf = str(v.pdf);
    const doc = v.doc === true;
    if (!Number.isInteger(id) || id < 1 || seen.has(id) || (!pdf && !doc)) continue;
    const others = Object.fromEntries(VARIANT_KEYS.filter((k) => k !== "normal" && str((v.pdfs as Record<string, unknown> | undefined)?.[k])).map((k) => [k, str((v.pdfs as Record<string, unknown>)[k])]));
    seen.add(id);
    const from = Number(v.from);
    versions.push({
      id, date: day(v.date), tag: str(v.tag) || "Other", note: str(v.note),
      from: Number.isInteger(from) && from >= 1 ? from : null, pdf, pdfs: others, doc, locked: v.locked === true || !doc, liveFrom: day(v.liveFrom), liveTo: day(v.liveTo),
    });
  }
  const live = Number(r.live);
  const template = str(r.liveTemplate) as VariantKey;
  return { live: seen.has(live) ? live : null, liveTemplate: (VARIANT_KEYS as readonly string[]).includes(template) && isNoPhone(template) ? template : null, versions };
}

export const parseVersions = (text: string): CvVersions => versionsFromRaw(YAML.parse(text));
export const stringifyVersions = (s: CvVersions): string => YAML.stringify({ live: s.live, liveTemplate: s.liveTemplate, versions: s.versions }, { lineWidth: 0, singleQuote: true });

/** The number shown as "v1", "v2"...: the oldest CV is v1. Same day: the one added first. `id` stays the same when numbers change. */
export type Numbered = CvVersion & { n: number };
export const numbered = (list: CvVersion[]): Numbered[] =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map((v, i) => ({ ...v, n: i + 1 }));

/** Newest first, with their numbers. */
export const newestFirst = (list: CvVersion[]): Numbered[] => numbered(list).reverse();

/** The number of a version, by its id. */
export const numberOf = (s: CvVersions, id: number): number => numbered(s.versions).find((v) => v.id === id)?.n ?? 0;

export const liveVersion = (s: CvVersions) => s.versions.find((v) => v.id === s.live) ?? null;

export const nextId = (s: CvVersions) => s.versions.reduce((m, v) => Math.max(m, v.id), 0) + 1;

export function addVersion(s: CvVersions, v: Omit<CvVersion, "id" | "liveFrom" | "liveTo" | "locked" | "pdfs"> & { locked?: boolean; pdfs?: CvVersion["pdfs"] }): { state: CvVersions; id: number } {
  const id = nextId(s);
  return { id, state: { ...s, versions: [...s.versions, { locked: false, pdfs: {}, ...v, id, liveFrom: "", liveTo: "" }] } };
}

/**
 * Put a version on the website, offering one of its templates without the phone number (a built CV; an uploaded one has just its
 * one PDF). The one that was there records the day it was taken off. The same version can change template without a new date.
 */
export function makeLive(s: CvVersions, id: number, today: string, template: VariantKey | null = null): CvVersions {
  const v = s.versions.find((x) => x.id === id);
  if (!v) return s;
  const chosen = v.doc ? (template && isNoPhone(template) && pdfOf(v, template) ? template : null) : null;
  if (v.doc && !chosen) return s; // a built CV needs one of its phone-hidden PDFs
  if (s.live === id) return s.liveTemplate === chosen ? s : { ...s, liveTemplate: chosen };
  return {
    live: id,
    liveTemplate: chosen,
    versions: s.versions.map((x) => (x.id === s.live ? { ...x, liveTo: today } : x.id === id ? { ...x, liveFrom: today, liveTo: "", locked: true } : x)),
  };
}

/** Lock a draft: from now on it can only be copied, not changed. */
export function lockVersion(s: CvVersions, id: number): CvVersions {
  return { ...s, versions: s.versions.map((v) => (v.id === id ? { ...v, locked: true } : v)) };
}

/** Change a draft's details (its content and PDF are saved separately). A locked version is left as it is. */
export function updateDraft(s: CvVersions, id: number, change: Partial<Pick<CvVersion, "date" | "tag" | "note" | "from" | "pdf" | "pdfs">>): CvVersions {
  return { ...s, versions: s.versions.map((v) => (v.id === id && !v.locked ? { ...v, ...change } : v)) };
}

/** Delete a version. The one in use cannot be deleted: put another one on the website first. */
export function removeVersion(s: CvVersions, id: number): CvVersions {
  if (s.live === id) return s;
  return { ...s, versions: s.versions.filter((v) => v.id !== id) };
}

/** The end of a template's PDF file name: "v7.pdf" for the normal one, "v7-hidden.pdf", "v7-side-hidden.pdf"... for the others. */
const FILE_SUFFIX: Record<VariantKey, string> = { normal: "", hidden: "-hidden", side: "-side", sideHidden: "-side-hidden", nophoto: "-nophoto", nophotoHidden: "-nophoto-hidden" };
export const pdfFileName = (id: number, variant: VariantKey = "normal") => `v${id}${FILE_SUFFIX[variant]}.pdf`;

/** The PDF of one template of a version, if it has one. A CV that was only uploaded has just the one PDF. */
export const pdfOf = (v: Pick<CvVersion, "pdf" | "pdfs">, variant: VariantKey): string => (variant === "normal" ? v.pdf : v.pdfs[variant as Exclude<VariantKey, "normal">] ?? "");

/** Every PDF file of a version that this tool made (and that goes with the version when it is deleted). */
export const ownPdfs = (v: Pick<CvVersion, "pdf" | "pdfs">): string[] => [v.pdf, ...Object.values(v.pdfs)].filter((p): p is string => !!p && isOwnPdf(p));

/** The PDF the website offers: the one of the chosen phone-hidden template, or an uploaded CV's only PDF. Empty if there is none. */
export const websitePdf = (s: Pick<CvVersions, "live" | "liveTemplate" | "versions">): string => {
  const v = s.versions.find((x) => x.id === s.live);
  if (!v) return "";
  return v.doc ? (s.liveTemplate ? pdfOf(v, s.liveTemplate) : "") : v.pdf;
};

/** Only PDFs this tool uploaded are deleted with their version; a PDF that lives elsewhere (the original CV) is left alone. */
export const isOwnPdf = (pdf: string) => pdf.startsWith(VERSIONS_FOLDER);
