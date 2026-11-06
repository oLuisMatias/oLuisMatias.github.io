// The boxes of a project page. A section is a tree: a box holds one thing, and a box can be split into columns or rows,
// and any of those boxes can be split again. These helpers are pure (they never change what you give them and return
// a new tree), so the editor can use them with undo and redo, and the tests can check them.

export type Direction = "columns" | "rows";

export interface Split<L> {
  split: Direction;
  /** Relative widths of the children, for columns. Rows are as tall as their content. */
  sizes: number[];
  children: Node<L>[];
}
export type Node<L> = L | Split<L>;
/** Where a box is: the index to take at each split, from the root. The root itself is []. */
export type Path = number[];

export const isSplit = <L>(node: Node<L>): node is Split<L> => typeof node === "object" && node !== null && "split" in node && Array.isArray((node as Split<L>).children);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const equalSizes = (count: number) => Array.from({ length: count }, () => Math.round(10000 / count) / 100);

/** Sizes that match the number of children and are all positive; otherwise equal parts. */
export function cleanSizes(sizes: unknown, count: number): number[] {
  if (!Array.isArray(sizes) || sizes.length !== count) return equalSizes(count);
  const nums = sizes.map(Number);
  return nums.every((n) => Number.isFinite(n) && n > 0) ? nums : equalSizes(count);
}

/** The CSS for the columns of a split. */
export const columnsStyle = (sizes: number[]) => `grid-template-columns: ${sizes.map((s) => `minmax(0, ${s}fr)`).join(" ")}`;

export const pathKey = (path: Path) => path.join(".");
export const parsePath = (text: string): Path | null => {
  if (text === "") return [];
  const parts = text.split(".").map(Number);
  return parts.every((n) => Number.isInteger(n) && n >= 0) ? parts : null;
};

export function getNode<L>(root: Node<L>, path: Path): Node<L> | undefined {
  let node: Node<L> | undefined = root;
  for (const i of path) {
    if (!node || !isSplit(node)) return undefined;
    node = node.children[i];
  }
  return node;
}

/** Every box (leaf) of a tree in reading order, with where it is. */
export function leaves<L>(root: Node<L>, path: Path = []): { path: Path; leaf: L }[] {
  if (!isSplit(root)) return [{ path, leaf: root }];
  return root.children.flatMap((child, i) => leaves(child, [...path, i]));
}

function replaceAt<L>(root: Node<L>, path: Path, make: (node: Node<L>) => Node<L>): Node<L> {
  if (path.length === 0) return make(root);
  if (!isSplit(root)) return root;
  const [i, ...rest] = path;
  if (!root.children[i]) return root;
  const children = root.children.map((child, k) => (k === i ? replaceAt(child, rest, make) : child));
  return { ...root, children };
}

/** Put something in a box. */
export function setContent<L>(root: Node<L>, path: Path, leaf: L): Node<L> {
  return replaceAt(clone(root), path, (node) => (isSplit(node) ? node : clone(leaf)));
}

/**
 * Divide a box in two. Inside a split that already goes the same way, the new box is added next to it (taking half of
 * its width) instead of nesting another split. The new box is empty.
 */
export function splitBox<L>(root: Node<L>, path: Path, direction: Direction, empty: L): Node<L> {
  const tree = clone(root);
  const parent = path.length ? getNode(tree, path.slice(0, -1)) : undefined;
  if (parent && isSplit(parent) && parent.split === direction) {
    const at = path[path.length - 1];
    parent.children.splice(at + 1, 0, clone(empty));
    const half = parent.sizes[at] / 2;
    parent.sizes.splice(at, 1, half, half);
    return tree;
  }
  return replaceAt(tree, path, (node) => ({ split: direction, sizes: [50, 50], children: [node, clone(empty)] }));
}

/** Remove a box. The others take its space; a split left with one box becomes that box; the last box becomes empty. */
export function deleteBox<L>(root: Node<L>, path: Path, empty: L): Node<L> {
  if (path.length === 0) return clone(empty);
  const tree = clone(root);
  const parentPath = path.slice(0, -1);
  const at = path[path.length - 1];
  return replaceAt(tree, parentPath, (node) => {
    if (!isSplit(node) || !node.children[at]) return node;
    const children = node.children.filter((_, k) => k !== at);
    const sizes = node.sizes.filter((_, k) => k !== at);
    if (children.length === 1) return children[0];
    const total = sizes.reduce((a, b) => a + b, 0) || 1;
    return { ...node, children, sizes: sizes.map((s) => Math.round((s / total) * 10000) / 100) };
  });
}

/** Swap the contents of two boxes. Moving something into an empty box is a swap too. */
export function swapBoxes<L>(root: Node<L>, a: Path, b: Path): Node<L> {
  const first = getNode(root, a);
  const second = getNode(root, b);
  if (first === undefined || second === undefined || isSplit(first) || isSplit(second) || pathKey(a) === pathKey(b)) return root;
  const tree = replaceAt(clone(root), a, () => clone(second));
  return replaceAt(tree, b, () => clone(first));
}

export function setSizes<L>(root: Node<L>, path: Path, sizes: number[]): Node<L> {
  return replaceAt(clone(root), path, (node) => (isSplit(node) && sizes.length === node.children.length ? { ...node, sizes: cleanSizes(sizes, sizes.length) } : node));
}

/** The old grid of columns x rows, as a tree. `widths` only matters for two columns. */
export function gridToTree<L>(
  grid: { columns: number; rows: number; widths: string; cells: L[][] },
  empty: L,
): Node<L> {
  const cell = (items: L[] | undefined): Node<L> => {
    const list = items ?? [];
    if (list.length === 0) return clone(empty);
    if (list.length === 1) return list[0];
    return { split: "rows", sizes: equalSizes(list.length), children: list };
  };
  const sizes = grid.columns === 2 && grid.widths === "wide-left" ? [65, 35] : grid.columns === 2 && grid.widths === "wide-right" ? [35, 65] : equalSizes(grid.columns);
  const row = (r: number): Node<L> => {
    const cells = Array.from({ length: grid.columns }, (_, c) => cell(grid.cells[r * grid.columns + c]));
    return grid.columns === 1 ? cells[0] : { split: "columns", sizes, children: cells };
  };
  const rows = Array.from({ length: grid.rows }, (_, r) => row(r));
  return grid.rows === 1 ? rows[0] : { split: "rows", sizes: equalSizes(grid.rows), children: rows };
}
