<script lang="ts">
  // The CV Page Editor: the cards and the skills of the real CV page are the editor. Click a text and type, click a logo to
  // choose or upload a picture, add a card on top, between the cards or at the end, add tools, links and skills in their
  // boxes. Every change comes from the preview as a message. Each card is one file; saving writes only the files that
  // changed, moves the others by their order number, and deletes the files of removed cards.
  import { onMount, untrack } from "svelte";
  import { DEFAULT_KIND, SECTIONS, addCard, cardFiles, cardFromText, moveCard, removeCard, toggleTool, type Card, type Section } from "../../lib/cv";
  import { COLUMN_CHOICES, DEFAULT_CV_PAGE, parseCvPage, stringifyCvPage, type CvPage } from "../../lib/cv-page";
  import { DEFAULT_SKILLS, parseSkills, stringifySkills, type Skills } from "../../lib/skills";
  import { listCards, listFiles, loadPage, saveCards, savePage, shrinkPhoto, uploadFile } from "../../lib/editor-api";
  import type { Tool } from "../../lib/site-types";
  import FilePicker from "./FilePicker.svelte";
  import ToolPicker from "./ToolPicker.svelte";
  import Ic from "./Ic.svelte";

  let { tools }: { tools: Tool[] } = $props();

  type Cards = Record<Section, Card[]>;
  interface Doc {
    cards: Cards;
    skills: Skills;
    page: CvPage;
  }

  // ---- what is being edited ----
  let doc = $state<Doc>({ cards: { work: [], education: [], experiences: [], certifications: [] }, skills: structuredClone(DEFAULT_SKILLS), page: structuredClone(DEFAULT_CV_PAGE) });
  /** What is saved: version tag and text of every card file, by "section/file name". */
  let baseline = new Map<string, { sha: string; text: string }>();
  let skillsSha: string | null = null;
  let skillsText = "";
  let pageSha: string | null = null;
  let pageText = "";
  let savedJson = $state("");
  let loading = $state(true);
  let loadError = $state("");

  const json = () => JSON.stringify($state.snapshot(doc));
  const dirty = $derived(JSON.stringify($state.snapshot(doc)) !== savedJson);

  onMount(async () => {
    try {
      const [out, skills, page] = await Promise.all([listCards(), loadPage("skills"), loadPage("cv-page")]);
      const cards = { work: [], education: [], experiences: [], certifications: [] } as Cards;
      baseline = new Map();
      for (const section of SECTIONS) {
        const loaded = out[section].map((f) => {
          baseline.set(`${section}/${f.name}`, { sha: f.sha, text: f.text });
          const order = Number(/^order:\s*(\d+)/m.exec(f.text)?.[1] ?? 100);
          return { order, card: cardFromText(section, f.text, f.name) };
        });
        cards[section] = loaded.sort((a, b) => a.order - b.order || a.card.file.localeCompare(b.card.file)).map((l) => l.card);
      }
      skillsSha = skills.sha;
      skillsText = skills.text;
      pageSha = page.sha;
      pageText = page.text;
      doc = {
        cards,
        skills: skills.text.trim() ? parseSkills(skills.text) : structuredClone(DEFAULT_SKILLS),
        page: page.text.trim() ? parseCvPage(page.text) : structuredClone(DEFAULT_CV_PAGE),
      };
      savedJson = json();
      resetHistory();
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Couldn't load the CV page.";
    } finally {
      loading = false;
    }
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });

  // ---- saving ----
  let saving = $state(false);
  let notice = $state<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    if (saving || loading) return;
    saving = true;
    notice = null;
    try {
      const snap = $state.snapshot(doc) as Doc;
      // Everything that changed goes in one commit, so the site is rebuilt once and a failure leaves nothing half saved.
      const keep = new Set<string>();
      const files: { section: string; name: string; text: string; sha: string | null }[] = [];
      for (const section of SECTIONS) {
        for (const { file, text } of cardFiles(section, snap.cards[section])) {
          const key = `${section}/${file}`;
          keep.add(key);
          const old = baseline.get(key);
          if (old?.text !== text) files.push({ section, name: file, text, sha: old?.sha ?? null });
        }
      }
      const deletes = [...baseline]
        .filter(([key]) => !keep.has(key))
        .map(([key, old]) => ({ section: key.split("/")[0], name: key.split("/")[1], sha: old.sha }));
      if (files.length || deletes.length) {
        const shas = await saveCards(files, deletes);
        for (const f of files) baseline.set(`${f.section}/${f.name}`, { sha: shas[`${f.section}/${f.name}`], text: f.text });
        for (const d of deletes) baseline.delete(`${d.section}/${d.name}`);
      }
      const text = stringifySkills(snap.skills);
      if (text !== skillsText) {
        const out = await savePage("skills", text, skillsSha);
        skillsSha = out.sha;
        skillsText = text;
      }
      const layout = stringifyCvPage(snap.page);
      if (layout !== pageText) {
        const out = await savePage("cv-page", layout, pageSha);
        pageSha = out.sha;
        pageText = layout;
      }
      savedJson = JSON.stringify(snap);
      notice = { kind: "ok", text: "Saved. Live in about a minute." };
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? e.message : "Saving failed." };
    } finally {
      saving = false;
    }
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
    doc = JSON.parse(s);
    canUndo = past.length > 0; canRedo = true;
  }
  function redo() {
    const s = future.pop();
    if (s === undefined) return;
    past.push(current);
    current = s; burst = false;
    doc = JSON.parse(s);
    canUndo = true; canRedo = future.length > 0;
  }
  $effect(() => {
    const s = JSON.stringify($state.snapshot(doc));
    untrack(() => track(s));
  });
  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); save(); }
    else if (k === "z" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  }

  // ---- pictures and files ----
  /** The files of each folder: the logos of a section, or "documents" for certificate files. */
  let library = $state<Record<string, string[]>>({});
  /** Pictures uploaded in this session and not yet published, with a temporary address to show them. */
  let local = $state<Record<string, string>>({});
  /** Which window is open: choosing a logo or badge, a certificate file, or the tools of a card. */
  let picker = $state<{ area: string; resolve: (path: string | null) => void } | null>(null);
  let toolsFor = $state<{ section: Section; index: number } | null>(null);
  let linkDialog = $state<{ section: Section; index: number; field: "pdf" | "verify"; value: string } | null>(null);

  onMount(() => {
    for (const area of [...SECTIONS, "documents"]) listFiles(area).then((f) => (library[area] = f.images)).catch(() => {});
  });

  const pick = (area: string) => new Promise<string | null>((resolve) => { picker = { area, resolve }; });
  const finishPick = (path: string | null) => { picker?.resolve(path); picker = null; };

  async function upload(file: File): Promise<string> {
    if (!picker) throw new Error("Nothing to upload to.");
    const area = picker.area;
    const base = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
    const blob = await shrinkPhoto(file);
    let name = base;
    const taken = new Set((library[area] ?? []).map((p) => p.split("/").pop()));
    for (let n = 2; taken.has(name); n++) name = base.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
    const { path } = await uploadFile(name, blob, area);
    local[path] = URL.createObjectURL(blob);
    library[area] = [...(library[area] ?? []), path].sort();
    return path;
  }

  async function chooseLogo(section: Section, index: number) {
    const path = await pick(section);
    if (path && doc.cards[section][index]) doc.cards[section][index].logo = path;
  }

  async function chooseFileForLink() {
    const path = await pick("documents");
    if (path && linkDialog) linkDialog.value = path;
  }

  function saveLink() {
    if (!linkDialog) return;
    const card = doc.cards[linkDialog.section][linkDialog.index];
    if (card) card[linkDialog.field] = linkDialog.value.trim();
    linkDialog = null;
  }

  // ---- the live preview ----
  let frame: HTMLIFrameElement;
  let stage: HTMLDivElement;
  /** Counts how often the preview announced itself: a reloaded preview shows the saved data until it gets the edited data again. */
  let previewReady = $state(0);
  let device = $state<"desktop" | "tablet" | "phone">("desktop");
  const widths = { desktop: 1280, tablet: 820, phone: 390 };
  let stageSize = $state({ w: 800, h: 600 });
  const scale = $derived(Math.min(1, stageSize.w / widths[device]));
  const devices = [["desktop", "device-desktop", "Desktop"], ["tablet", "device-tablet", "Tablet"], ["phone", "device-mobile", "Phone"]] as const;

  let renderTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const snap = $state.snapshot(doc) as Doc;
    const urls = $state.snapshot(local);
    if (!previewReady || loading) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => frame?.contentWindow?.postMessage({ type: "render", cards: JSON.parse(JSON.stringify(snap.cards)), skills: JSON.parse(JSON.stringify(snap.skills)), page: JSON.parse(JSON.stringify(snap.page)), urls }, location.origin), 60);
  });

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      stageSize = { w: entry.contentRect.width - 32, h: entry.contentRect.height - 32 };
    });
    ro.observe(stage);
    return () => ro.disconnect();
  });

  // ---- what the preview tells us ----
  const isSection = (v: unknown): v is Section => typeof v === "string" && (SECTIONS as readonly string[]).includes(v);
  const FIELDS = new Set(["title", "org", "period", "location", "details", "kind", "id"]);

  /** "work.2.title", "work.2.papers.0.kind" or "skills.g.1.group" -> changes that text. Only the page's own texts can be changed. */
  function setText(key: string, value: string) {
    const parts = key.split(".");
    if (parts[0] === "skills") {
      const [, which, i, field, j] = parts;
      if (which === "g") {
        const group = doc.skills.skills[Number(i)];
        if (!group) return;
        if (field === "group") group.group = value;
        else if (field === "items" && group.items[Number(j)] !== undefined) group.items[Number(j)] = value;
      } else if (which === "l") {
        const language = doc.skills.languages[Number(i)];
        if (language && (field === "name" || field === "level")) language[field] = value;
      }
      return;
    }
    const [section, index, field, paper, sub] = parts;
    if (!isSection(section)) return;
    const card = doc.cards[section][Number(index)];
    if (!card) return;
    if (FIELDS.has(field) && paper === undefined) (card as unknown as Record<string, string>)[field] = value;
    else if (field === "papers" && (sub === "kind" || sub === "title") && card.papers[Number(paper)]) card.papers[Number(paper)][sub] = value;
  }

  function onSkillsMessage(m: any): boolean {
    const s = doc.skills;
    if (m.type === "group-add") s.skills.push({ group: "New group", items: [] });
    else if (m.type === "group-remove" && s.skills[m.group]) s.skills.splice(m.group, 1);
    else if (m.type === "skill-add" && s.skills[m.group]) s.skills[m.group].items.push("New skill");
    else if (m.type === "skill-remove" && s.skills[m.group]?.items[m.item] !== undefined) s.skills[m.group].items.splice(m.item, 1);
    else if (m.type === "language-add") s.languages.push({ name: "Language", level: "Level" });
    else if (m.type === "language-remove" && s.languages[m.lang]) s.languages.splice(m.lang, 1);
    else return false;
    return true;
  }

  function onMessage(e: MessageEvent) {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const m = e.data;
    if (m?.type === "ready") { previewReady++; return; }
    if (m?.type === "shortcut") { if (m.name === "save") save(); else if (m.name === "undo") undo(); else if (m.name === "redo") redo(); return; }
    if (m?.type === "edit" && typeof m.key === "string" && typeof m.value === "string") { setText(m.key, m.value); return; }
    if (m?.type === "cert-columns" && (COLUMN_CHOICES as readonly number[]).includes(m.value)) { doc.page.certColumns = m.value; return; }
    if (onSkillsMessage(m ?? {})) return;
    if (!isSection(m?.section)) return;
    const section: Section = m.section;
    const list = doc.cards[section];
    const card = list[m.index];
    if (m.type === "add" && Number.isInteger(m.at)) doc.cards[section] = addCard(section, list, m.at);
    else if (!card) return;
    else if (m.type === "remove") doc.cards[section] = removeCard(list, m.index);
    else if (m.type === "move" && (m.dir === -1 || m.dir === 1)) doc.cards[section] = moveCard(list, m.index, m.dir);
    else if (m.type === "toggle") card.visible = !card.visible;
    else if (m.type === "logo") chooseLogo(section, m.index);
    else if (m.type === "tool-add") toolsFor = { section, index: m.index };
    else if (m.type === "tool-remove" && typeof m.tool === "string") card.tools = card.tools.filter((t) => t !== m.tool);
    else if (m.type === "cert-link" && (m.field === "pdf" || m.field === "verify")) linkDialog = { section, index: m.index, field: m.field, value: card[m.field as "pdf" | "verify"] };
    else if (m.type === "link" && typeof m.value === "string") card.link = m.value;
    else if (m.type === "bullets" && Array.isArray(m.value)) card.lines = m.value.filter((l: unknown) => typeof l === "string");
    else if (m.type === "paper-add") card.papers.push({ kind: DEFAULT_KIND, title: "", url: "" });
    else if (m.type === "paper-remove" && card.papers[m.paper]) card.papers.splice(m.paper, 1);
    else if (m.type === "paper-link" && card.papers[m.paper] && typeof m.value === "string") card.papers[m.paper].url = m.value;
  }

  const toolsCard = $derived(toolsFor ? doc.cards[toolsFor.section][toolsFor.index] : null);
</script>

<svelte:window onmessage={onMessage} onkeydown={onKey} />

<div class="app">
  <header class="bar">
    <a class="back" href="/admin"><Ic name="arrow-left" size={16} />Admin</a>
    <strong class="title">CV page</strong>
    <span class="spacer"></span>
    <button class="icon" type="button" onclick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Ic name="arrow-back-up" /></button>
    <button class="icon" type="button" onclick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Ic name="arrow-forward-up" /></button>
    <span class="status" class:err={notice?.kind === "err"} role="status">
      {#if saving}Saving…{:else if notice}{notice.text}{:else if dirty}Unsaved changes{:else if !loading}All changes saved{/if}
    </span>
    <a class="icon" href="/cv" target="_blank" rel="noopener" aria-label="Open the live page" title="Open the live page"><Ic name="external-link" /></a>
    <button class="btn btn--small btn--primary" type="button" onclick={save} disabled={!dirty || saving || loading}>Save</button>
  </header>

  <section class="preview">
    <div class="devices">
      {#each devices as [id, icon, label] (id)}
        <button type="button" class:on={device === id} onclick={() => (device = id)} title={label}><Ic name={icon} size={17} />{label}</button>
      {/each}
      <span class="hint">Click any text to change it, a picture box to change the picture. Point at a card for its buttons; the dashed bars add a card, the dashed buttons add tools, links and skills.</span>
    </div>
    {#if loadError}<p class="error pad">{loadError}</p>{/if}
    <div class="stage" bind:this={stage}>
      <div class="canvas" style:width={`${widths[device] * scale}px`} style:height={`${Math.max(200, stageSize.h)}px`}>
        <iframe
          bind:this={frame}
          title="Live preview of the CV page"
          src="/admin/cv-preview"
          style:width={`${widths[device]}px`}
          style:height={`${Math.max(200, stageSize.h) / scale}px`}
          style:transform={`scale(${scale})`}
        ></iframe>
      </div>
    </div>
  </section>
</div>

{#if picker}
  <FilePicker
    kind={picker.area === "documents" ? "document" : "image"}
    files={library[picker.area] ?? []}
    {local}
    onpick={(p) => finishPick(p)}
    onclose={() => finishPick(null)}
    onupload={upload}
  />
{/if}

{#if toolsFor && toolsCard}
  <ToolPicker
    {tools}
    chosen={toolsCard.tools}
    ontoggle={(id) => { if (toolsCard) toolsCard.tools = toggleTool(toolsCard, id); }}
    onclose={() => (toolsFor = null)}
  />
{/if}

{#if linkDialog}
  <div class="backdrop" role="presentation" onclick={() => (linkDialog = null)}>
    <form class="dialog" onclick={(e) => e.stopPropagation()} onsubmit={(e) => { e.preventDefault(); saveLink(); }}>
      <h2>{linkDialog.field === "pdf" ? "Certificate" : "Verification"} link</h2>
      <label>Web address or file
        <input type="text" bind:value={linkDialog.value} placeholder="https://… or choose a file below" />
      </label>
      <button class="btn btn--small" type="button" onclick={chooseFileForLink}>Choose or upload a file…</button>
      <p class="note">A file opens in a window on the page; a web address opens as an online verification.</p>
      <div class="row">
        <button class="btn btn--small" type="button" onclick={() => { if (linkDialog) { linkDialog.value = ""; saveLink(); } }}>Remove link</button>
        <span class="spacer"></span>
        <button class="btn btn--small" type="button" onclick={() => (linkDialog = null)}>Cancel</button>
        <button class="btn btn--small btn--primary" type="submit">Save</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .app { display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: var(--bg); color: var(--text); }
  .bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--surface); }
  .back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); text-decoration: none; font-size: 14px; margin-right: 6px; }
  .back:hover { color: var(--ink); }
  .title { color: var(--ink); font-size: 15px; }
  .spacer { flex: 1; }
  .icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 999px; background: transparent; color: var(--text); cursor: pointer; }
  .icon:hover:not(:disabled) { background: var(--chip); color: var(--ink); }
  .icon:disabled { opacity: 0.35; cursor: default; }
  .status { font-size: 13px; color: var(--muted); max-width: 360px; text-align: right; }
  .status.err { color: var(--err); }
  .pad { padding: 16px; }
  .error { color: var(--err); }
  .preview { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; background: var(--placeholder); }
  .devices { display: flex; align-items: center; gap: 6px; padding: 10px 16px; }
  .devices button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 0; border-radius: 999px; background: transparent; color: var(--text); cursor: pointer; font: inherit; font-size: 13px; }
  .devices button:hover { background: var(--chip); }
  .devices button.on { background: var(--chip); color: var(--ink); }
  .hint { margin-left: auto; font-size: 12px; color: var(--muted); max-width: 560px; text-align: right; }
  .stage { flex: 1; min-height: 0; display: grid; justify-items: center; align-items: start; padding: 0 16px 16px; overflow: auto; }
  .canvas { overflow: hidden; border-radius: var(--radius-sm); background: var(--bg); box-shadow: 0 8px 40px rgb(0 0 0 / 0.25); }
  iframe { display: block; border: 0; transform-origin: top left; background: var(--bg); }
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(5 6 8 / 0.7); display: grid; place-items: center; padding: 20px; }
  .dialog { width: min(480px, 100%); background: var(--surface); border-radius: var(--radius); padding: 20px; display: grid; gap: 14px; }
  .dialog h2 { font-size: 18px; }
  .dialog label { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
  .dialog input { padding: 9px 12px; border: 0; border-radius: 12px; background: var(--chip); color: var(--ink); font: inherit; font-size: 14px; }
  .dialog .btn { justify-self: start; }
  .note { color: var(--muted); font-size: 13px; }
  .row { display: flex; align-items: center; gap: 8px; }
  @media (max-width: 1000px) {
    .hint { display: none; }
  }
</style>
