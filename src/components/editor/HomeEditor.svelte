<script lang="ts">
  // The Home Page Editor: the real home page is the editor. Click a text and type; in "Featured work" choose a template and
  // click each box to choose which project goes there. Every change comes from the preview as a message.
  import { onMount, untrack } from "svelte";
  import { DEFAULT_HOME, TEMPLATES, parseHome, stringifyHome, withTemplate, type Home, type Template } from "../../lib/home";
  import { loadHome, saveHome } from "../../lib/editor-api";
  import Ic from "./Ic.svelte";

  // ---- the home page being edited ----
  let home = $state<Home>(structuredClone(DEFAULT_HOME));
  let sha = $state<string | null>(null);
  let savedJson = $state("");
  let loading = $state(true);
  let loadError = $state("");

  const json = () => JSON.stringify($state.snapshot(home));
  const dirty = $derived(JSON.stringify($state.snapshot(home)) !== savedJson);

  onMount(async () => {
    try {
      const file = await loadHome();
      home = file.text.trim() ? parseHome(file.text) : structuredClone(DEFAULT_HOME);
      sha = file.sha;
      savedJson = json();
      resetHistory();
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Couldn't load the home page.";
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
      const out = await saveHome(stringifyHome($state.snapshot(home) as Home), sha);
      sha = out.sha;
      savedJson = json();
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
    home = JSON.parse(s);
    canUndo = past.length > 0; canRedo = true;
  }
  function redo() {
    const s = future.pop();
    if (s === undefined) return;
    past.push(current);
    current = s; burst = false;
    home = JSON.parse(s);
    canUndo = true; canRedo = future.length > 0;
  }
  $effect(() => {
    const s = JSON.stringify($state.snapshot(home));
    untrack(() => track(s));
  });
  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); save(); }
    else if (k === "z" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  }

  // ---- the live preview ----
  let frame: HTMLIFrameElement;
  let stage: HTMLDivElement;
  let previewReady = $state(false);
  let device = $state<"desktop" | "tablet" | "phone">("desktop");
  const widths = { desktop: 1280, tablet: 820, phone: 390 };
  let stageSize = $state({ w: 800, h: 600 });
  const scale = $derived(Math.min(1, stageSize.w / widths[device]));
  const devices = [["desktop", "device-desktop", "Desktop"], ["tablet", "device-tablet", "Tablet"], ["phone", "device-mobile", "Phone"]] as const;

  let renderTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const snap = $state.snapshot(home) as Home;
    if (!previewReady || loading) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => frame?.contentWindow?.postMessage({ type: "render", home: JSON.parse(JSON.stringify(snap)) }, location.origin), 60);
  });

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      stageSize = { w: entry.contentRect.width - 32, h: entry.contentRect.height - 32 };
    });
    ro.observe(stage);
    return () => ro.disconnect();
  });

  // ---- what the preview tells us ----
  /** Only these texts can be changed from the page. */
  const EDITABLE = /^(status|greeting|headline|intro|(featured|prints|about)\.(eyebrow|title)|about\.text|cta\.(title|text))$/;

  function setText(key: string, value: string) {
    if (!EDITABLE.test(key)) return;
    const parts = key.split(".");
    const last = parts.pop()!;
    let node: any = home;
    for (const part of parts) node = node[/^\d+$/.test(part) ? Number(part) : part];
    node[last] = value;
  }

  function onMessage(e: MessageEvent) {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const m = e.data;
    if (m?.type === "ready") previewReady = true;
    else if (m?.type === "edit" && typeof m.key === "string" && typeof m.value === "string") setText(m.key, m.value);
    else if (m?.type === "template" && typeof m.value === "string" && m.value in TEMPLATES) home = withTemplate(home, m.value as Template);
    else if (m?.type === "slot" && Number.isInteger(m.index) && typeof m.id === "string" && m.index >= 0 && m.index < home.featured.slots.length) home.featured.slots[m.index] = m.id;
    else if (m?.type === "shortcut") { if (m.name === "save") save(); else if (m.name === "undo") undo(); else if (m.name === "redo") redo(); }
  }
</script>

<svelte:window onmessage={onMessage} onkeydown={onKey} />

<div class="app">
  <header class="bar">
    <a class="back" href="/admin"><Ic name="arrow-left" size={16} />Admin</a>
    <strong class="title">Home page</strong>
    <span class="spacer"></span>
    <button class="icon" type="button" onclick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Ic name="arrow-back-up" /></button>
    <button class="icon" type="button" onclick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Ic name="arrow-forward-up" /></button>
    <span class="status" class:err={notice?.kind === "err"} role="status">
      {#if saving}Saving…{:else if notice}{notice.text}{:else if dirty}Unsaved changes{:else if !loading}All changes saved{/if}
    </span>
    <a class="icon" href="/" target="_blank" rel="noopener" aria-label="Open the live page" title="Open the live page"><Ic name="external-link" /></a>
    <button class="btn btn--small btn--primary" type="button" onclick={save} disabled={!dirty || saving || loading}>Save</button>
  </header>

  <section class="preview">
    <div class="devices">
      {#each devices as [id, icon, label] (id)}
        <button type="button" class:on={device === id} onclick={() => (device = id)} title={label}><Ic name={icon} size={17} />{label}</button>
      {/each}
      <span class="hint">Click any text to change it. In “Featured work” pick a template, then click a box to choose its project.</span>
    </div>
    {#if loadError}<p class="error pad">{loadError}</p>{/if}
    <div class="stage" bind:this={stage}>
      <div class="canvas" style:width={`${widths[device] * scale}px`} style:height={`${Math.max(200, stageSize.h)}px`}>
        <iframe
          bind:this={frame}
          title="Live preview of the home page"
          src="/admin/home-preview"
          style:width={`${widths[device]}px`}
          style:height={`${Math.max(200, stageSize.h) / scale}px`}
          style:transform={`scale(${scale})`}
        ></iframe>
      </div>
    </div>
  </section>
</div>

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
  .hint { margin-left: auto; font-size: 12px; color: var(--muted); }
  .stage { flex: 1; min-height: 0; display: grid; justify-items: center; align-items: start; padding: 0 16px 16px; overflow: auto; }
  .canvas { overflow: hidden; border-radius: var(--radius-sm); background: var(--bg); box-shadow: 0 8px 40px rgb(0 0 0 / 0.25); }
  iframe { display: block; border: 0; transform-origin: top left; background: var(--bg); }
  @media (max-width: 1000px) {
    .hint { display: none; }
  }
</style>
