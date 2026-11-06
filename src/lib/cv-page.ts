// Layout choices of the CV page (src/data/cv-page.yml, edited in the CV Page Editor): how many columns the certifications
// are shown in. Every field has a default, so a missing or half-written file never breaks the page.
import YAML from "yaml";

export const COLUMN_CHOICES = [1, 2, 3] as const;

export interface CvPage {
  /** How many certifications side by side. The rows follow from the number of certifications. */
  certColumns: number;
}

export const DEFAULT_CV_PAGE: CvPage = { certColumns: 2 };

export function cvPageFromRaw(raw: unknown): CvPage {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const n = Number(r.certColumns);
  return { certColumns: (COLUMN_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_CV_PAGE.certColumns };
}

export const parseCvPage = (text: string): CvPage => cvPageFromRaw(YAML.parse(text));
export const stringifyCvPage = (page: CvPage): string => YAML.stringify(page, { lineWidth: 0 });
