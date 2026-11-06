// What a box of a project page can hold. Shared by the project model, the page renderer and the editor.

export type Side = "top" | "right" | "bottom" | "left";

/** Content you write: text, pictures, a table... */
export type Block =
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt: string; caption: string; spacing: Side[] }
  | { type: "gallery"; images: { src: string; caption: string }[] }
  | { type: "model"; src: string; caption: string }
  | { type: "youtube"; url: string }
  | { type: "heading"; text: string }
  | { type: "table"; header: boolean; rows: string[][] }
  | { type: "button"; label: string; url: string };

/** What goes in a box: a block, or one of the project's own parts, or nothing yet. */
export type Content = Block | { type: "media" } | { type: "facts" } | { type: "empty" };

export const BLOCK_LABELS: Record<Block["type"], string> = {
  text: "Text",
  image: "Image",
  gallery: "Gallery",
  model: "3D model",
  youtube: "Video",
  heading: "Heading",
  table: "Table",
  button: "Button",
};

export const CONTENT_LABELS: Record<Content["type"], string> = {
  ...BLOCK_LABELS,
  media: "Cover or project 3D model",
  facts: "Tools and skills",
  empty: "Empty",
};

export function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "text": return { type, text: "Write something here." };
    case "image": return { type, src: "", alt: "", caption: "", spacing: [] };
    case "gallery": return { type, images: [] };
    case "model": return { type, src: "", caption: "" };
    case "youtube": return { type, url: "" };
    case "heading": return { type, text: "Heading" };
    case "table": return { type, header: true, rows: [["Column 1", "Column 2"], ["", ""]] };
    case "button": return { type, label: "Open", url: "" };
  }
}

export function newContent(type: Content["type"]): Content {
  return type === "media" || type === "facts" || type === "empty" ? { type } : newBlock(type);
}

export const EMPTY: Content = { type: "empty" };

export const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
export const strs = (v: unknown) => (Array.isArray(v) ? v.map(str) : []);
export const sides = (v: unknown): Side[] => strs(v).filter((s): s is Side => ["top", "right", "bottom", "left"].includes(s));

export function parseBlock(raw: any): Block | null {
  switch (raw?.type) {
    case "text": return { type: "text", text: str(raw.text) };
    case "image": return { type: "image", src: str(raw.src), alt: str(raw.alt), caption: str(raw.caption), spacing: sides(raw.spacing) };
    case "gallery": return {
      type: "gallery",
      images: Array.isArray(raw.images) ? raw.images.map((i: any) => ({ src: str(i?.src), caption: str(i?.caption) })) : [],
    };
    case "model": return { type: "model", src: str(raw.src), caption: str(raw.caption) };
    case "youtube": return { type: "youtube", url: str(raw.url) };
    case "heading": return { type: "heading", text: str(raw.text) };
    case "button": return { type: "button", label: str(raw.label), url: str(raw.url) };
    case "table": {
      const rows: string[][] = (Array.isArray(raw.rows) ? raw.rows : []).map((r: unknown) => (Array.isArray(r) ? r.map(str) : []));
      const width = Math.max(1, ...rows.map((r) => r.length));
      return { type: "table", header: raw.header !== false, rows: rows.map((r) => [...r, ...Array(width - r.length).fill("")]) };
    }
    default: return null;
  }
}

/** A box's content from a file. Anything unknown becomes an empty box. */
export function parseContent(raw: any): Content {
  if (raw?.type === "media" || raw?.type === "facts" || raw?.type === "empty") return { type: raw.type };
  return parseBlock(raw) ?? EMPTY;
}
