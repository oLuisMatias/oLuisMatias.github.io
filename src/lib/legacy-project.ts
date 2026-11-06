// Project files written before boxes existed: one flat list of blocks, and later a grid of columns x rows with
// several items per cell. They are still read and converted into the tree of boxes (see boxes.ts), so old files
// keep opening and nothing in them is lost.
import { EMPTY, parseBlock, str, type Block, type Content } from "./blocks";
import { equalSizes, gridToTree, type Node } from "./boxes";

const clamp3 = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(3, Math.max(1, v)) : 1;
};
const cellItems = (raw: any): unknown[] => (Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []);
const widthsOf = (v: unknown, fallback: string) => (v === "even" || v === "wide-left" || v === "wide-right" ? (v as string) : fallback);

/** The grid had exactly `columns * rows` cells; extra cells' items go into the last one and missing cells are empty. */
function fitCells<T>(cells: T[][], count: number): T[][] {
  const next = Array.from({ length: count }, (_, i) => [...(cells[i] ?? [])]);
  for (let i = count; i < cells.length; i++) next[count - 1].push(...cells[i]);
  return next;
}

/** The grid format has `cells` lists in `main` or in the sections. */
export const isGridProject = (raw: any) => Array.isArray(raw?.main?.cells) || (Array.isArray(raw?.sections) && raw.sections.some((s: any) => Array.isArray(s?.cells)));

export function defaultMainFor(intro: string): Node<Content> {
  return {
    split: "columns",
    sizes: [65, 35],
    children: [{ split: "rows", sizes: equalSizes(2), children: [{ type: "text", text: intro }, { type: "facts" }] }, { type: "media" }],
  };
}

function mainFromGrid(raw: any, intro: string): Node<Content> {
  const columns = clamp3(raw.columns);
  const rows = clamp3(raw.rows);
  const seen = new Set<string>();
  const keep = (x: unknown) => (x === "text" || x === "media" || x === "facts") && !seen.has(x) && !!seen.add(x);
  const cells = fitCells<string>((Array.isArray(raw.cells) ? raw.cells : []).map((c: any) => cellItems(c).filter(keep) as string[]), columns * rows);
  for (const item of ["text", "media", "facts"]) if (!seen.has(item)) cells[0].push(item);
  const content = (item: string): Content => (item === "text" ? { type: "text", text: intro } : { type: item as "media" | "facts" });
  return gridToTree<Content>({ columns, rows, widths: widthsOf(raw.widths, "wide-left"), cells: cells.map((cell) => cell.map(content)) }, EMPTY);
}

function sectionFromGrid(raw: any): Node<Content> {
  const columns = clamp3(raw?.columns);
  const rows = clamp3(raw?.rows);
  const cells = fitCells<Block>(
    (Array.isArray(raw?.cells) ? raw.cells : []).map((c: any) => cellItems(c).map(parseBlock).filter((b: Block | null): b is Block => b !== null)),
    columns * rows,
  );
  return gridToTree<Content>({ columns, rows, widths: widthsOf(raw?.widths, "even"), cells }, EMPTY);
}

/** The grid format: `intro` text, `main` with cells of text/media/facts, and sections with cells of blocks. */
export function fromGrid(raw: any): { main: Node<Content>; sections: Node<Content>[] } {
  const intro = str(raw.intro);
  const main = raw.main && typeof raw.main === "object" ? mainFromGrid(raw.main, intro) : defaultMainFor(intro);
  return { main, sections: (Array.isArray(raw.sections) ? raw.sections : []).map(sectionFromGrid) };
}

/**
 * The oldest format: divider lines between groups and images floated left or right. The first text block is the intro
 * when there is a model or cover, each group between dividers is a section, and a group with a floated image has two
 * columns (the image in the narrow one).
 */
export function fromFlatBlocks(rawBlocks: any[], hasMedia: boolean): { main: Node<Content>; sections: Node<Content>[] } {
  let list = rawBlocks;
  let intro = "";
  if (hasMedia && list[0]?.type === "text") {
    intro = str(list[0].text);
    list = list.slice(1);
  }
  const groups: any[][] = [[]];
  for (const raw of list) {
    if (raw?.type === "divider") groups.push([]);
    else groups[groups.length - 1].push(raw);
  }
  const sections: Node<Content>[] = [];
  for (const group of groups) {
    const blocks = group.map((raw) => ({ raw, block: parseBlock(raw) })).filter((x): x is { raw: any; block: Block } => x.block !== null);
    if (blocks.length === 0) continue;
    const side = blocks.find((x) => x.block.type === "image" && (x.raw.position === "left" || x.raw.position === "right"));
    if (side && blocks.length > 1) {
      const others = blocks.filter((x) => x !== side).map((x) => x.block);
      const imageLeft = side.raw.position === "left";
      sections.push(
        gridToTree<Content>({ columns: 2, rows: 1, widths: imageLeft ? "wide-right" : "wide-left", cells: imageLeft ? [[side.block], others] : [others, [side.block]] }, EMPTY),
      );
    } else {
      sections.push(gridToTree<Content>({ columns: 1, rows: 1, widths: "even", cells: [blocks.map((x) => x.block)] }, EMPTY));
    }
  }
  // Without a model or cover the old page had no media column: the text and the tools box used the full width.
  const main: Node<Content> = hasMedia
    ? defaultMainFor(intro)
    : { split: "rows", sizes: equalSizes(2), children: [{ type: "text", text: intro }, { type: "facts" }] };
  return { main, sections };
}
