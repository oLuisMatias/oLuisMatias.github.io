// Draws the CV page's cards (Work, Education, Other experience, Certifications) and its skills box as HTML. The public
// page (src/pages/cv.astro) and the CV Page Editor's live preview (src/pages/admin/cv-preview.astro) both use it, so
// what you edit is exactly what the site shows. Styles: src/styles/cv.css.
//
// With `edit` on, texts carry data-edit="section.index.field" names, every card gets its tool buttons, logos and empty
// boxes become buttons, and "Add card" slots are drawn above, between and below the cards. An empty part is never
// drawn on the public page.
import { markdown } from "./markdown";
import { safeUrl } from "./safe-url";
import type { Card, Section } from "./cv";
import type { Skills } from "./skills";
import { langCode } from "./skills";
import type { Tool } from "./site-types";
import { iconSvg } from "./icons";
import { skillIconPath, toolOfSkill } from "./skill-icons";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s: string) => markdown.parseInline(s, { async: false }) as string;
const isLocal = (u: string) => u.startsWith("/");

export interface Options {
  tools: Tool[];
  edit?: boolean;
  /** Temporary addresses for pictures uploaded in this session and not yet published. */
  urls?: Record<string, string>;
}

const PLACEHOLDERS: Record<string, string> = {
  title: "Title",
  org: "Name",
  period: "Period",
  location: "Place",
  details: "Click to write a short text",
  kind: "Label",
  id: "Credential ID",
  group: "Group",
  name: "Language",
  level: "Level",
  skill: "Skill",
};

/** A text of the page; in the editor it can be typed over. Empty texts are drawn only in the editor. */
function text(edit: boolean | undefined, key: string, value: string, tag = "span", cls = ""): string {
  const c = cls ? ` class="${cls}"` : "";
  if (!edit) return value ? `<${tag}${c}>${esc(value)}</${tag}>` : "";
  const field = key.split(".").pop() ?? "";
  const placeholder = PLACEHOLDERS[/^\d+$/.test(field) ? "skill" : field] ?? "Text";
  return `<${tag}${c} data-edit="${key}" data-placeholder="${esc(placeholder)}">${esc(value)}</${tag}>`;
}

const toolIcon = (src: string) => `<span class="ticon"><img src="${esc(src)}" alt="" width="22" height="22" loading="lazy"></span>`;

function button(act: string, icon: string, title: string, on = false, extra = ""): string {
  return `<button type="button" class="card-tool${on ? " is-on" : ""}" data-act="${act}" ${extra} title="${esc(title)}" aria-label="${esc(title)}">${iconSvg(icon, 16)}</button>`;
}

/** The tools of a card. In the editor it is a box to add tools to and take tools out of, empty or not. */
function toolsBox(ids: string[], o: Options): string {
  const known = ids.map((id) => o.tools.find((t) => t.id === id) ?? { id, name: id, icon: "" });
  if (!o.edit) {
    return known.length ? `<ul class="tags" aria-label="Tools used">${known.map((t) => `<li class="tag">${t.icon ? toolIcon(t.icon) : ""}<span class="tag__label">${esc(t.name)}</span></li>`).join("")}</ul>` : "";
  }
  const chips = known.map((t) => `<li class="tag">${t.icon ? toolIcon(t.icon) : ""}<span class="tag__label">${esc(t.name)}</span><button type="button" class="chip-x" data-act="tool-remove" data-tool="${esc(t.id)}" title="Remove ${esc(t.name)}" aria-label="Remove ${esc(t.name)}">${iconSvg("x", 13)}</button></li>`).join("");
  return `<div class="tools-box${known.length ? "" : " is-empty"}" data-tools><ul class="tags" aria-label="Tools used">${chips}</ul><button type="button" class="add-line" data-act="tool-add">${iconSvg("plus", 15)}${known.length ? "Add tool" : "Add tools"}</button></div>`;
}

function renderPaper(card: Card, k: string, j: number, o: Options): string {
  const p = card.papers[j];
  if (!o.edit) {
    const body = p.url ? `<a href="${esc(safeUrl(p.url))}" rel="noopener">${esc(p.title)}</a>` : esc(p.title);
    return `<p class="entry__paper">${p.kind ? `<span class="entry__badge">${esc(p.kind)}</span> ` : ""}${body}</p>`;
  }
  return `<p class="entry__paper" data-paper="${j}">${text(true, `${k}.papers.${j}.kind`, p.kind, "span", "entry__badge")} ${text(true, `${k}.papers.${j}.title`, p.title)}
    <span class="paper-tools">${button("paper-link", "link", p.url ? `Link: ${p.url}` : "Add a link", !!p.url, `data-paper="${j}"`)}${button("paper-remove", "x", "Remove this line", false, `data-paper="${j}"`)}</span></p>`;
}

function logoBox(card: Card, o: Options, cls: string, label: string): string {
  const src = o.urls?.[card.logo] ?? card.logo;
  if (o.edit) {
    return `<button type="button" class="logo-btn" data-act="logo" title="${src ? "Change the picture" : "Add a picture"}">${src ? `<img class="${cls}" src="${esc(src)}" alt="">` : `<span class="${cls} ${cls}--empty">${iconSvg("photo", 22)}${label}</span>`}</button>`;
  }
  return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(card.org)} ${label.toLowerCase().includes("badge") ? "badge" : "logo"}" loading="lazy">` : "";
}

function bullets(card: Card, edit: boolean | undefined): string {
  if (card.lines.length) return `<ul class="entry__list"${edit ? ' data-bullets title="Click to edit the points"' : ""}>${card.lines.map((r) => `<li>${inline(r)}</li>`).join("")}</ul>`;
  return edit ? `<ul class="entry__list" data-bullets><li class="entry__placeholder">Click to add bullet points</li></ul>` : "";
}

function cardTools(section: Section, card: Card, o: Options): string {
  if (!o.edit) return "";
  const noLink = section === "certifications";
  return `<div class="card-tools">${button("up", "arrow-up", "Move up")}${button("down", "arrow-down", "Move down")}${noLink ? "" : button("link", "link", card.link ? `Link of the name: ${card.link}` : "Add a link to the name", !!card.link)}${button("toggle", card.visible ? "eye" : "eye-off", card.visible ? "Shown on the site: click to hide" : "Hidden from the site: click to show")}${button("delete", "trash", "Delete this card")}</div>`;
}

const marks = (o: Options, section: Section, card: Card, index: number, base: string) =>
  `class="${base}${o.edit && !card.visible ? " is-hidden" : ""}"${o.edit ? ` data-card="${index}"` : ""}`;

/** A job, a degree or another experience. */
function renderEntry(section: Section, card: Card, index: number, o: Options): string {
  const k = `${section}.${index}`;
  const e = o.edit;
  const org = e ? text(true, `${k}.org`, card.org) : card.link ? `<a href="${esc(safeUrl(card.link))}" rel="noopener">${esc(card.org)}</a>` : esc(card.org);
  const meta = e
    ? `${text(true, `${k}.period`, card.period)} · ${text(true, `${k}.location`, card.location)}`
    : esc([card.period, card.location].filter(Boolean).join(" · "));
  const pill = section === "experiences" ? (e || card.kind ? text(e, `${k}.kind`, card.kind, "span", "pill") : "") : "";

  let body = "";
  if (section === "education") body += e ? text(true, `${k}.details`, card.details, "p", "entry__text") : card.details ? `<p class="entry__text">${esc(card.details)}</p>` : "";
  else body += bullets(card, e);
  if (section !== "experiences") {
    body += card.papers.map((_, j) => renderPaper(card, k, j, o)).join("");
    if (e) body += `<button type="button" class="add-line" data-act="paper-add">${iconSvg("plus", 15)}Add a line (Paper, Patent, Thesis…)</button>`;
    body += toolsBox(card.tools, o);
  }

  return `<li ${marks(o, section, card, index, "card entry")}>${cardTools(section, card, o)}
    <div class="entry__head">
      <div>
        ${pill}
        ${text(e, `${k}.title`, card.title, "h3", pill ? "entry__h--after-pill" : "")}
        <p class="entry__org">${org}</p>
        <p class="muted entry__meta">${meta}</p>
      </div>
      ${logoBox(card, o, "entry__logo", "Add logo")}
    </div>
    ${body}
  </li>`;
}

/** The link boxes of a certification: a file or a web address each. An empty one is drawn only in the editor, as a box to fill. */
function certLink(card: Card, field: "pdf" | "verify", o: Options): string {
  const url = card[field];
  const title = card.title;
  const online = field === "verify" && !!url && !isLocal(url);
  const label = field === "pdf" ? "Certificate" : online ? "Verify online" : "Verification";
  if (o.edit) {
    return url
      ? `<button type="button" class="ilink ilink--edit" data-act="cert-link" data-field="${field}" title="${esc(url)}">${iconSvg(field === "pdf" ? "file-certificate" : "rosette-discount-check", 16)}${label}${online ? iconSvg("external-link", 14) : ""}</button>`
      : `<button type="button" class="add-line" data-act="cert-link" data-field="${field}">${iconSvg("plus", 15)}${label} link</button>`;
  }
  if (!url) return "";
  if (field === "pdf") return `<a class="ilink" href="${esc(safeUrl(url))}" data-viewer="${esc(title)} · Certificate">${iconSvg("file-certificate", 16)}Certificate</a>`;
  return isLocal(url)
    ? `<a class="ilink" href="${esc(safeUrl(url))}" data-viewer="${esc(title)} · Verification">${iconSvg("rosette-discount-check", 16)}Verification</a>`
    : `<a class="ilink" href="${esc(safeUrl(url))}" target="_blank" rel="noopener" data-popup-window>${iconSvg("rosette-discount-check", 16)}Verify online${iconSvg("external-link", 14)}</a>`;
}

function renderCert(card: Card, index: number, o: Options): string {
  const k = `certifications.${index}`;
  const e = o.edit;
  const src = o.urls?.[card.logo] ?? card.logo;
  const badge = e
    ? `<button type="button" class="logo-btn" data-act="logo" title="${src ? "Change the badge" : "Add a badge"}">${src ? `<img src="${esc(src)}" alt="">` : `<span class="cert__badge--empty">${iconSvg("photo", 22)}Add badge</span>`}</button>`
    : src ? `<img src="${esc(src)}" alt="${esc(card.title)} badge" loading="lazy">` : "";
  const issuerDate = e
    ? `${text(true, `${k}.org`, card.org)} · ${text(true, `${k}.period`, card.period)}`
    : esc([card.org, card.period].filter(Boolean).join(" · "));
  const id = e ? `<p class="muted cert__id">ID ${text(true, `${k}.id`, card.id)}</p>` : card.id ? `<p class="muted cert__id">ID ${esc(card.id)}</p>` : "";
  const links = [certLink(card, "pdf", o), certLink(card, "verify", o)].join("");
  return `<article ${marks(o, "certifications", card, index, "card cert")}>${cardTools("certifications", card, o)}
    ${badge}
    <div class="cert__body">
      ${text(e, `${k}.title`, card.title, "h3")}
      ${issuerDate ? `<p class="muted">${issuerDate}</p>` : ""}
      ${id}
      ${links ? `<p class="cert__links">${links}</p>` : ""}
    </div>
  </article>`;
}

const addSlot = (at: number) => `<li class="add-slot"><button type="button" data-act="add" data-at="${at}">${iconSvg("plus", 16)}Add card</button></li>`;

/** The cards of one section: <li>s for the timelines, <article>s for the certifications. */
export function renderCards(section: Section, cards: Card[], o: Options): string {
  const one = (c: Card, i: number) => (section === "certifications" ? renderCert(c, i, o) : renderEntry(section, c, i, o));
  if (!o.edit) return cards.map(one).join("");
  // The certifications are a grid: no bars between them, one tile at the end to add another.
  if (section === "certifications") {
    return cards.map(one).join("") + `<button type="button" class="add-tile" data-act="add" data-at="${cards.length}">${iconSvg("plus", 20)}Add certification</button>`;
  }
  return addSlot(0) + cards.map((c, i) => one(c, i) + addSlot(i + 1)).join("");
}

// ---- the skills box ----

function skillTag(name: string, tools: Tool[], inner: string, extra = ""): string {
  const tool = toolOfSkill(name, tools);
  const icon = tool
    ? toolIcon(tool.icon)
    : `<svg class="tag__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${skillIconPath(name)}"/></svg>`;
  return `<li class="tag">${icon}${inner}${extra}</li>`;
}

export function renderSkills(skills: Skills, o: Options): string {
  const e = o.edit;
  const x = (act: string, attrs: string, title: string) => `<button type="button" class="chip-x" data-act="${act}" ${attrs} title="${title}" aria-label="${title}">${iconSvg("x", 13)}</button>`;
  const groups = skills.skills
    .map((g, gi) => {
      const items = g.items
        .map((it, ii) => skillTag(it, o.tools, e ? text(true, `skills.g.${gi}.items.${ii}`, it) : esc(it), e ? x("skill-remove", `data-group="${gi}" data-item="${ii}"`, `Remove ${esc(it)}`) : ""))
        .join("");
      const head = e
        ? `<div class="skills__head">${text(true, `skills.g.${gi}.group`, g.group, "h3")}${x("group-remove", `data-group="${gi}"`, "Remove this group")}</div>`
        : `<h3>${esc(g.group)}</h3>`;
      const add = e ? `<button type="button" class="add-line" data-act="skill-add" data-group="${gi}">${iconSvg("plus", 15)}Add skill</button>` : "";
      return `<div>${head}<ul class="tags">${items}</ul>${add}</div>`;
    })
    .join("");
  const languages = skills.languages
    .map((l, li) => {
      const label = e ? `${text(true, `skills.l.${li}.name`, l.name)} · ${text(true, `skills.l.${li}.level`, l.level)}` : `${esc(l.name)}${l.level ? ` · ${esc(l.level)}` : ""}`;
      return `<li class="tag"><span class="tag__code">${esc(langCode(l.name))}</span>${label}${e ? x("language-remove", `data-lang="${li}"`, "Remove this language") : ""}</li>`;
    })
    .join("");
  const langBlock = languages || e ? `<div><h3>Languages</h3><ul class="tags">${languages}</ul>${e ? `<button type="button" class="add-line" data-act="language-add">${iconSvg("plus", 15)}Add language</button>` : ""}</div>` : "";
  const addGroup = e ? `<button type="button" class="add-line" data-act="group-add">${iconSvg("plus", 15)}Add group</button>` : "";
  return `${groups}${langBlock}${addGroup}`;
}
