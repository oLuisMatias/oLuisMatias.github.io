// The Projects page: its texts, how many columns the projects are shown in, and which date order it opens with
// (src/data/projects-page.yml, edited in the Project Page Editor). Every field has a default, so a missing or
// half-written file never breaks the page.
import YAML from "yaml";

export const COLUMN_CHOICES = [1, 2, 3, 4] as const;
export type Sort = "newest" | "oldest";
export const SORT_LABELS: Record<Sort, string> = { newest: "Newest first", oldest: "Oldest first" };

export interface ProjectsPage {
  eyebrow: string;
  title: string;
  intro: string;
  /** How many projects side by side. The rows follow from the number of projects. */
  columns: number;
  /** The date order the page opens with; visitors can switch it. */
  sort: Sort;
}

export const DEFAULT_PROJECTS_PAGE: ProjectsPage = {
  eyebrow: "Work",
  title: "Projects",
  intro: "Personal builds, from CAD model to working machine.",
  columns: 3,
  sort: "newest",
};

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

export function projectsPageFromRaw(raw: unknown): ProjectsPage {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PROJECTS_PAGE;
  const columns = Number(r.columns);
  return {
    eyebrow: str(r.eyebrow, d.eyebrow),
    title: str(r.title, d.title),
    intro: str(r.intro, d.intro),
    columns: (COLUMN_CHOICES as readonly number[]).includes(columns) ? columns : d.columns,
    sort: r.sort === "oldest" ? "oldest" : "newest",
  };
}

export const parseProjectsPage = (text: string): ProjectsPage => projectsPageFromRaw(YAML.parse(text));
export const stringifyProjectsPage = (page: ProjectsPage): string => YAML.stringify(page, { lineWidth: 0, singleQuote: true });

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "March 2025" -> a number that grows with time; "2025" counts as January; no year (or no date) -> null. */
export function dateKey(text: string): number | null {
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  const month = MONTHS.findIndex((m) => new RegExp(`\\b${m}`, "i").test(text));
  return Number(year) * 12 + Math.max(0, month);
}

/** Order projects by the date written on them. Projects without a date go last, and equal dates keep their order. */
export function sortProjects<T>(items: T[], sort: Sort, dateOf: (item: T) => string): T[] {
  const keyed = items.map((item, index) => ({ item, index, key: dateKey(dateOf(item)) }));
  keyed.sort((a, b) => {
    if (a.key === null && b.key === null) return a.index - b.index;
    if (a.key === null) return 1;
    if (b.key === null) return -1;
    return (sort === "newest" ? b.key - a.key : a.key - b.key) || a.index - b.index;
  });
  return keyed.map((k) => k.item);
}
