import YAML from "yaml";
import { marked } from "marked";
import { getCollection, type CollectionKey } from "astro:content";

// Imported as raw text so the dev server reloads when these files change.
import siteYml from "../data/site.yml?raw";
import toolsYml from "../data/tools.yml?raw";

export type Site = {
  name: string;
  role: string;
  headline: string;
  intro: string;
  location: string;
  photo: string;
  about: string;
  email: string;
  linkedin: string;
  cvPdf: string;
  highlights: { label: string; value: string }[];
  skills: { group: string; items: string[] }[];
  languages: { name: string; level: string }[];
  printCategories: string[];
  emailjs: { publicKey: string; serviceId: string; contactTemplateId: string; printTemplateId: string };
};
export type Tool = { id: string; name: string; icon: string };

export const site: Site = YAML.parse(siteYml);
export const tools: Tool[] = YAML.parse(toolsYml).tools ?? [];
const toolMap = new Map(tools.map((t) => [t.id, t]));

/** Look up tools by id; unknown ids still show as a plain label. */
export const toolsFor = (ids: string[] = []): Tool[] =>
  ids.map((id) => toolMap.get(id) ?? { id, name: id, icon: "" });

/** Visible entries of a collection, sorted by their `order` field. */
export async function visible<C extends CollectionKey>(name: C) {
  const all = await getCollection(name, ({ data }) => (data as { visible?: boolean }).visible !== false);
  return all.sort((a, b) => ((a.data as { order: number }).order ?? 100) - ((b.data as { order: number }).order ?? 100));
}

export const md = (text = "") => marked.parse(text, { async: false }) as string;
export const mdInline = (text = "") => marked.parseInline(text, { async: false }) as string;

/** "https://youtu.be/ID?x" or "watch?v=ID" -> "ID" */
export function youtubeId(url = "") {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : "";
}

/** Short reference codes like P-001, used as blueprint-style labels. */
export const code = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, "0")}`;

/** "Download CV" link: the PDF set in Site settings of the content editor. */
export const cvHref = site.cvPdf;

/** Inline padding for the image sides chosen in the admin ("Space around image"). */
export function spacingStyle(sides: string[] = []) {
  return sides.map((side) => `padding-${side}: 5%`).join("; ");
}
