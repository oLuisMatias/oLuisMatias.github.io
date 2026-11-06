// The skill groups and the languages of the CV page (src/data/skills.yml, edited in the CV Page Editor). Every field has a
// default, so a missing or half-written file never breaks the page.
import YAML from "yaml";

export interface SkillGroup {
  group: string;
  items: string[];
}
export interface Language {
  name: string;
  level: string;
}
export interface Skills {
  skills: SkillGroup[];
  languages: Language[];
}

export const DEFAULT_SKILLS: Skills = { skills: [], languages: [] };

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function skillsFromRaw(raw: unknown): Skills {
  const r = obj(raw);
  return {
    skills: (Array.isArray(r.skills) ? r.skills : []).map((g) => {
      const o = obj(g);
      return { group: str(o.group), items: (Array.isArray(o.items) ? o.items : []).map(str).filter(Boolean) };
    }),
    languages: (Array.isArray(r.languages) ? r.languages : []).map((l) => {
      const o = obj(l);
      return { name: str(o.name), level: str(o.level) };
    }),
  };
}

export const parseSkills = (text: string): Skills => skillsFromRaw(YAML.parse(text));
/** The file text. Empty skills, groups and languages are left out. */
export function stringifySkills(skills: Skills): string {
  const clean: Skills = {
    skills: skills.skills
      .map((g) => ({ group: g.group.trim(), items: g.items.map((i) => i.trim()).filter(Boolean) }))
      .filter((g) => g.group || g.items.length),
    languages: skills.languages.map((l) => ({ name: l.name.trim(), level: l.level.trim() })).filter((l) => l.name),
  };
  return YAML.stringify(clean, { lineWidth: 0 });
}

const CODES: Record<string, string> = { portuguese: "PT", english: "EN", spanish: "ES", french: "FR", german: "DE", italian: "IT", slovak: "SK", polish: "PL" };
/** "Portuguese" -> "PT"; an unknown language shows its first two letters. */
export const langCode = (name: string) => CODES[name.toLowerCase()] ?? name.slice(0, 2).toUpperCase();
