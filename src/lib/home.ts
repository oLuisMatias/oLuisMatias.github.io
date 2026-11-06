// The texts and the featured-projects choice of the home page (src/data/home.yml), edited in the Home Page Editor.
// Every field has a default, so a missing or half-written file never breaks the page.
import YAML from "yaml";

export type Template = "1x2" | "1x3" | "2x2" | "2x3";

/** The templates of the featured section: rows x columns. On a phone they are one column. */
export const TEMPLATES: Record<Template, { rows: number; columns: number }> = {
  "1x2": { rows: 1, columns: 2 },
  "1x3": { rows: 1, columns: 3 },
  "2x2": { rows: 2, columns: 2 },
  "2x3": { rows: 2, columns: 3 },
};
export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as Template[];
export const slotCount = (template: Template) => TEMPLATES[template].rows * TEMPLATES[template].columns;

export interface Home {
  /** The small line above the greeting. */
  status: string;
  greeting: string;
  headline: string;
  intro: string;
  featured: { eyebrow: string; title: string; template: Template; /** Project names, one per box; "" is an empty box. */ slots: string[] };
  prints: { eyebrow: string; title: string };
  about: { eyebrow: string; title: string; text: string };
  cta: { title: string; text: string };
}

export const DEFAULT_HOME: Home = {
  status: "Mechanical Design Engineer",
  greeting: "Hi, I'm Luis.",
  headline: "I design machines for a living, and build my own for fun.",
  intro: "",
  featured: { eyebrow: "Featured work", title: "Things I've built", template: "1x3", slots: ["", "", ""] },
  prints: { eyebrow: "Workshop", title: "Latest 3D prints" },
  about: { eyebrow: "About", title: "Why I build things", text: "" },
  cta: { title: "Let's talk engineering and 3D printing.", text: "Open to opportunities in mechanical design, collaborations or just a chat." },
};

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Pad or trim the chosen projects to the number of boxes of a template; the first ones stay where they are. */
export function slotsFor(template: Template, slots: unknown): string[] {
  const list = Array.isArray(slots) ? slots.map((s) => (typeof s === "string" ? s : "")) : [];
  return Array.from({ length: slotCount(template) }, (_, i) => list[i] ?? "");
}

export function homeFromRaw(raw: unknown): Home {
  const r = obj(raw);
  const d = DEFAULT_HOME;
  const f = obj(r.featured);
  const template: Template = typeof f.template === "string" && f.template in TEMPLATES ? (f.template as Template) : d.featured.template;
  return {
    status: str(r.status, d.status),
    greeting: str(r.greeting, d.greeting),
    headline: str(r.headline, d.headline),
    intro: str(r.intro, d.intro),
    featured: {
      eyebrow: str(f.eyebrow, d.featured.eyebrow),
      title: str(f.title, d.featured.title),
      template,
      slots: slotsFor(template, f.slots),
    },
    prints: { eyebrow: str(obj(r.prints).eyebrow, d.prints.eyebrow), title: str(obj(r.prints).title, d.prints.title) },
    about: { eyebrow: str(obj(r.about).eyebrow, d.about.eyebrow), title: str(obj(r.about).title, d.about.title), text: str(obj(r.about).text, d.about.text) },
    cta: { title: str(obj(r.cta).title, d.cta.title), text: str(obj(r.cta).text, d.cta.text) },
  };
}

export const parseHome = (text: string): Home => homeFromRaw(YAML.parse(text));

export const stringifyHome = (home: Home): string => YAML.stringify(home, { lineWidth: 0, singleQuote: true });

/** Change the template: the projects already chosen stay in their order. */
export function withTemplate(home: Home, template: Template): Home {
  return { ...home, featured: { ...home.featured, template, slots: slotsFor(template, home.featured.slots) } };
}
