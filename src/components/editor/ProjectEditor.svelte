<script lang="ts">
  // The project editor: the real page is the editor. Split boxes, choose what goes in them, type text; the form of whatever
  // you click opens in a small panel beside it.
  import { onMount, untrack } from "svelte";
  import {
    BLOCK_LABELS, CONTENT_LABELS, EMPTY, defaultMain, newContent, newProject, newSection, parseProject, slugify, stringifyProject,
    type Block, type Box, type Content, type Project, type Side,
  } from "../../lib/project-model";
  import { deleteBox, getNode, isSplit, leaves, parsePath, setContent, setSizes, splitBox, type Direction } from "../../lib/boxes";
  import { deleteProject, listFiles, listProjects, saveProject, shrinkPhoto, uploadFile, type ProjectFile } from "../../lib/editor-api";
  import type { Tool } from "../../lib/site-types";
  import BlockEditor from "./BlockEditor.svelte";
  import FilePicker from "./FilePicker.svelte";
  import FloatingPanel from "./FloatingPanel.svelte";
  import Ic from "./Ic.svelte";

  let { tools }: { tools: Tool[] } = $props();

  // ---- the project being edited ----
  let files = $state<ProjectFile[]>([]);
  let slug = $state("");
  let sha = $state<string | undefined>(undefined);
  let project = $state<Project>(newProject());
  let savedJson = $state("");
  let loading = $state(true);
  let loadError = $state("");

  const json = () => JSON.stringify($state.snapshot(project));
  const dirty = $derived(JSON.stringify($state.snapshot(project)) !== savedJson);

  const titles = $derived(files.map((f) => ({ slug: f.slug, title: safeTitle(f) })));
  function safeTitle(f: ProjectFile) {
    try { return parseProject(f.text).title || f.slug; } catch { return f.slug; }
  }
  const topics = $derived([...new Set(files.flatMap((f) => { try { return [parseProject(f.text).topic]; } catch { return []; } }).filter(Boolean))]);
  const knownSkills = $derived([...new Set(files.flatMap((f) => { try { return parseProject(f.text).skills; } catch { return []; } }))].sort());

  function load(file: ProjectFile) {
    slug = file.slug;
    sha = file.sha;
    project = parseProject(file.text);
    savedJson = json();
    resetHistory();
    history.replaceState(null, "", `#${file.slug}`);
  }

  function open(next: string) {
    if (next === slug) return;
    if (dirty && !confirm("You have unsaved changes. Leave without saving?")) { select.value = slug; return; }
    const file = files.find((f) => f.slug === next);
    if (file) load(file);
  }
  let select: HTMLSelectElement;

  onMount(async () => {
    try {
      files = await listProjects();
      files.sort((a, b) => a.slug.localeCompare(b.slug));
      const wanted = location.hash.slice(1);
      const first = files.find((f) => f.slug === wanted) ?? files[0];
      if (first) load(first);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Couldn't load the projects.";
    } finally {
      loading = false;
    }
    listFiles().then((f) => (library = f)).catch(() => {});
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });

  // ---- saving ----
  let saving = $state(false);
  let notice = $state<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    if (!slug || saving) return;
    if (!project.title.trim()) { notice = { kind: "err", text: "Give the project a title first." }; return; }
    saving = true;
    notice = null;
    try {
      const text = stringifyProject($state.snapshot(project) as Project);
      const out = await saveProject(slug, text, sha);
      sha = out.sha;
      savedJson = json();
      const i = files.findIndex((f) => f.slug === slug);
      const entry = { slug, sha: out.sha, text };
      if (i >= 0) files[i] = entry;
      else files = [...files, entry].sort((a, b) => a.slug.localeCompare(b.slug));
      notice = { kind: "ok", text: "Saved. Live in about a minute." };
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? e.message : "Saving failed." };
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!slug) return;
    const known = files.find((f) => f.slug === slug);
    if (!confirm(`Delete “${project.title}” for good? It will disappear from the site.`)) return;
    try {
      if (known) await deleteProject(slug, known.sha);
      files = files.filter((f) => f.slug !== slug);
      savedJson = json();
      if (files[0]) load(files[0]);
      else { slug = ""; project = newProject(); savedJson = json(); }
      notice = { kind: "ok", text: "Deleted." };
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? e.message : "Deleting failed." };
    }
  }

  // ---- new project ----
  let creating = $state(false);
  let newTitle = $state("");
  let titleInput = $state<HTMLInputElement>();
  $effect(() => { if (creating && titleInput) titleInput.focus(); });
  const newSlug = $derived(slugify(newTitle));
  const newSlugTaken = $derived(files.some((f) => f.slug === newSlug));

  function startCreate() {
    if (dirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    newTitle = "";
    creating = true;
  }
  function create() {
    if (!newSlug || newSlugTaken) return;
    slug = newSlug;
    sha = undefined;
    project = { ...newProject(), title: newTitle.trim() };
    savedJson = "";
    resetHistory();
    creating = false;
    history.replaceState(null, "", `#${slug}`);
    notice = { kind: "ok", text: "New project. Save to create it." };
  }

  // ---- undo and redo ----
  let past: string[] = [];
  let future: string[] = [];
  let current = "";
  let burst = false;
  let burstTimer: ReturnType<typeof setTimeout>;
  let canUndo = $state(false);
  let canRedo = $state(false);

  function resetHistory() {
    past = []; future = []; current = json(); burst = false; canUndo = false; canRedo = false;
  }
  function track(s: string) {
    if (s === current) return;
    if (!burst) { past.push(current); if (past.length > 80) past.shift(); burst = true; }
    current = s;
    future = [];
    canUndo = true; canRedo = false;
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => (burst = false), 700);
  }
  function undo() {
    const s = past.pop();
    if (s === undefined) return;
    future.push(current);
    current = s; burst = false;
    project = JSON.parse(s);
    canUndo = past.length > 0; canRedo = true;
  }
  function redo() {
    const s = future.pop();
    if (s === undefined) return;
    past.push(current);
    current = s; burst = false;
    project = JSON.parse(s);
    canUndo = true; canRedo = future.length > 0;
  }
  $effect(() => {
    const s = JSON.stringify($state.snapshot(project));
    untrack(() => track(s));
  });
  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); save(); }
    else if (k === "z" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  }
  $effect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") panel = null; };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  });

  // ---- tools, skills, sides ----
  let skillInput = $state("");
  function toggleTool(id: string) {
    const i = project.tools.indexOf(id);
    if (i >= 0) project.tools.splice(i, 1);
    else project.tools.push(id);
  }
  function addSkill() {
    const s = skillInput.trim();
    if (s && !project.skills.includes(s)) project.skills.push(s);
    skillInput = "";
  }
  function toggleSide(side: Side) {
    const i = project.coverSpacing.indexOf(side);
    if (i >= 0) project.coverSpacing.splice(i, 1);
    else project.coverSpacing.push(side);
  }

  // ---- pictures and models ----
  let library = $state<{ images: string[]; models: string[] }>({ images: [], models: [] });
  let local = $state<Record<string, string>>({});
  let picker = $state<{ kind: "image" | "model"; resolve: (path: string | null) => void } | null>(null);

  const pick = (kind: "image" | "model") => new Promise<string | null>((resolve) => { picker = { kind, resolve }; });
  const finishPick = (path: string | null) => { picker?.resolve(path); picker = null; };

  async function upload(file: File): Promise<string> {
    const base = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
    const blob = await shrinkPhoto(file);
    let name = base;
    const taken = new Set([...library.images, ...library.models].map((p) => p.split("/").pop()));
    for (let n = 2; taken.has(name); n++) name = base.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
    const { path } = await uploadFile(name, blob);
    local[path] = URL.createObjectURL(blob);
    if (path.endsWith(".glb")) library.models = [...library.models, path].sort();
    else library.images = [...library.images, path].sort();
    return path;
  }

  async function chooseInto(kind: "image" | "model", set: (p: string) => void) {
    const path = await pick(kind);
    if (path) set(path);
  }

  // ---- the live preview ----
  let frame: HTMLIFrameElement;
  let stage: HTMLDivElement;
  let previewReady = $state(false);
  let device = $state<"desktop" | "tablet" | "phone">("desktop");
  const widths = { desktop: 1280, tablet: 820, phone: 390 };
  let stageSize = $state({ w: 800, h: 600 });
  const scale = $derived(Math.min(1, stageSize.w / widths[device]));
  let skipDraw = false;

  function tellPreview(message: object) {
    frame?.contentWindow?.postMessage(message, location.origin);
  }

  let renderTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const snap = $state.snapshot(project) as Project;
    const urls = $state.snapshot(local);
    if (!previewReady) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const copy = JSON.parse(JSON.stringify(snap)) as Project;
      let s = JSON.stringify(copy);
      for (const [path, url] of Object.entries(urls)) s = s.split(JSON.stringify(path)).join(JSON.stringify(url));
      tellPreview({ type: "render", project: JSON.parse(s), skipDraw });
      skipDraw = false;
    }, 90);
  });

  // ---- boxes ----
  // A box is addressed as the preview names it: "m:0.1" is the main section, "2:" is section 2; the numbers after the colon
  // are the splits taken from the top. Every change below makes a new tree with the helpers of boxes.ts and puts it in the
  // project, so undo, redo and Save work as for everything else.
  type At = { scope: "m" | number; path: number[] };
  function locate(id: unknown): At | null {
    if (typeof id !== "string") return null;
    const [scope, rest = ""] = id.split(":");
    const path = parsePath(rest);
    if (!path) return null;
    if (scope === "m") return { scope: "m", path };
    const n = Number(scope);
    return Number.isInteger(n) && project.sections[n] ? { scope: n, path } : null;
  }
  const treeOf = (scope: "m" | number): Box => (scope === "m" ? project.main : project.sections[scope]);
  const putTree = (scope: "m" | number, tree: Box) => { if (scope === "m") project.main = tree; else project.sections[scope] = tree; };
  const leafAt = (id: unknown): Content | undefined => {
    const at = locate(id);
    const node = at ? getNode(treeOf(at.scope), at.path) : undefined;
    return node && !isSplit(node) ? node : undefined;
  };
  /** Change the tree a box is in. */
  function change(id: unknown, make: (tree: Box, path: number[]) => Box): boolean {
    const at = locate(id);
    if (!at) return false;
    putTree(at.scope, make($state.snapshot(treeOf(at.scope)) as Box, at.path));
    return true;
  }

  /** Ask the preview to select a box, type in it (text) and tell us where it is, so a panel can open beside it. */
  const focusBox = (id: string) => tellPreview({ type: "select", box: id, wantRect: true });

  function splitAt(id: unknown, direction: Direction) {
    if (change(id, (tree, path) => splitBox(tree, path, direction, EMPTY))) panel = null;
  }
  function deleteAt(id: unknown) {
    if (change(id, (tree, path) => deleteBox(tree, path, EMPTY))) panel = null;
  }
  function chooseContent(id: unknown, kind: unknown) {
    const kinds: Content["type"][] = ["text", "heading", "image", "gallery", "model", "youtube", "table", "button", "facts", "media", "empty"];
    if (typeof kind !== "string" || !kinds.includes(kind as Content["type"])) return;
    const content = kind === "empty" ? EMPTY : newContent(kind as Content["type"]);
    if (change(id, (tree, path) => setContent(tree, path, content)) && kind !== "empty" && typeof id === "string") focusBox(id);
    else panel = null;
  }
  /** Two boxes trade places (a box dropped on an empty one moves there). */
  function swap(a: unknown, b: unknown) {
    const first = locate(a);
    const second = locate(b);
    const one = leafAt(a);
    const two = leafAt(b);
    if (!first || !second || !one || !two || a === b) return;
    const copyOne = $state.snapshot(one) as Content;
    const copyTwo = $state.snapshot(two) as Content;
    change(a, (tree, path) => setContent(tree, path, copyTwo));
    change(b, (tree, path) => setContent(tree, path, copyOne));
    panel = null;
  }
  function resize(splitId: unknown, sizes: unknown) {
    if (!Array.isArray(sizes)) return;
    change(splitId, (tree, path) => setSizes(tree, path, sizes.map(Number)));
  }

  /** The default layout of the main section: 2 columns, the first split in 2 rows (text, tools), the second one the model or cover. */
  function useDefaultMain() {
    const mine = leaves($state.snapshot(project.main) as Box);
    const text = mine.find((l) => l.leaf.type === "text")?.leaf;
    const keeps = mine.filter((l) => l.leaf.type === "text" || l.leaf.type === "facts" || l.leaf.type === "media").length;
    if (mine.length > keeps && !confirm("The default layout has only three boxes: text, tools and skills, and the cover or model. Other boxes of the main section will be removed. Continue?")) return;
    project.main = defaultMain(text && text.type === "text" ? text.text : "Write something here.");
    panel = null;
  }

  // ---- sections ----
  function addSection() {
    project.sections.push(newSection());
    panel = null;
    const n = project.sections.length - 1;
    setTimeout(() => tellPreview({ type: "select", section: n }), 200);
  }
  function moveSection(from: number, insertAt: number) {
    const to = insertAt > from ? insertAt - 1 : insertAt;
    if (from < 0 || from >= project.sections.length || to < 0 || to >= project.sections.length || to === from) return;
    const [moved] = project.sections.splice(from, 1);
    project.sections.splice(to, 0, moved);
    panel = null;
  }
  function duplicateSection(s: number) {
    project.sections.splice(s + 1, 0, JSON.parse(JSON.stringify($state.snapshot(project.sections[s]))));
    panel = null;
  }
  function deleteSection(s: number) {
    const count = leaves($state.snapshot(project.sections[s]) as Box).filter((l) => l.leaf.type !== "empty").length;
    if (count > 0 && !confirm(`Delete section ${s + 1} and its ${count} box${count === 1 ? "" : "es"} with content?`)) return;
    project.sections.splice(s, 1);
    panel = null;
  }

  // ---- the panel beside the box you click ----
  type PanelKind = { kind: "details" } | { kind: "media" } | { kind: "facts" } | { kind: "box"; id: string };
  let panel = $state<PanelKind | null>(null);
  let panelAt = $state({ left: 0, top: 0 });
  const PANEL_WIDTH = 360;

  /** Where a box of the preview is on the screen: the preview is scaled to fit, so map its coordinates. */
  function placePanel(r: { top: number; left: number; width: number; height: number }) {
    const f = frame.getBoundingClientRect();
    const k = f.width / (frame.offsetWidth || 1);
    const x = f.left + r.left * k;
    const y = f.top + r.top * k;
    const w = r.width * k;
    let left = x + w + 16;
    if (left + PANEL_WIDTH > window.innerWidth - 8) left = x - PANEL_WIDTH - 16;
    if (left < 8) left = Math.max(8, window.innerWidth - PANEL_WIDTH - 16);
    panelAt = { left, top: Math.min(Math.max(y - 8, 56), Math.max(56, window.innerHeight - 480)) };
  }
  const panelLeaf = $derived(panel?.kind === "box" ? leafAt(panel.id) : undefined);
  const panelTitle = $derived(panel?.kind === "details" ? "Details" : panel?.kind === "media" ? "Cover and 3D model" : panel?.kind === "facts" ? "Tools and skills" : panelLeaf ? CONTENT_LABELS[panelLeaf.type] : "");
  $effect(() => { if (panel?.kind === "box" && !panelLeaf) panel = null; });

  /** What the preview says was clicked decides what the panel shows. Text and headings are typed on the page itself. */
  function panelFor(m: any) {
    if (!m.rect) return;
    if (m.header) panel = { kind: "details" };
    else if (typeof m.box === "string") {
      const leaf = leafAt(m.box);
      if (!leaf || leaf.type === "text" || leaf.type === "heading" || leaf.type === "empty") { panel = null; return; }
      panel = leaf.type === "media" ? { kind: "media" } : leaf.type === "facts" ? { kind: "facts" } : { kind: "box", id: m.box };
    } else { panel = null; return; }
    placePanel(m.rect);
  }

  const whole = (n: unknown): n is number => Number.isInteger(n);

  function onMessage(e: MessageEvent) {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const m = e.data;
    if (m?.type === "ready") previewReady = true;
    if (m?.type === "edit" && (m.field === "title" || m.field === "summary") && typeof m.value === "string") {
      skipDraw = true;
      project[m.field as "title" | "summary"] = m.value;
    }
    if (m?.type === "editText" && typeof m.value === "string") {
      const leaf = leafAt(m.box);
      if (leaf && (leaf.type === "text" || leaf.type === "heading")) { skipDraw = true; leaf.text = m.value; }
    }
    if (m?.type === "split" && (m.direction === "columns" || m.direction === "rows")) splitAt(m.box, m.direction);
    if (m?.type === "deleteBox") deleteAt(m.box);
    if (m?.type === "setContent") chooseContent(m.box, m.kind);
    if (m?.type === "swap") swap(m.from, m.to);
    if (m?.type === "resize") resize(m.split, m.sizes);
    if (m?.type === "defaultMain") useDefaultMain();
    if (m?.type === "addSection") addSection();
    if (m?.type === "moveSection" && whole(m.from) && whole(m.insertAt)) moveSection(m.from, m.insertAt);
    if (m?.type === "sectionAction" && whole(m.section) && project.sections[m.section]) {
      if (m.action === "up") moveSection(m.section, m.section - 1);
      else if (m.action === "down") moveSection(m.section, m.section + 2);
      else if (m.action === "copy") duplicateSection(m.section);
      else if (m.action === "delete") deleteSection(m.section);
    }
    if (m?.type === "shortcut") { if (m.name === "save") save(); else if (m.name === "undo") undo(); else if (m.name === "redo") redo(); }
    if (m?.type === "select") panelFor(m);
  }

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      stageSize = { w: entry.contentRect.width - 32, h: entry.contentRect.height - 32 };
    });
    ro.observe(stage);
    return () => ro.disconnect();
  });

  const devices = [["desktop", "device-desktop", "Desktop"], ["tablet", "device-tablet", "Tablet"], ["phone", "device-mobile", "Phone"]] as const;
</script>

<svelte:window onmessage={onMessage} onkeydown={onKey} />

{#snippet coverForm()}
  <span class="legend">Cover image: used on the Projects page and the home page</span>
  {#if project.cover}
    <div class="cover-frame"><img src={local[project.cover] ?? project.cover} alt="" style={project.coverSpacing.map((side) => `padding-${side}: 5%`).join("; ")} /></div>
  {/if}
  <div class="row">
    <button class="btn btn--small" type="button" onclick={() => chooseInto("image", (p) => (project.cover = p))}>{project.cover ? "Change cover" : "Choose cover"}</button>
    {#if project.cover}<button class="link" type="button" onclick={() => (project.cover = "")}>Remove</button>{/if}
  </div>
  {#if project.cover}
    <div>
      <span class="legend">Space around the cover</span>
      <div class="seg">
        {#each ["top", "right", "bottom", "left"] as s (s)}
          <button type="button" class:on={project.coverSpacing.includes(s as Side)} onclick={() => toggleSide(s as Side)}>{s}</button>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet detailsForm()}
  <div class="fields">
    <label>Topic <input type="text" list="topics" bind:value={project.topic} placeholder="Machine design" /></label>
    <datalist id="topics">{#each topics as t (t)}<option value={t}></option>{/each}</datalist>
    <label>Date <input type="text" bind:value={project.date} placeholder="March 2025" /></label>
    <label>Title <input type="text" bind:value={project.title} /></label>
    <label>Short summary <textarea rows="3" bind:value={project.summary}></textarea></label>
    <label>Video (YouTube link) <input type="url" bind:value={project.youtube} placeholder="Optional. Adds the “Watch the video” button" /></label>
    {@render coverForm()}
  </div>
{/snippet}

{#snippet mediaForm()}
  <div class="fields">
    {@render coverForm()}
    <div>
      <span class="legend">3D model of the project (shown instead of the cover)</span>
      <div class="row">
        {#if project.model}<code>{project.model.split("/").pop()}</code>{/if}
        <button class="btn btn--small" type="button" onclick={() => chooseInto("model", (p) => (project.model = p))}>{project.model ? "Change 3D model" : "Add a 3D model"}</button>
        {#if project.model}<button class="link" type="button" onclick={() => (project.model = "")}>Remove</button>{/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet factsForm()}
  <div class="fields">
    <div>
      <span class="legend">Tools used</span>
      <div class="chips">
        {#each tools as t (t.id)}
          <button type="button" class="chip" class:on={project.tools.includes(t.id)} onclick={() => toggleTool(t.id)}>
            {#if t.icon}<img src={t.icon} alt="" width="16" height="16" />{/if}{t.name}
          </button>
        {/each}
      </div>
    </div>
    <div>
      <span class="legend">Skills</span>
      <div class="chips">
        {#each project.skills as s, i (s)}
          <span class="chip on">{s}<button type="button" aria-label={`Remove ${s}`} onclick={() => project.skills.splice(i, 1)}><Ic name="x" size={13} /></button></span>
        {/each}
      </div>
      <form class="row" onsubmit={(e) => { e.preventDefault(); addSkill(); }}>
        <input type="text" list="skills" bind:value={skillInput} placeholder="Add a skill and press Enter" />
        <datalist id="skills">{#each knownSkills as s (s)}<option value={s}></option>{/each}</datalist>
      </form>
    </div>
  </div>
{/snippet}

<div class="app">
  <header class="bar">
    <a class="back" href="/admin"><Ic name="arrow-left" size={16} />Admin</a>
    <select bind:this={select} value={slug} onchange={(e) => open(e.currentTarget.value)} aria-label="Project" disabled={loading || files.length === 0}>
      {#each titles as t (t.slug)}<option value={t.slug}>{t.title}</option>{/each}
      {#if slug && !titles.some((t) => t.slug === slug)}<option value={slug}>{project.title} (new)</option>{/if}
    </select>
    <button class="btn btn--small" type="button" onclick={startCreate}><Ic name="plus" size={16} />New project</button>
    <span class="spacer"></span>
    <button class="icon" type="button" onclick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Ic name="arrow-back-up" /></button>
    <button class="icon" type="button" onclick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Ic name="arrow-forward-up" /></button>
    <span class="status" class:err={notice?.kind === "err"} role="status">
      {#if saving}Saving…{:else if notice}{notice.text}{:else if dirty}Unsaved changes{:else if slug}All changes saved{/if}
    </span>
    {#if slug}<a class="icon" href={`/projects/${slug}`} target="_blank" rel="noopener" aria-label="Open the live page" title="Open the live page"><Ic name="external-link" /></a>{/if}
    {#if slug}<button class="icon" type="button" onclick={remove} aria-label="Delete this project" title="Delete this project"><Ic name="trash" /></button>{/if}
    <button class="btn btn--small btn--primary" type="button" onclick={save} disabled={!dirty || saving || !slug}>Save</button>
  </header>

  <div class="main">
    <section class="preview">
      <div class="devices">
        {#each devices as [id, icon, label] (id)}
          <button type="button" class:on={device === id} onclick={() => (device = id)} title={label}><Ic name={icon} size={17} />{label}</button>
        {/each}
        <span class="hint">Click anything in the page to edit it. Every box has buttons to divide it into columns or rows.</span>
      </div>
      {#if loadError}<p class="error pad">{loadError}</p>{:else if !loading && !slug}<p class="muted pad">No projects yet. Click “New project”.</p>{/if}
      <div class="stage" bind:this={stage}>
        <div class="canvas" style:width={`${widths[device] * scale}px`} style:height={`${Math.max(200, stageSize.h)}px`}>
          <iframe
            bind:this={frame}
            title="Live preview of the page"
            src="/admin/preview"
            style:width={`${widths[device]}px`}
            style:height={`${Math.max(200, stageSize.h) / scale}px`}
            style:transform={`scale(${scale})`}
          ></iframe>
        </div>
      </div>
    </section>
  </div>
</div>

{#if panel}
  <FloatingPanel title={panelTitle} left={panelAt.left} top={panelAt.top} onclose={() => (panel = null)}>
    {#if panel.kind === "details"}
      {@render detailsForm()}
    {:else if panel.kind === "media"}
      {@render mediaForm()}
    {:else if panel.kind === "facts"}
      {@render factsForm()}
    {:else if panelLeaf && panelLeaf.type !== "media" && panelLeaf.type !== "facts" && panelLeaf.type !== "empty"}
      {@const id = panel.id}
      <BlockEditor block={panelLeaf} {pick} {local} />
      <div class="row panel-actions">
        <button class="btn btn--small" type="button" onclick={() => chooseContent(id, "empty")}>Empty this box</button>
        <button class="btn btn--small" type="button" onclick={() => deleteAt(id)}><Ic name="trash" size={14} />Delete box</button>
        <button class="btn btn--small btn--primary" type="button" onclick={() => (panel = null)}>Done</button>
      </div>
    {/if}
  </FloatingPanel>
{/if}

{#if picker}
  <FilePicker
    kind={picker.kind}
    files={picker.kind === "image" ? library.images : library.models}
    {local}
    onpick={(p) => finishPick(p)}
    onclose={() => finishPick(null)}
    onupload={upload}
  />
{/if}

{#if creating}
  <div class="backdrop" role="presentation" onclick={() => (creating = false)}>
    <form class="dialog" onclick={(e) => e.stopPropagation()} onsubmit={(e) => { e.preventDefault(); create(); }}>
      <h2>New project</h2>
      <label>Title <input type="text" bind:this={titleInput} bind:value={newTitle} placeholder="My new machine" /></label>
      <p class="help">Page address: /projects/{newSlug || "…"}{#if newSlugTaken} <b class="error">already used</b>{/if}</p>
      <div class="row end">
        <button class="btn btn--small" type="button" onclick={() => (creating = false)}>Cancel</button>
        <button class="btn btn--small btn--primary" type="submit" disabled={!newSlug || newSlugTaken}>Create</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .app { display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: var(--bg); color: var(--text); }
  .bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--surface); }
  .back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); text-decoration: none; font-size: 14px; margin-right: 6px; }
  .back:hover { color: var(--ink); }
  .bar select { max-width: 260px; padding: 8px 12px; border: 0; border-radius: 999px; background: var(--chip); color: var(--ink); font: inherit; font-size: 14px; }
  .spacer { flex: 1; }
  .icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 999px; background: transparent; color: var(--text); cursor: pointer; }
  .icon:hover:not(:disabled) { background: var(--chip); color: var(--ink); }
  .icon:disabled { opacity: 0.35; cursor: default; }
  .status { font-size: 13px; color: var(--muted); max-width: 360px; text-align: right; }
  .status.err { color: var(--err); }
  .main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
  .pad { padding: 16px; }
  .muted { color: var(--muted); }
  .error { color: var(--err); }
  .help { font-size: 13px; color: var(--muted); }
  .fields { display: grid; gap: 14px; }
  label { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
  select { padding: 7px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); color: var(--ink); font: inherit; font-size: 13px; }
  .legend { display: block; margin-bottom: 8px; font-size: 13px; color: var(--muted); }
  input[type="text"], input[type="url"], input[type="number"], textarea {
    width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); color: var(--ink); font: inherit; font-size: 14px;
  }
  textarea { resize: vertical; line-height: 1.5; }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .row.end { justify-content: flex-end; }
  .panel-actions { padding-top: 4px; }
  /* Same box and padding as the cover on the Projects page, so spacing changes show here. */
  .cover-frame { aspect-ratio: 16 / 10; border-radius: var(--radius-sm); background: var(--placeholder); overflow: hidden; }
  .cover-frame img { width: 100%; height: 100%; object-fit: contain; box-sizing: border-box; display: block; }
  code { font-family: var(--font-mono); font-size: 13px; color: var(--ink); }
  .link { border: 0; background: none; padding: 0; color: var(--muted); cursor: pointer; font: inherit; font-size: 13px; text-decoration: underline; }
  .link:hover { color: var(--ink); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border: 0; border-radius: 999px; background: var(--chip); color: var(--text); cursor: pointer; font: inherit; font-size: 13px; text-transform: capitalize; }
  .seg button:hover { background: var(--line); }
  .seg button.on { background: var(--accent); color: var(--on-accent); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 0; border-radius: 999px; background: var(--chip); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; }
  .chip.on { background: color-mix(in srgb, var(--accent) 22%, var(--chip)); color: var(--ink); }
  .chip span, .chip button { display: inline-flex; }
  span.chip { cursor: default; }
  span.chip button { border: 0; background: none; color: inherit; padding: 0; cursor: pointer; opacity: 0.7; }
  span.chip button:hover { opacity: 1; }

  .preview { min-width: 0; display: flex; flex-direction: column; background: var(--placeholder); }
  .devices { display: flex; align-items: center; gap: 6px; padding: 10px 16px; }
  .devices button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 0; border-radius: 999px; background: transparent; color: var(--text); cursor: pointer; font: inherit; font-size: 13px; }
  .devices button:hover { background: var(--chip); }
  .devices button.on { background: var(--chip); color: var(--ink); }
  .hint { margin-left: auto; font-size: 12px; color: var(--muted); }
  .stage { flex: 1; min-height: 0; display: grid; justify-items: center; align-items: start; padding: 0 16px 16px; overflow: auto; }
  .canvas { overflow: hidden; border-radius: var(--radius-sm); background: var(--bg); box-shadow: 0 8px 40px rgb(0 0 0 / 0.25); }
  iframe { display: block; border: 0; transform-origin: top left; background: var(--bg); }

  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(5 6 8 / 0.7); display: grid; place-items: center; padding: 20px; }
  .dialog { width: min(420px, 100%); display: grid; gap: 14px; padding: 22px; border-radius: var(--radius); background: var(--surface); }
  .dialog h2 { font-size: 18px; }
  .dialog .help { padding: 0; }

  @media (max-width: 1000px) {
    .hint { display: none; }
  }
</style>
