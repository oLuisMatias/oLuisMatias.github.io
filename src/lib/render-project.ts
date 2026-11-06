// Draws a project page as HTML. The public page (src/pages/projects/[slug].astro) and the editor's live preview
// (src/pages/admin/preview.astro) both use it, so what you edit is exactly what the site shows. Styles: src/styles/project.css.
//
// With `edit` on, every box gets data attributes so the preview can select, divide, move and resize it, and
// empty boxes are drawn as "choose what goes here". Without it, nothing empty is drawn and there are no editor parts.
import { markdown } from "./markdown";
import type { Content, Project } from "./project-model";
import type { Tool } from "./site-types";
import { columnsStyle, isSplit, leaves, pathKey, type Node, type Path } from "./boxes";
import { iconSvg } from "./icons";
import { safeUrl } from "./safe-url";
import { skillIconPath, toolOfSkill } from "./skill-icons";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = (text = "") => markdown.parse(text, { async: false }) as string;
const spacingStyle = (sides: string[] = []) => sides.map((s) => `padding-${s}: 5%`).join("; ");
const youtubeId = (url = "") => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/)?.[1] ?? "";

const toolIcon = (src: string) => `<span class="ticon"><img src="${esc(src)}" alt="" width="22" height="22"></span>`;

function facts(p: Project, tools: Tool[]): string {
  const known = p.tools.map((id) => tools.find((t) => t.id === id) ?? { id, name: id, icon: "" });
  if (known.length === 0 && p.skills.length === 0) return "";
  const toolRow = known.length
    ? `<div><h2>Tools</h2><ul class="tags">${known.map((t) => `<li class="tag">${t.icon ? toolIcon(t.icon) : ""}${esc(t.name)}</li>`).join("")}</ul></div>`
    : "";
  const skillRow = p.skills.length
    ? `<div><h2>Skills</h2><ul class="tags">${p.skills
        .map((s) => {
          const tool = toolOfSkill(s, tools);
          const icon = tool
            ? toolIcon(tool.icon)
            : `<svg class="tag__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${skillIconPath(s)}"/></svg>`;
          return `<li class="tag">${icon}${esc(s)}</li>`;
        })
        .join("")}</ul></div>`
    : "";
  return `<div class="card facts">${toolRow}${skillRow}</div>`;
}

function modelFrame(src: string, caption: string, extra: string, cls: string, poster = ""): string {
  return `<figure class="${cls}" ${extra} data-model-frame>
    <model-viewer src="${esc(src)}"${poster ? ` poster="${esc(poster)}"` : ""} camera-controls disable-zoom disable-pan auto-rotate interaction-prompt="none" shadow-intensity="0.6" class="model" alt="${esc(caption || "3D model")}"></model-viewer>
    <button type="button" class="icon-btn model-expand" data-model-expand="${esc(src)}" data-model-title="${esc(caption)}" data-model-poster="${esc(poster)}" aria-label="Open the 3D model in full view" title="Full view">${iconSvg("arrows-maximize")}</button>
    <span class="model-hint" aria-hidden="true">${iconSvg("hand-move", 20)}Drag to rotate</span>
    ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
  </figure>`;
}

const empty = (what: string) => `<div class="empty-block">${esc(what)}</div>`;

interface Ctx {
  p: Project;
  tools: Tool[];
  edit: boolean;
}

/** What is inside a box. `id` is the box's address ("m:0.1" in the main section, "2:" for the only box of section 2). No text means nothing to show. */
function renderContent(c: Content, id: string, scope: string, { p, tools, edit }: Ctx): string {
  const mark = edit ? `data-block="${id}" data-type="${c.type}"` : "";
  switch (c.type) {
    case "text":
      if (!c.text.trim()) return edit ? `<div class="block" ${mark}>${empty("Text: click to write")}</div>` : "";
      return `<div class="prose block${scope === "m" ? " main-text" : ""}" ${mark}>${md(c.text)}</div>`;
    case "heading":
      if (!c.text.trim()) return edit ? `<div class="block" ${mark}>${empty("Heading: type a title")}</div>` : "";
      return `<h2 class="block block-heading" ${mark}>${esc(c.text)}</h2>`;
    case "image":
      if (!c.src) return edit ? `<div class="block" ${mark}>${empty("Image: choose a picture")}</div>` : "";
      return `<figure class="block figure" ${mark}><img src="${esc(c.src)}" alt="${esc(c.alt || c.caption)}" loading="lazy" style="${spacingStyle(c.spacing)}">${c.caption ? `<figcaption>${esc(c.caption)}</figcaption>` : ""}</figure>`;
    case "gallery":
      if (c.images.length === 0) return edit ? `<div class="block" ${mark}>${empty("Gallery: add pictures")}</div>` : "";
      return `<div class="block gallery" ${mark}>${c.images
        .map((im) => `<figure class="figure"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`)
        .join("")}</div>`;
    case "model":
      if (!c.src) return edit ? `<div class="block" ${mark}>${empty("3D model: choose a file")}</div>` : "";
      return modelFrame(c.src, c.caption, mark, "block figure model-frame");
    case "youtube": {
      const vid = youtubeId(c.url);
      if (!vid) return edit ? `<div class="block" ${mark}>${empty("Video: paste a YouTube link")}</div>` : "";
      return `<div class="block video" ${mark}><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="Project video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe></div>`;
    }
    case "table": {
      if (c.rows.length === 0) return edit ? `<div class="block" ${mark}>${empty("Table: add rows")}</div>` : "";
      const cell = (tag: string, text: string) => `<${tag}>${esc(text)}</${tag}>`;
      const [first, ...rest] = c.rows;
      const head = c.header ? `<thead><tr>${first.map((t) => cell("th", t)).join("")}</tr></thead>` : "";
      const body = (c.header ? rest : c.rows).map((r) => `<tr>${r.map((t) => cell("td", t)).join("")}</tr>`).join("");
      return `<div class="block table-wrap" ${mark}><table class="ptable">${head}<tbody>${body}</tbody></table></div>`;
    }
    case "button":
      if (!c.label.trim()) return edit ? `<div class="block" ${mark}>${empty("Button: type a label")}</div>` : "";
      return `<p class="block block-button" ${mark}><a class="btn" href="${esc(edit ? "#" : safeUrl(c.url || "#"))}"${edit || !c.url ? "" : ` target="_blank" rel="noopener"`}>${esc(c.label)}${iconSvg("external-link", 16)}</a></p>`;
    case "facts": {
      const html = facts(p, tools);
      if (!html) return edit ? `<div class="main-facts" data-part="facts">${empty("Tools and skills: add some")}</div>` : "";
      return `<div class="main-facts" ${edit ? `data-part="facts"` : ""}>${html}</div>`;
    }
    case "media": {
      const part = edit ? `data-part="media"` : "";
      if (p.model) return modelFrame(p.model, "", part, "card media model-frame", p.cover);
      if (p.cover) return `<figure class="card media" ${part}><img src="${esc(p.cover)}" alt="${esc(p.title)}" style="${spacingStyle(p.coverSpacing)}"></figure>`;
      return edit ? `<div class="main-media" ${part}>${empty("Cover or 3D model: add one")}</div>` : "";
    }
    case "empty":
      return "";
  }
}

function renderNode(node: Node<Content>, ctx: Ctx, scope: string, path: Path): string {
  const id = `${scope}:${pathKey(path)}`;
  if (isSplit(node)) {
    const children = node.children.map((child, i) => renderNode(child, ctx, scope, [...path, i])).join("");
    const style = node.split === "columns" ? ` style="${columnsStyle(node.sizes)}"` : "";
    return `<div class="split split--${node.split}"${style}${ctx.edit ? ` data-split="${id}"` : ""}>${children}</div>`;
  }
  const content = renderContent(node, id, scope, ctx);
  if (!ctx.edit) return `<div class="box">${content}</div>`;
  const inner =
    node.type === "empty"
      ? `<button type="button" class="cell-choose" data-act="choose" data-box="${id}">${iconSvg("plus", 18)}Choose what goes here</button>`
      : content;
  return `<div class="box${node.type === "empty" ? " box--empty" : ""}" data-box="${id}">${inner}</div>`;
}

/** True when something would be drawn on the public page. */
const hasContent = (root: Node<Content>, ctx: Ctx, scope: string) => leaves(root).some(({ leaf }) => renderContent(leaf, "", scope, { ...ctx, edit: false }) !== "");

const SECTION_ACTIONS: [string, string, string][] = [
  ["section-up", "arrow-up", "Move up"],
  ["section-down", "arrow-down", "Move down"],
  ["section-copy", "copy", "Duplicate this section"],
  ["section-delete", "trash", "Delete this section"],
];

/** The header and the page below it (the main section and the sections), without the surrounding article. */
export function renderProjectBody(p: Project, tools: Tool[], edit = false): string {
  const ytId = youtubeId(p.youtube);
  const ctx: Ctx = { p, tools, edit };

  const mainBar = edit
    ? `<div class="section-bar section-bar--main">Main section<span class="section-bar__tools"><button type="button" class="bar-btn" data-act="default-main" title="Arrange the main section the default way: text and tools on the left, model or cover on the right">Default template</button></span></div>`
    : "";
  const main = edit || hasContent(p.main, ctx, "m") ? `<div class="main-section" ${edit ? "data-main" : ""}>${mainBar}${renderNode(p.main, ctx, "m", [])}</div>` : "";

  const sections = p.sections
    .map((s, si) => {
      if (!edit && !hasContent(s, ctx, String(si))) return "";
      const sectionBar = edit
        ? `<div class="section-bar" data-section-grip="${si}"><span class="section-bar__grip">${iconSvg("grip-vertical", 16)}</span>Section ${si + 1}<span class="section-bar__tools">` +
          SECTION_ACTIONS.map(([act, icon, title]) => `<button type="button" class="bar-icon" data-act="${act}" data-section="${si}" title="${title}" aria-label="${title}">${iconSvg(icon, 15)}</button>`).join("") +
          `</span></div>`
        : "";
      return `<section class="psection" ${edit ? `data-section="${si}"` : ""}>${sectionBar}${renderNode(s, ctx, String(si), [])}</section>`;
    })
    .join("");

  return `<header class="page-head" ${edit ? `data-part="header"` : ""}>
      ${edit ? `<span class="back">${iconSvg("arrow-left", 16)}All projects</span>` : `<a class="back" href="/projects">${iconSvg("arrow-left", 16)}All projects</a>`}
      <div class="head-meta"><span class="pill">${esc(p.topic || "Topic")}</span>${p.date ? `<span class="muted">${esc(p.date)}</span>` : ""}</div>
      <h1>${esc(p.title || "Untitled")}</h1>
      ${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
      ${ytId ? `<p style="margin-top:24px"><button type="button" class="btn btn--ghost btn--small" data-video="${ytId}" data-video-title="${esc(p.title)}">${iconSvg("player-play", 16)}Watch the video</button></p>` : ""}
    </header>
    ${main}
    <div class="sections">${sections}</div>
    ${edit ? `<button type="button" class="add-section-btn" data-act="add-section">${iconSvg("plus", 18)}Add section</button>` : ""}`;
}

/** The whole article, for the editor's preview. */
export function renderProject(p: Project, tools: Tool[]): string {
  return `<article class="wrap">${renderProjectBody(p, tools, true)}</article>`;
}
