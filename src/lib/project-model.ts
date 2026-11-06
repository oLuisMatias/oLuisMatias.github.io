// A project as the editor handles it: reading a project file, giving every field its default, and writing it back.
// Mirrors the project schema in src/content.config.ts.
//
// A project page is: the header (fixed), the main section and any number of sections. The main section and every
// section are a tree of boxes (see boxes.ts): a box holds one thing, and can be split into columns or rows.
import YAML from "yaml";
import { cleanSizes, isSplit, type Node } from "./boxes";
import { EMPTY, parseContent, sides, str, strs, type Content, type Side } from "./blocks";
import { defaultMainFor, fromFlatBlocks, fromGrid, isGridProject } from "./legacy-project";

export { BLOCK_LABELS, CONTENT_LABELS, EMPTY, newBlock, newContent } from "./blocks";
export type { Block, Content, Side } from "./blocks";

export type Box = Node<Content>;

export interface Project {
  title: string;
  visible: boolean;
  featured: boolean;
  order: number;
  topic: string;
  summary: string;
  date: string;
  cover: string;
  coverSpacing: Side[];
  model: string;
  youtube: string;
  tools: string[];
  skills: string[];
  /** The main section: by default the intro text and the tools box on the left, the model or cover on the right. */
  main: Box;
  sections: Box[];
}

/** The default layout of the main section: 2 columns, the first one split in 2 rows, the second one a single box. */
export const defaultMain = (intro = "Write something here."): Box => defaultMainFor(intro);
export const newSection = (): Box => ({ type: "empty" });

export function newProject(): Project {
  return {
    title: "New project", visible: false, featured: false, order: 100, topic: "", summary: "", date: "",
    cover: "", coverSpacing: [], model: "", youtube: "", tools: [], skills: [],
    main: defaultMain(),
    sections: [],
  };
}

/** A box or a split from a file. A split with one child is that child. */
function parseBox(raw: any): Box {
  if ((raw?.split === "columns" || raw?.split === "rows") && Array.isArray(raw.children) && raw.children.length > 0) {
    const children = raw.children.map(parseBox);
    if (children.length === 1) return children[0];
    return { split: raw.split, sizes: cleanSizes(raw.sizes, children.length), children };
  }
  return parseContent(raw);
}

export const parseProject = (text: string): Project => projectFromRaw(YAML.parse(text) ?? {});

/** Also used by the public page, with the data of the content collection, so the site and the editor read files the same way. */
export function projectFromRaw(raw: any): Project {
  const cover = str(raw.cover);
  const model = str(raw.model);
  const base = {
    title: str(raw.title), visible: raw.visible !== false, featured: raw.featured === true,
    order: typeof raw.order === "number" ? raw.order : 100,
    topic: str(raw.topic), summary: str(raw.summary), date: str(raw.date), cover,
    coverSpacing: sides(raw.coverSpacing), model, youtube: str(raw.youtube),
    tools: strs(raw.tools), skills: strs(raw.skills),
  };
  if (Array.isArray(raw.blocks) && !Array.isArray(raw.sections)) return { ...base, ...fromFlatBlocks(raw.blocks, !!cover || !!model) };
  if (isGridProject(raw) || typeof raw.intro === "string") return { ...base, ...fromGrid(raw) };
  return {
    ...base,
    main: raw.main ? parseBox(raw.main) : defaultMain(),
    sections: (Array.isArray(raw.sections) ? raw.sections : []).map(parseBox),
  };
}

/** A box as it is written in a file: columns keep their sizes, rows don't need any. */
function emitBox(node: Box): unknown {
  if (!isSplit(node)) return node;
  return {
    split: node.split,
    ...(node.split === "columns" ? { sizes: node.sizes } : {}),
    children: node.children.map(emitBox),
  };
}

export function stringifyProject(p: Project): string {
  const out = {
    title: p.title, visible: p.visible, featured: p.featured, order: p.order, topic: p.topic, summary: p.summary,
    date: p.date, cover: p.cover, coverSpacing: p.coverSpacing, model: p.model, youtube: p.youtube,
    tools: p.tools, skills: p.skills,
    main: emitBox(p.main),
    sections: p.sections.map(emitBox),
  };
  return YAML.stringify(out, { lineWidth: 0, singleQuote: true });
}

/** A file name for a new project: "My Cool Machine!" becomes "my-cool-machine". */
export const slugify = (title: string) =>
  title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
