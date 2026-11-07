<script lang="ts">
  // The CV Builder: the history of every saved CV, newest first. Click a CV to see its PDF in a popup, put it on the website
  // or delete it. "New version" opens the editor; "Upload an old PDF" adds a CV that exists only as a PDF.
  import { onMount } from "svelte";
  import { TAGS, EMPTY_VERSIONS, addVersion, lockVersion, makeLive, newestFirst, nextId, numberOf, ownPdfs, parseVersions, pdfFileName, pdfOf, removeVersion, stringifyVersions, websitePdf, type CvVersions, type Numbered } from "../../lib/cv-versions";
  import { deleteCvPdf, loadCvDoc, loadPage, savePage, uploadFile } from "../../lib/editor-api";
  import { NO_PHONE_KEYS, VARIANT_HINTS, VARIANT_KEYS, VARIANT_LABELS, isNoPhone, parseDoc, type VariantKey } from "../../lib/cv-document";
  import { buildCvPdf } from "../../lib/pdf-cv-document";
  import Ic from "./Ic.svelte";

  let data = $state<CvVersions>(structuredClone(EMPTY_VERSIONS));
  let sha = $state<string | null>(null);
  let loading = $state(true);
  let loadError = $state("");
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "err"; text: string } | null>(null);

  const list = $derived(newestFirst(data.versions));
  const today = () => new Date().toISOString().slice(0, 10);
  const when = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

  onMount(async () => {
    try {
      const file = await loadPage("cv-versions");
      data = file.text.trim() ? parseVersions(file.text) : structuredClone(EMPTY_VERSIONS);
      sha = file.sha;
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Couldn't load the saved CVs.";
    } finally {
      loading = false;
    }
  });

  /** Save the list. The page only shows the new list once GitHub (or the disk) has it. */
  async function persist(next: CvVersions, done: string): Promise<boolean> {
    busy = true;
    notice = null;
    try {
      const out = await savePage("cv-versions", stringifyVersions(next), sha);
      sha = out.sha;
      data = next;
      notice = { kind: "ok", text: done };
      return true;
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? e.message : "Saving failed." };
      return false;
    } finally {
      busy = false;
    }
  }

  // ---- the PDF popup ----
  let viewing = $state<Numbered | null>(null);
  let confirm = $state<"live" | "delete" | "lock" | null>(null);
  let viewer: HTMLDialogElement | undefined = $state();

  /**
   * What the popup shows: the PDF file of the chosen template, or for a built CV without that file yet, the PDF made now from the
   * saved content. A CV that was only uploaded has one PDF and no templates.
   */
  let viewUrl = $state("");
  let viewError = $state("");
  let viewVariant = $state<VariantKey>("normal");

  async function show(v: Numbered, variant: VariantKey) {
    viewVariant = variant;
    viewError = "";
    const file = pdfOf(v, variant);
    viewUrl = file ? `${file}#toolbar=0&navpanes=0&view=FitH` : "";
    if (file || !v.doc) return;
    try {
      const saved = await loadCvDoc(v.id);
      if (!saved) throw new Error("This version has no PDF and no saved content.");
      const url = URL.createObjectURL(await buildCvPdf(parseDoc(saved.text), variant));
      if (viewing?.id === v.id && viewVariant === variant) viewUrl = `${url}#toolbar=0&navpanes=0&view=FitH`;
    } catch (e) {
      viewError = e instanceof Error ? e.message : "Couldn't show this CV.";
    }
  }

  async function open(v: Numbered) {
    viewing = v;
    confirm = null;
    viewer?.showModal();
    await show(v, "normal");
  }
  /** Can the template in view go on the website? A built CV: only a no-phone one that has its PDF. An uploaded CV: its one PDF. */
  const canUse = (v: Numbered) => (v.doc ? isNoPhone(viewVariant) && !!pdfOf(v, viewVariant) : !!v.pdf);
  const useHint = (v: Numbered) =>
    v.doc ? (!isNoPhone(viewVariant) ? "Open one of the “no phone” tabs: only those can go on the website" : !pdfOf(v, viewVariant) ? "Make this CV's PDFs first" : "") : v.pdf ? "" : "No PDF";

  function closeViewer() {
    viewer?.close();
  }

  /** A draft is finished (it's being sent out): lock it, so it can only be copied from now on. */
  async function lock(v: Numbered) {
    if (await persist(lockVersion(data, v.id), `v${v.n} is locked. Use “Duplicate & edit” for changes.`)) {
      viewing = { ...v, locked: true };
      confirm = null;
    }
  }

  // ---- the buttons on each row of the history: Download and Use on website, each opening a list ----
  let menu = $state<{ id: number; kind: "download" | "use" } | null>(null);
  const toggleMenu = (id: number, kind: "download" | "use") => (menu = menu?.id === id && menu.kind === kind ? null : { id, kind });

  /** Put a version on the website. A built CV offers the no-phone template given (or the one you are looking at); an uploaded one, its one PDF. */
  async function useOnWebsite(v: Numbered, chosen: VariantKey | null = v.doc ? viewVariant : null) {
    menu = null;
    const template = v.doc ? chosen : null;
    const next = makeLive(data, v.id, today(), template);
    if (next === data) return void (notice = { kind: "err", text: "That template can't go on the website." });
    const what = template ? ` (${VARIANT_LABELS[template]})` : "";
    if (await persist(next, `v${v.n}${what} is now the CV on the website. Live in about a minute.`) && viewing) closeViewer();
  }

  async function remove(v: Numbered) {
    if (!(await persist(removeVersion(data, v.id), `v${v.n} was deleted.`))) return;
    for (const file of ownPdfs(v)) await deleteCvPdf(file.split("/").pop() ?? "").catch(() => {});
    closeViewer();
  }

  /** A built CV without its PDFs (an old one, or one whose upload failed): make all six from its saved content and keep them with it. */
  async function makePdf(v: Numbered) {
    busy = true;
    notice = null;
    try {
      const saved = await loadCvDoc(v.id);
      if (!saved) throw new Error("This version has no saved content to make a PDF from.");
      const cv = parseDoc(saved.text);
      const paths = await Promise.all(VARIANT_KEYS.map(async (k) => [k, (await uploadFile(pdfFileName(v.id, k), await buildCvPdf(cv, k), "cvs")).path] as const));
      const { normal, ...others } = Object.fromEntries(paths) as Record<VariantKey, string>;
      const made = { pdf: normal, pdfs: others };
      busy = false;
      if (await persist({ ...data, versions: data.versions.map((x) => (x.id === v.id ? { ...x, ...made } : x)) }, `The PDFs of v${v.n} were made. They show after the next rebuild (about a minute).`)) {
        viewing = { ...v, ...made };
        await show(viewing, viewVariant);
      }
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? e.message : "Couldn't make the PDFs." };
    } finally {
      busy = false;
    }
  }

  // ---- the "New version" popup ----
  let creator: HTMLDialogElement | undefined = $state();
  let form = $state({ date: "", tag: "Application", note: "", from: "" });
  let file = $state<File | null>(null);
  let formError = $state("");

  function openCreator() {
    form = { date: today(), tag: "Application", note: "", from: "" };
    file = null;
    formError = "";
    creator?.showModal();
  }

  async function create() {
    formError = "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return (formError = "Choose the date of this CV.");
    if (!file) return (formError = "Choose the PDF of this CV.");
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return (formError = "The file must be a PDF.");
    if (file.size > 10 * 1024 * 1024) return (formError = "The PDF can be up to 10 MB.");
    busy = true;
    try {
      const fileName = pdfFileName(nextId(data));
      const { path } = await uploadFile(fileName, file, "cvs");
      const from = Number(form.from);
      const { state, id } = addVersion(data, { date: form.date, tag: form.tag, note: form.note.trim(), from: from > 0 ? from : null, pdf: path, doc: false, locked: true });
      busy = false;
      if (await persist(state, `v${numberOf(state, id)} was saved. Its PDF shows on the site after the next rebuild (about a minute).`)) creator?.close();
    } catch (e) {
      formError = e instanceof Error ? e.message : "Saving failed.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window onclick={() => (menu = null)} onkeydown={(e) => { if (e.key === "Escape") menu = null; }} />

<div class="app">
  <header class="bar">
    <a class="back" href="/admin"><Ic name="arrow-left" size={16} />Admin</a>
    <strong class="title">CV Builder</strong>
    <span class="spacer"></span>
    <span class="status" class:err={notice?.kind === "err"} role="status">{#if busy}Saving…{:else if notice}{notice.text}{/if}</span>
    <a class="icon" href="/cv" target="_blank" rel="noopener" aria-label="Open the CV page" title="Open the CV page"><Ic name="external-link" /></a>
  </header>

  <main class="page">
    <h1>History</h1>
    <p class="lead">Every CV you saved, newest first. The orange one is on the website now. Click a CV to see it.</p>

    {#if loadError}<p class="error">{loadError}</p>{/if}
    {#if loading}<p class="lead">Loading…</p>{:else}
      <div class="newv">
        <a class="btn btn--primary" href="/admin/cv-edit"><Ic name="plus" size={16} />New version</a>
        <button class="btn btn--ghost" type="button" onclick={openCreator} disabled={busy}>Upload an old PDF</button>
      </div>

      <ol class="tl">
        {#each list as v (v.id)}
          <li class="row" class:live={v.id === data.live}>
            <button type="button" class="rowbtn" onclick={() => open(v)}>
              <span class="doc"><Ic name="file-description" size={26} /></span>
              <span class="text">
                <span class="name"><span class="num">v{v.n}</span> – {when(v.date)}
                  {#if v.id === data.live}<span class="chip live"><span class="dot"></span>In use{#if data.liveTemplate} · {VARIANT_LABELS[data.liveTemplate]}{/if}</span>{/if}<span class="chip">{v.tag}</span>{#if !v.locked}<span class="chip draft">Draft</span>{:else if v.doc}<span class="chip locked">Locked</span>{/if}</span>
                {#if v.from}<span class="meta">From v{numberOf(data, v.from)}</span>{/if}
                {#if v.note}<span class="meta note">{v.note}</span>{/if}
                {#if v.id === data.live}
                  <span class="since">On the website since {when(v.liveFrom) || "the start"}</span>
                {:else if v.liveFrom && v.liveTo}
                  <span class="meta">Was on the website {when(v.liveFrom)} – {when(v.liveTo)}</span>
                {/if}
              </span>
            </button>
            <div class="rowtools">
              {#if v.doc}
                <div class="menu">
                  <button class="btn btn--small" type="button" aria-haspopup="menu" aria-expanded={menu?.id === v.id && menu.kind === "download"} onclick={(e) => { e.stopPropagation(); toggleMenu(v.id, "download"); }}><Ic name="download" size={16} />Download</button>
                  {#if menu?.id === v.id && menu.kind === "download"}
                    <div class="pop" role="menu">
                      {#each VARIANT_KEYS as k (k)}
                        {#if pdfOf(v, k)}
                          <a role="menuitem" href={pdfOf(v, k)} download onclick={() => (menu = null)}>{VARIANT_LABELS[k]}</a>
                        {:else}
                          <span class="off" role="menuitem" aria-disabled="true" title="This PDF doesn't exist yet: open the CV and click “Make the PDFs”">{VARIANT_LABELS[k]} <small>not made yet</small></span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="menu">
                  <button class="btn btn--small" class:btn--primary={v.id !== data.live} type="button" aria-haspopup="menu" aria-expanded={menu?.id === v.id && menu.kind === "use"} onclick={(e) => { e.stopPropagation(); toggleMenu(v.id, "use"); }}>{v.id === data.live ? "In use" : "Use on website"} ▾</button>
                  {#if menu?.id === v.id && menu.kind === "use"}
                    <div class="pop" role="menu">
                      <p class="popnote">Only the CVs without your phone number can go on the website.</p>
                      {#each NO_PHONE_KEYS as k (k)}
                        {#if pdfOf(v, k)}
                          <button type="button" role="menuitemradio" aria-checked={v.id === data.live && data.liveTemplate === k} disabled={busy} onclick={() => useOnWebsite(v, k)}>
                            <span class="tick">{v.id === data.live && data.liveTemplate === k ? "✓" : ""}</span>{VARIANT_LABELS[k]}</button>
                        {:else}
                          <span class="off" role="menuitem" aria-disabled="true" title="This PDF doesn't exist yet: open the CV and click “Make the PDFs”"><span class="tick"></span>{VARIANT_LABELS[k]} <small>not made yet</small></span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else}
                {#if v.pdf}<a class="btn btn--small" href={v.pdf} download><Ic name="download" size={16} />Download</a>{/if}
                {#if v.id !== data.live}
                  <button class="btn btn--small btn--primary" type="button" disabled={busy || !v.pdf} onclick={() => useOnWebsite(v, null)}>Use on website</button>
                {:else}
                  <span class="chip live"><span class="dot"></span>In use</span>
                {/if}
              {/if}
            </div>
          </li>
        {:else}
          <li class="empty">No CVs yet. Click “New version” to add the first one.</li>
        {/each}
      </ol>
    {/if}
  </main>
</div>

<dialog class="viewer" bind:this={viewer} onclick={(e) => { if (e.target === viewer) closeViewer(); }} onclose={() => { if (viewUrl.startsWith("blob:")) URL.revokeObjectURL(viewUrl.split("#")[0]); viewing = null; viewUrl = ""; }}>
  {#if viewing}
    {@const v = viewing}
    <header class="vbar">
      <h2><span class="num">v{v.n}</span> – {when(v.date)}</h2>
      {#if v.id === data.live}<span class="chip live"><span class="dot"></span>In use on website</span>{/if}
      <span class="chip">{v.tag}</span>
      {#if !v.locked}<span class="chip draft">Draft</span>{:else if v.doc}<span class="chip locked">Locked</span>{/if}
      {#if v.from}<span class="meta">From v{numberOf(data, v.from)}</span>{/if}
      <span class="spacer"></span>
      {#if confirm === "live"}
        <span class="ask">Put {v.doc ? `“${VARIANT_LABELS[viewVariant]}”` : "this CV"} on the website?</span>
        <button class="btn btn--small btn--primary" type="button" disabled={busy} onclick={() => useOnWebsite(v)}>Yes, use it</button>
        <button class="btn btn--small" type="button" onclick={() => (confirm = null)}>Cancel</button>
      {:else if confirm === "lock"}
        <span class="ask">Lock v{v.n}? It can't be edited after this.</span>
        <button class="btn btn--small btn--primary" type="button" disabled={busy} onclick={() => lock(v)}>Yes, lock it</button>
        <button class="btn btn--small" type="button" onclick={() => (confirm = null)}>Cancel</button>
      {:else if confirm === "delete"}
        <span class="ask">Delete this CV and its PDF?</span>
        <button class="btn btn--small danger" type="button" disabled={busy} onclick={() => remove(v)}>Yes, delete</button>
        <button class="btn btn--small" type="button" onclick={() => (confirm = null)}>Cancel</button>
      {:else}
        {#if pdfOf(v, viewVariant)}
          <a class="btn btn--small" href={pdfOf(v, viewVariant)} download><Ic name="download" size={16} />Download PDF</a>
        {/if}
        {#if v.doc && VARIANT_KEYS.some((k) => !pdfOf(v, k))}
          <button class="btn btn--small" type="button" disabled={busy} title="Some of this CV's four PDFs don't exist yet" onclick={() => makePdf(v)}>{busy ? "Making…" : "Make the PDFs"}</button>
        {/if}
        {#if !v.locked}
          <a class="btn btn--small btn--primary" href={`/admin/cv-edit?edit=${v.id}`}>Edit</a>
          <button class="btn btn--small" type="button" onclick={() => (confirm = "lock")} title="Finished: lock it so it can't change">Lock</button>
        {/if}
        <a class="btn btn--small" href={`/admin/cv-edit?from=${v.id}`}>Duplicate &amp; edit</a>
        {#if v.doc ? !(v.id === data.live && data.liveTemplate === viewVariant) : v.id !== data.live}
          <button class="btn btn--small btn--primary" type="button" disabled={!canUse(v)} title={useHint(v)} onclick={() => (confirm = "live")}>{v.id === data.live ? "Offer this one" : "Use on website"}</button>
        {/if}
        {#if v.id !== data.live}
          <button class="btn btn--small btn--ghost" type="button" onclick={() => (confirm = "delete")} title="Delete this CV" aria-label="Delete this CV"><Ic name="trash" size={16} /></button>
        {/if}
      {/if}
      <button class="btn btn--small btn--ghost" type="button" onclick={closeViewer} aria-label="Close"><Ic name="x" size={16} /></button>
    </header>
    {#if v.doc}
      <div class="vtabs" role="tablist" aria-label="Template">
        {#each VARIANT_KEYS as k (k)}
          <button type="button" role="tab" aria-selected={viewVariant === k} class:on={viewVariant === k} title={VARIANT_HINTS[k]} onclick={() => show(v, k)}>{VARIANT_LABELS[k]}</button>
        {/each}
        {#if v.id === data.live && data.liveTemplate}<span class="meta">The website offers “{VARIANT_LABELS[data.liveTemplate]}”</span>{/if}
        {#if !isNoPhone(viewVariant)}<span class="meta">Has your phone number: only the “no phone” ones can go on the website</span>{/if}
      </div>
    {/if}
    <div class="vbody">
      {#if viewError}<p class="error" style="padding:20px">{viewError}</p>
      {:else if viewUrl}<iframe title={`PDF of v${v.n}`} src={viewUrl}></iframe>
      {:else}<p class="meta" style="padding:20px">Making the PDF…</p>{/if}
    </div>
  {/if}
</dialog>

<dialog class="creator" bind:this={creator} onclick={(e) => { if (e.target === creator) creator?.close(); }}>
  <form onsubmit={(e) => { e.preventDefault(); create(); }}>
    <h2>Upload an old PDF</h2>
    <p class="meta">Add a CV you already have as a PDF. It joins the history; nothing is on the website until you choose “Use on website”.</p>
    <label>Date of this CV<input type="date" bind:value={form.date} required /></label>
    <div class="two">
      <label>Type<select bind:value={form.tag}>{#each TAGS as t}<option>{t}</option>{/each}</select></label>
      <label>Made from<select bind:value={form.from}><option value="">Nothing (from scratch)</option>{#each list as v (v.id)}<option value={String(v.id)}>v{v.n} – {when(v.date)}</option>{/each}</select></label>
    </div>
    <label>Note <span class="meta">(optional)</span><textarea rows="2" bind:value={form.note} placeholder="What is different in this one?"></textarea></label>
    <label>PDF<input type="file" accept="application/pdf,.pdf" onchange={(e) => (file = e.currentTarget.files?.[0] ?? null)} /></label>
    {#if formError}<p class="error">{formError}</p>{/if}
    <div class="actions">
      <button class="btn btn--small" type="button" onclick={() => creator?.close()}>Cancel</button>
      <button class="btn btn--small btn--primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save version"}</button>
    </div>
  </form>
</dialog>

<style>
  .app { min-height: 100vh; background: var(--bg); color: var(--text); }
  .bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 12px 22px; background: var(--surface); }
  .back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; }
  .back:hover { color: var(--ink); }
  .title { color: var(--ink); font-size: 16px; }
  .spacer { flex: 1; }
  .status { font-size: 13px; color: var(--muted); max-width: 52ch; text-align: right; }
  .status.err, .error { color: var(--err); }
  .icon { display: inline-flex; padding: 8px; border-radius: 10px; color: var(--muted); }
  .icon:hover { background: var(--chip); color: var(--ink); }

  .page { max-width: 880px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { font-size: 30px; margin: 0 0 6px; color: var(--ink); }
  .lead { margin: 0 0 22px; color: var(--muted); }
  .newv { margin: 0 0 16px 34px; display: flex; gap: 10px; flex-wrap: wrap; }

  .tl { list-style: none; margin: 0; padding: 0 0 0 34px; position: relative; }
  .tl::before { content: ""; position: absolute; left: 11px; top: 8px; bottom: 8px; width: 2px; background: var(--line); }
  .row { position: relative; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; background: var(--surface); border-radius: 18px; padding-right: 14px; }
  .row:hover { background: var(--surface-2); }
  .row::before { content: ""; position: absolute; left: -29px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; background: var(--chip); box-shadow: 0 0 0 4px var(--bg); }
  .row.live::before { background: var(--accent); }
  .rowbtn { all: unset; box-sizing: border-box; flex: 1; min-width: 0; display: flex; gap: 16px; align-items: center; padding: 14px 18px; border-radius: 18px; cursor: pointer; }
  .rowbtn:focus-visible { outline: 2px solid var(--accent); }
  .row.live { box-shadow: 0 0 0 2px var(--accent); }
  .rowtools { display: flex; align-items: center; gap: 8px; flex: none; margin-left: auto; }
  .menu { position: relative; }
  .pop { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 270px; padding: 6px; display: flex; flex-direction: column; background: var(--surface-2); border-radius: 14px; box-shadow: 0 12px 34px rgb(0 0 0 / 0.5); }
  .pop a, .pop button, .pop .off { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 12px; border-radius: 10px; font-size: 14px; color: var(--ink); cursor: pointer; }
  .pop a:hover, .pop button:hover:not(:disabled) { background: var(--chip); }
  .pop .off { color: var(--muted); cursor: not-allowed; }
  .pop .off small { margin-left: auto; font-size: 11.5px; }
  .pop .tick { width: 14px; color: var(--accent-text); }
  .popnote { margin: 4px 12px 6px; font-size: 12px; color: var(--muted); }
  .doc { flex: none; display: grid; place-items: center; width: 46px; height: 62px; border-radius: 6px; background: var(--chip); color: var(--muted); }
  .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-weight: 600; color: var(--ink); }
  .num { color: var(--muted); font-weight: 500; margin-right: 2px; }
  .meta { font-size: 13px; color: var(--muted); }
  .since { font-size: 12.5px; color: var(--accent-text); }
  .chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; background: var(--chip); color: var(--text); }
  .chip.live { background: var(--accent); color: var(--on-accent); }
  .chip.draft { background: transparent; box-shadow: inset 0 0 0 1px var(--muted); color: var(--muted); }
  .chip.locked { background: transparent; color: var(--muted); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .empty { padding: 20px; color: var(--muted); }

  dialog { border: 0; padding: 0; border-radius: 22px; background: var(--surface); color: var(--text); }
  dialog::backdrop { background: rgb(5 6 8 / 0.7); }
  .viewer { width: min(980px, calc(100vw - 32px)); height: min(92vh, 1200px); }
  .viewer[open] { display: flex; flex-direction: column; }
  .vbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px 12px 22px; }
  .vbar h2 { font-size: 17px; margin: 0; color: var(--ink); }
  .ask { font-size: 14px; color: var(--ink); }
  .vbar :global(button:disabled) { opacity: .4; cursor: not-allowed; }
  .danger { background: var(--err); color: #fff; }
  .vtabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 22px 10px; }
  .vtabs button { border: 0; background: var(--chip); color: var(--text); border-radius: 999px; padding: 5px 13px; font: 600 12.5px/1 inherit; cursor: pointer; }
  .vtabs button:hover { background: var(--line); }
  .vtabs button.on { background: var(--ink); color: var(--bg); }
  .vtabs .meta { margin-left: 8px; }
  .vbody { flex: 1; min-height: 0; background: var(--surface-2); }
  .vbody iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }

  .creator { width: min(520px, calc(100vw - 32px)); }
  .creator form { display: flex; flex-direction: column; gap: 14px; padding: 24px; }
  .creator h2 { margin: 0; color: var(--ink); font-size: 20px; }
  .creator p { margin: 0; }
  .creator label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--muted); }
  .creator input:not([type="file"]), .creator select, .creator textarea { background: var(--chip); border: 0; border-radius: 12px; color: var(--ink); font: inherit; padding: 10px 12px; }
  .creator input[type="file"] { color: var(--text); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
