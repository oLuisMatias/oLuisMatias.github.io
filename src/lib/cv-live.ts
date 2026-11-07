// The public CV page shows the CV that is in use (chosen in the CV Builder): its text, its order, and what it hides. This turns
// that CV's content (cv-document.ts) into the cards the page draws (cv.ts, render-cv.ts). A CV's content has no logos, links or
// tool chips, so these come from the CV page's own cards (src/content/work, education, experiences, certifications) when an
// entry matches one: the same company, institution or badge. An entry that matches nothing is just drawn without them.
import { DEFAULT_KIND, type Card, type Section } from "./cv";
import { shownSections, type CvDoc, type DocEntry, type SectionKey } from "./cv-document";

export interface LivePublication {
  title: string;
  url: string;
  where: string;
}

export interface LiveCv {
  work: Card[];
  education: Card[];
  experiences: Card[];
  certifications: Card[];
  publications: LivePublication[];
}

/** Lower case, no accents, only letters and digits. */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

/** How well an entry matches a card: the same organization counts most, then the words of the title. */
function score(entry: DocEntry, card: Card, section: Section): number {
  if (section === "certifications") {
    if (entry.badge && entry.badge === card.logo) return 100;
    const a = words(entry.title);
    return [...words(card.title)].filter((w) => a.has(w)).length;
  }
  const a = norm(entry.org);
  const b = norm(card.org);
  let s = 0;
  if (a && b) s += a === b ? 10 : a.includes(b) || b.includes(a) ? 8 : 0;
  const t = words(entry.title);
  s += [...words(card.title)].filter((w) => t.has(w)).length;
  return s;
}

/** The card an entry matches best and that was not used yet, if any matches well enough. */
function bestCard(entry: DocEntry, cards: Card[], used: Set<Card>, section: Section): Card | undefined {
  let best: Card | undefined;
  let top = 0;
  for (const c of cards) {
    if (used.has(c)) continue;
    const s = score(entry, c, section);
    if (s > top) [best, top] = [c, s];
  }
  return top >= (section === "certifications" ? 2 : 3) ? best : undefined;
}

function toCard(section: Section, e: DocEntry, match: Card | undefined): Card {
  // "Volunteering | Elephant Caretaker": the label in front of the title is the pill of an "other experience"
  const split = section === "experiences" ? /^(.+?)\s*\|\s*(.+)$/.exec(e.title) : null;
  return {
    file: "",
    title: split ? split[2] : e.title,
    org: e.org,
    link: match?.link ?? "",
    location: e.location,
    period: e.period,
    logo: (section === "certifications" ? e.badge : "") || match?.logo || "",
    lines: e.lines.filter((l) => l.trim() !== ""),
    details: e.intro,
    kind: split ? split[1] : "",
    id: match?.id ?? "",
    pdf: match?.pdf ?? "",
    verify: match?.verify ?? "",
    papers: e.papers.filter((p) => p.title.trim()).map((p) => ({ kind: p.label || DEFAULT_KIND, title: p.title, url: match?.papers.find((q) => norm(q.title) === norm(p.title))?.url ?? "" })),
    tools: match?.tools ?? [],
    visible: true,
    extra: {},
  };
}

const SECTION_OF: Partial<Record<SectionKey, Section>> = { work: "work", studies: "education", experiences: "experiences", certifications: "certifications" };

/** The CV page's cards for a CV's content, in that CV's order, without what it hides. `cards` are the page's own cards. */
export function cardsFromDoc(doc: CvDoc, cards: Record<Section, Card[]>): LiveCv {
  const out: LiveCv = { work: [], education: [], experiences: [], certifications: [], publications: [] };
  for (const s of shownSections(doc)) {
    const section = SECTION_OF[s.key];
    if (!section) continue; // "My projects" has its own pages on the site
    const used = new Set<Card>();
    for (const e of s.entries) {
      const match = bestCard(e, cards[section], used, section);
      if (match) used.add(match);
      const card = toCard(section, e, match);
      out[section].push(card);
      // the papers of jobs and studies are also listed under Publications
      if (section === "work" || section === "education") {
        for (const p of card.papers) out.publications.push({ title: p.title, url: p.url, where: `${e.org} · ${e.period}` });
      }
    }
  }
  return out;
}
