<script lang="ts">
  // The CV Builder's editor: choose and edit what goes into a CV on the left, see the real A4 pages on the right.
  // "Export PDF" downloads the PDF; "Save version" keeps the content and its PDF as the next version in the history.
  import { onMount, tick } from "svelte";
  import { DEFAULT_FONT_SIZE, DEFAULT_LINE_SPACING, DEFAULT_SPACING, FONT_SIZE_RANGE, LINE_SPACING_RANGE, MAX_SPACING, SPACING_LABELS, VARIANT_HINTS, VARIANT_KEYS, VARIANT_LABELS, blankEntry, blankPaper, defaultLook, lookKeyOf, moveItem, parseDoc, spacingValue, stringifyDoc, type CvDoc, type DocEntry, type VariantKey } from "../../lib/cv-document";
  import { buildCvPdf } from "../../lib/pdf-cv-document";
  import { TAGS, addVersion, lockVersion, newestFirst, nextId, numberOf, parseVersions, pdfFileName, stringifyVersions, updateDraft, EMPTY_VERSIONS, type CvVersions } from "../../lib/cv-versions";
  import { loadCvDoc, loadPage, saveCvVersion } from "../../lib/editor-api";
  import Ic from "./Ic.svelte";
  import PdfPages from "./PdfPages.svelte";

  let { seed }: { seed: string } = $props();

  let doc = $state<CvDoc>(parseDoc(seed));
  let versions = $state<CvVersions>(structuredClone(EMPTY_VERSIONS));
  let versionsSha = $state<string | null>(null);
  let baseId = $state<number | null>(null);
  let startedFrom = $state("the current CV content");
  /** Editing a draft in place (?edit=3): its id and the version tag of its saved content. Otherwise a new version. */
  let editId = $state<number | null>(null);
  let editSha = $state<string | undefined>(undefined);
  const editNumber = $derived(editId ? numberOf(versions, editId) : 0);
  let loading = $state(true);
  let loadError = $state("");
  let savedJson = $state("");

  const snapshot = () => $state.snapshot(doc) as CvDoc;
  const dirty = $derived(JSON.stringify($state.snapshot(doc)) !== savedJson);

  onMount(async () => {
    try {
      const file = await loadPage("cv-versions");
      versions = file.text.trim() ? parseVersions(file.text) : structuredClone(EMPTY_VERSIONS);
      versionsSha = file.sha;
      const params = new URLSearchParams(location.search);
      const toEdit = Number(params.get("edit")) || 0;
      if (toEdit > 0) {
        const v = versions.versions.find((x) => x.id === toEdit);
        const n = numberOf(versions, toEdit);
        if (!v || !v.doc) throw new Error(`v${n || toEdit} has no saved content to edit.`);
        if (v.locked) throw new Error(`v${n} is locked (finished). Use “Duplicate & edit” in the history to make a new version from it.`);
        const saved = await loadCvDoc(toEdit);
        if (!saved) throw new Error(`v${n} has no saved content to edit.`);
        doc = parseDoc(saved.text);
        editId = toEdit;
        editSha = saved.sha;
        baseId = v.from;
      } else {
        const asked = Number(params.get("from")) || 0;
        const base = asked > 0 ? versions.versions.find((v) => v.id === asked) : newestFirst(versions.versions).find((v) => v.doc);
        if (base?.doc) {
          const saved = await loadCvDoc(base.id);
          if (saved) {
            doc = parseDoc(saved.text);
            baseId = base.id;
            startedFrom = `v${numberOf(versions, base.id)}`;
          }
        } else if (base) {
          baseId = base.id; // a PDF-only version: its content is not saved, so the page starts from the current CV content
        }
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Couldn't load the CV Builder.";
    } finally {
      savedJson = JSON.stringify(snapshot());
      loading = false;
    }
    const warn = (e: BeforeUnloadEvent) => { if (dirty && !saving) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });

  // ---- the preview ----
  let pageCount = $state(1);
  let stageWidth = $state(900);
  let stageHeight = $state(700);
  /** "width": the page as wide as the space; "page": the whole page in view; a number: a zoom you chose (1 = 100 %). */
  let zoomMode = $state<"width" | "page" | number>("width");
  const PAGE_W = 794; // an A4 page at 100 %, in screen pixels
  const PAGE_H = 1123;
  const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const zoom = $derived(
    zoomMode === "width" ? Math.max(0.2, (stageWidth - 48) / PAGE_W)
    : zoomMode === "page" ? Math.max(0.2, Math.min((stageWidth - 48) / PAGE_W, (stageHeight - 64) / PAGE_H))
    : zoomMode,
  );
  /** One step bigger (+1) or smaller (-1) from the zoom you see now. */
  function stepZoom(dir: 1 | -1) {
    const next = dir > 0 ? ZOOMS.find((z) => z > zoom + 0.001) : [...ZOOMS].reverse().find((z) => z < zoom - 0.001);
    if (next) zoomMode = next;
  }
  // Ctrl + mouse wheel zooms the page (not the whole editor).
  function wheelZoom(e: WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }

  // ---- the four templates: the content is the same; the preview shows one, and the Look tab changes that one's look ----
  let variant = $state<VariantKey>("normal");
  /** The layout whose look is edited: a no-phone template has the look of its layout, only the number is hidden. */
  const lookKey = $derived(lookKeyOf(variant));
  const look = $derived(doc.variants[lookKey]);

  // ---- spacing: the slider in use (or "Show all gaps") marks those gaps pink on the preview ----
  let showGap = $state<string | null>(null);

  /** The spacing controls, in the order the gaps appear on the page. `id` is the name the PDF uses to mark the gap pink. */
  interface GapControl { id: string; label: string; get: () => number; set: (mm: number) => void; group?: string }
  const gapControls = $derived.by((): GapControl[] => {
    const fixed = (key: keyof typeof DEFAULT_SPACING, label = SPACING_LABELS[key]): GapControl => ({ id: key, label, get: () => doc.variants[lookKey].spacing[key], set: (v) => (doc.variants[lookKey].spacing[key] = v) });
    const list: GapControl[] = [fixed("afterName"), fixed("afterContact"), fixed("skillsTop"), fixed("skillsBottom")];
    const shown = doc.sections.filter((s) => s.show && s.entries.some((e) => e.show));
    shown.forEach((s, i) => {
      const before = i === 0 ? "Skills" : shown[i - 1].title;
      list.push({ id: `section:${s.key}`, group: s.title, label: `${before} → ${s.title}`, get: () => doc.variants[lookKey].sectionGap[s.key], set: (v) => (doc.variants[lookKey].sectionGap[s.key] = v) });
      list.push({ id: `entry:${s.key}`, group: s.title, label: s.key === "certifications" ? `Between ${s.title.toLowerCase()} rows` : `Between ${s.title.toLowerCase()} entries`, get: () => doc.variants[lookKey].entryGap[s.key], set: (v) => (doc.variants[lookKey].entryGap[s.key] = v) });
    });
    list.push(fixed("beforeHeading"), fixed("afterHeading"));
    return list;
  });

  function resetSpacing() {
    doc.variants[lookKey] = defaultLook(); // this layout only
  }
  let showAllGaps = $state(false);

  // The preview is the real PDF (the same file Export PDF gives), made again a moment after each change.
  let preview = $state<Blob | null>(null);
  let previewError = $state("");
  let building = 0;
  $effect(() => {
    const d = $state.snapshot(doc) as CvDoc; // reading it deeply makes this run on every change
    const mark = showAllGaps ? "all" : showGap;
    const which = variant;
    const ticket = ++building;
    const timer = setTimeout(async () => {
      try {
        const blob = await buildCvPdf(d, which, { markGaps: mark });
        if (ticket === building) { preview = blob; previewError = ""; }
      } catch (e) {
        if (ticket === building) previewError = e instanceof Error ? e.message : "Couldn't make the preview.";
      }
    }, 200);
    return () => clearTimeout(timer);
  });

  // ---- the panel ----
  let tab = $state<"content" | "look">("content");
  /** The open block of the panel (header, skills or one section) and, inside a section, the open entry. */
  let open = $state<string | null>(null);
  let openEntry = $state<string | null>(null);
  const toggle = (key: string) => { open = open === key ? null : key; openEntry = null; };
  const toggleEntry = (key: string) => (openEntry = openEntry === key ? null : key);

  function addEntry(si: number) {
    const key = doc.sections[si].key;
    const entry: DocEntry = { ...blankEntry(), title: "New entry", period: "Year", org: key === "projects" || key === "certifications" ? "" : "Organization" };
    doc.sections[si].entries.push(entry);
    openEntry = `${si}-${doc.sections[si].entries.length - 1}`;
  }
  const removeEntry = (si: number, ei: number) => { doc.sections[si].entries.splice(ei, 1); openEntry = null; };
  const moveEntry = (si: number, ei: number, dir: -1 | 1) => { doc.sections[si].entries = moveItem(doc.sections[si].entries, ei, dir); openEntry = null; };
  const moveSection = (si: number, dir: -1 | 1) => { doc.sections = moveItem(doc.sections, si, dir); open = null; openEntry = null; };
  const setLines = (entry: DocEntry, text: string) => { entry.lines = text.split("\n"); };

  /**
   * Bold for the text you select (the PDF shows **words between stars** in bold). With nothing selected it puts the stars where
   * the cursor is; on text that is already bold it takes the bold off again. `apply` stores the new text.
   */
  function toggleBold(el: HTMLTextAreaElement | HTMLInputElement | null, apply: (text: string) => void) {
    if (!el || el.selectionStart === null || el.selectionEnd === null) return;
    const [a, b, value] = [el.selectionStart, el.selectionEnd, el.value];
    const before = value.slice(0, a), picked = value.slice(a, b), after = value.slice(b);
    let next: string, from: number, to: number;
    if (before.endsWith("**") && after.startsWith("**")) {
      [next, from, to] = [before.slice(0, -2) + picked + after.slice(2), a - 2, b - 2]; // the stars are around the selection: take them off
    } else if (picked.length >= 4 && picked.startsWith("**") && picked.endsWith("**")) {
      [next, from, to] = [before + picked.slice(2, -2) + after, a, b - 4]; // the selection includes the stars
    } else if (a === b) {
      [next, from, to] = [before + "****" + after, a + 2, a + 2];
    } else {
      [next, from, to] = [before + "**" + picked + "**" + after, a + 2, b + 2];
    }
    apply(next);
    tick().then(() => { el.focus(); el.setSelectionRange(from, to); });
  }
  const boldKey = (e: KeyboardEvent, apply: (text: string) => void) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleBold(e.currentTarget as HTMLTextAreaElement | HTMLInputElement, apply);
    }
  };
  /** The text box next to a bold button. */
  const boxOf = (button: EventTarget | null) => (button as HTMLElement).closest(".rich")?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input") ?? null;

  // ---- export and save ----
  let saving = $state(false);
  let notice = $state<{ kind: "ok" | "err"; text: string } | null>(null);

  let exporting = $state(false);

  /** Makes the PDF of the template you are looking at and downloads it, to look at it or send it. */
  async function exportPdf() {
    exporting = true;
    notice = null;
    try {
      const blob = await buildCvPdf(snapshot(), variant);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CV ${doc.header.name.trim() || "CV"} - ${VARIANT_LABELS[variant]}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } catch (e) {
      notice = { kind: "err", text: e instanceof Error ? `Couldn't make the PDF: ${e.message}` : "Couldn't make the PDF." };
    } finally {
      exporting = false;
    }
  }

  let saver: HTMLDialogElement | undefined = $state();
  let form = $state({ date: "", tag: "Application", note: "", from: "", lock: false });
  let formError = $state("");
  const today = () => new Date().toISOString().slice(0, 10);
  /** The number the new version will get, which depends on the date chosen. */
  const newNumber = $derived.by(() => {
    const id = nextId(versions);
    return numberOf({ ...versions, versions: [...versions.versions, { id, date: form.date, tag: "", note: "", from: null, pdf: "", doc: true, liveFrom: "", liveTo: "" }] }, id);
  });
  const when = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

  function openSaver() {
    const v = editId ? versions.versions.find((x) => x.id === editId) : undefined;
    form = v
      ? { date: v.date || today(), tag: v.tag, note: v.note, from: v.from ? String(v.from) : "", lock: v.id === versions.live } // the CV on the website is locked again when saved
      : { date: today(), tag: "Application", note: "", from: baseId ? String(baseId) : "", lock: false };
    formError = "";
    saver?.showModal();
  }

  /** Makes the six PDFs of this CV: "normal" is the main one, the others go in `pdfs`. They are saved together with the version. */
  async function makePdfs(id: number) {
    const doc = snapshot();
    const made = await Promise.all(VARIANT_KEYS.map(async (k) => ({ k, name: pdfFileName(id, k), blob: await buildCvPdf(doc, k) })));
    const path = (name: string) => `/data/cvs/${name}`;
    const { normal, ...others } = Object.fromEntries(made.map((m) => [m.k, path(m.name)])) as Record<VariantKey, string>;
    return { files: made.map((m) => ({ name: m.name, blob: m.blob })), pdf: normal, pdfs: others };
  }

  async function saveVersion() {
    formError = "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return (formError = "Choose the date of this CV.");
    saving = true;
    try {
      const from = Number(form.from) > 0 ? Number(form.from) : null;
      const details = { date: form.date, tag: form.tag, note: form.note.trim(), from };
      let state: CvVersions;
      const id = editId ?? nextId(versions);
      const { files, pdf, pdfs } = await makePdfs(id); // the six PDFs are made with the version
      if (editId) state = updateDraft(versions, id, { ...details, pdf, pdfs }); // a draft: its content and PDFs are replaced, its number stays
      else state = addVersion(versions, { ...details, pdf, pdfs, doc: true }).state;
      if (form.lock) state = lockVersion(state, id);
      // the list, the content and the six PDFs go in ONE commit
      await saveCvVersion({ versions: { text: stringifyVersions(state), sha: versionsSha }, doc: { id, text: stringifyDoc(snapshot()), sha: editId ? editSha : undefined }, pdfs: files });
      savedJson = JSON.stringify(snapshot());
      location.href = "/admin/cv-builder";
    } catch (e) {
      formError = e instanceof Error ? e.message : "Saving failed.";
      saving = false;
    }
  }
</script>

<div class="app">
  <header class="bar">
    <a class="back" href="/admin/cv-builder"><Ic name="arrow-left" size={16} />CV Builder</a>
    {#if editId}
      <strong class="title">Editing v{editNumber}</strong>
      <span class="from">draft · saving replaces it</span>
    {:else}
      <strong class="title">New version</strong>
      <span class="from">started from {startedFrom}</span>
    {/if}
    <span class="spacer"></span>
    <span class="status" class:err={notice?.kind === "err"} role="status">{#if notice}{notice.text}{:else if dirty}Not saved yet{/if}</span>
    <button class="btn btn--small" type="button" onclick={exportPdf} disabled={loading || exporting}><Ic name="download" size={16} />{exporting ? "Making PDF…" : "Export PDF"}</button>
    <button class="btn btn--small btn--primary" type="button" onclick={openSaver} disabled={loading || !!loadError}>{editId ? `Save v${editNumber}` : "Save version"}</button>
  </header>

  <div class="main">
    <aside class="panel">
      {#if loadError}<p class="error">{loadError}</p>{/if}
      <div class="tabs">
        <button type="button" class:on={tab === "content"} onclick={() => (tab = "content")}>Content</button>
        <button type="button" class:on={tab === "look"} onclick={() => (tab = "look")}>Look</button>
      </div>

      {#if tab === "content"}
        <section class="box">
          <button class="boxhead" type="button" onclick={() => toggle("header")}>Header &amp; contact<span class="chev">{open === "header" ? "−" : "+"}</span></button>
          {#if open === "header"}
            <div class="fields">
              <label>Name<input bind:value={doc.header.name} /></label>
              <label>Email<input bind:value={doc.header.email} /></label>
              <label>Phone <span class="hint">(shown only when “Show phone” is on, in Look)</span><input bind:value={doc.header.phone} placeholder="+351 …" /></label>
              <div class="two">
                <label>Birth date<input bind:value={doc.header.birth} /></label>
                <label>Driving licence<input bind:value={doc.header.licence} /></label>
              </div>
              <div class="two">
                <label>Lives in<input bind:value={doc.header.location} /></label>
                <label>Small line under it<input bind:value={doc.header.origin} /></label>
              </div>
              <label>Languages <span class="hint">(separated by commas)</span><input bind:value={doc.header.languages} /></label>
              <div class="two">
                <label>Website<input bind:value={doc.header.website} /></label>
                <label>LinkedIn<input bind:value={doc.header.linkedin} /></label>
              </div>
              <label>Photo<input bind:value={doc.header.photo} placeholder="/images/…" /></label>
            </div>
          {/if}
        </section>

        <section class="box">
          <button class="boxhead" type="button" onclick={() => toggle("lines")}>Skills &amp; interests<span class="chev">{open === "lines" ? "−" : "+"}</span></button>
          {#if open === "lines"}
            <div class="fields">
              <label>Skills / Tools<textarea rows="3" bind:value={doc.skills}></textarea></label>
              <label>Interests<textarea rows="3" bind:value={doc.interests}></textarea></label>
            </div>
          {/if}
        </section>

        {#each doc.sections as section, si (section.key)}
          <section class="box" class:off={!section.show}>
            <div class="sechead">
              <button class="boxhead grow" type="button" onclick={() => toggle(`s${si}`)}>{section.title}<span class="count">{section.entries.filter((e) => e.show).length}/{section.entries.length}</span><span class="chev">{open === `s${si}` ? "−" : "+"}</span></button>
              <button class="mini" type="button" onclick={() => moveSection(si, -1)} disabled={si === 0} aria-label="Move section up"><Ic name="arrow-up" size={15} /></button>
              <button class="mini" type="button" onclick={() => moveSection(si, 1)} disabled={si === doc.sections.length - 1} aria-label="Move section down"><Ic name="arrow-down" size={15} /></button>
              <button class="switch" class:on={section.show} type="button" role="switch" aria-checked={section.show} aria-label={`Show ${section.title}`} onclick={() => (section.show = !section.show)}></button>
            </div>
            {#if open === `s${si}`}
              <div class="fields">
                <label>Section title<input bind:value={section.title} /></label>
                {#each section.entries as entry, ei (ei)}
                  <div class="entry" class:off={!entry.show}>
                    <div class="entryhead">
                      <button class="entrytitle" type="button" onclick={() => toggleEntry(`${si}-${ei}`)}>{entry.title || "(no title)"}{entry.org ? ` · ${entry.org}` : ""}</button>
                      <button class="mini" type="button" onclick={() => moveEntry(si, ei, -1)} disabled={ei === 0} aria-label="Move up"><Ic name="arrow-up" size={15} /></button>
                      <button class="mini" type="button" onclick={() => moveEntry(si, ei, 1)} disabled={ei === section.entries.length - 1} aria-label="Move down"><Ic name="arrow-down" size={15} /></button>
                      <button class="switch" class:on={entry.show} type="button" role="switch" aria-checked={entry.show} aria-label="Show this entry" onclick={() => (entry.show = !entry.show)}></button>
                    </div>
                    {#if openEntry === `${si}-${ei}`}
                      <div class="fields inner">
                        <label>{section.key === "projects" ? "Project" : section.key === "certifications" ? "Certificate" : "Title / role"}<input bind:value={entry.title} /></label>
                        {#if section.key !== "projects"}<label>{section.key === "certifications" ? "Issuer (optional)" : "Company / institution"}<input bind:value={entry.org} /></label>{/if}
                        <div class="two">
                          {#if section.key !== "certifications"}<label>Location<input bind:value={entry.location} /></label>{/if}
                          <label>Period / date<input bind:value={entry.period} /></label>
                        </div>
                        {#if section.key === "certifications"}
                          <label>Badge picture<input bind:value={entry.badge} placeholder="/images/cv/certifications/…" /></label>
                        {:else}
                          <div class="rich">
                            <div class="richbar"><span>Line under the heading <span class="hint">(project or thesis title)</span></span>
                              <button class="boldbtn" type="button" title="Bold: select text, then click (or Ctrl+B)" aria-label="Bold" onmousedown={(e) => e.preventDefault()} onclick={(e) => toggleBold(boxOf(e.currentTarget), (v) => (entry.intro = v))}><b>B</b></button></div>
                            <input bind:value={entry.intro} onkeydown={(e) => boldKey(e, (v) => (entry.intro = v))} />
                          </div>
                          <div class="rich">
                            <div class="richbar"><span>Bullet points <span class="hint">(one per line)</span></span>
                              <button class="boldbtn" type="button" title="Bold: select text, then click (or Ctrl+B)" aria-label="Bold" onmousedown={(e) => e.preventDefault()} onclick={(e) => toggleBold(boxOf(e.currentTarget), (v) => setLines(entry, v))}><b>B</b></button></div>
                            <textarea rows="6" value={entry.lines.join("\n")} oninput={(e) => setLines(entry, e.currentTarget.value)} onkeydown={(e) => boldKey(e, (v) => setLines(entry, v))}></textarea>
                          </div>
                          {#each entry.papers as paper, pi (pi)}
                            <div class="paperbox">
                              <div class="two"><label>Label<input bind:value={paper.label} /></label><label>Title<input bind:value={paper.title} /></label></div>
                              <label>Second line<input bind:value={paper.detail} placeholder="Journal, DOI…" /></label>
                              <button class="link" type="button" onclick={() => entry.papers.splice(pi, 1)}>Remove this line</button>
                            </div>
                          {/each}
                          <button class="link" type="button" onclick={() => entry.papers.push(blankPaper())}>+ Add a paper line</button>
                          {#if section.key === "projects"}<label>“More details” link<input bind:value={entry.moreUrl} placeholder="https://…" /></label>{/if}
                        {/if}
                        <button class="link danger" type="button" onclick={() => removeEntry(si, ei)}>Delete this entry</button>
                      </div>
                    {/if}
                  </div>
                {/each}
                <button class="btn btn--small btn--ghost" type="button" onclick={() => addEntry(si)}><Ic name="plus" size={15} />Add entry</button>
              </div>
            {/if}
          </section>
        {/each}
      {:else}
        <section class="box"><div class="fields">
          <p class="hint looknote">Everything on this tab is the look of <b>{VARIANT_LABELS[lookKey]}</b>{#if lookKey !== variant}, which the template on the page (“{VARIANT_LABELS[variant]}”) shares: the only difference is the hidden phone number{/if}. Choose a layout above the page to change another one. The content is always the same.</p>
          <div class="space">
            <span class="spacelabel">Text size <span class="hint">(in pt; the name, titles and details scale with it; {DEFAULT_FONT_SIZE} is the default)</span></span>
            <div class="spacerow">
              <input type="range" min={FONT_SIZE_RANGE[0]} max={FONT_SIZE_RANGE[1]} step="0.1" value={look.fontSize} oninput={(e) => (doc.variants[lookKey].fontSize = Number(e.currentTarget.value))} aria-label="Text size, slider" />
              <input class="mm" type="number" min={FONT_SIZE_RANGE[0]} max={FONT_SIZE_RANGE[1]} step="0.1" value={look.fontSize}
                oninput={(e) => { const n = Number(e.currentTarget.value); if (e.currentTarget.value !== "" && n >= FONT_SIZE_RANGE[0] && n <= FONT_SIZE_RANGE[1]) doc.variants[lookKey].fontSize = Math.round(n * 10) / 10; }}
                onblur={(e) => (e.currentTarget.value = String(look.fontSize))} aria-label="Text size" />
              <span class="unit">pt</span>
            </div>
          </div>
          <div class="space">
            <span class="spacelabel">Line spacing <span class="hint">(1 = lines as tall as the letters; {DEFAULT_LINE_SPACING} is the default)</span></span>
            <div class="spacerow">
              <input type="range" min={LINE_SPACING_RANGE[0]} max={LINE_SPACING_RANGE[1]} step="0.05" value={look.lineSpacing} oninput={(e) => (doc.variants[lookKey].lineSpacing = Number(e.currentTarget.value))} aria-label="Line spacing, slider" />
              <input class="mm" type="number" min={LINE_SPACING_RANGE[0]} max={LINE_SPACING_RANGE[1]} step="0.05" value={look.lineSpacing}
                oninput={(e) => { const n = Number(e.currentTarget.value); if (e.currentTarget.value !== "" && n >= LINE_SPACING_RANGE[0] && n <= LINE_SPACING_RANGE[1]) doc.variants[lookKey].lineSpacing = Math.round(n * 100) / 100; }}
                onblur={(e) => (e.currentTarget.value = String(look.lineSpacing))} aria-label="Line spacing" />
              <span class="unit">×</span>
            </div>
          </div>
          <p class="hint">Template 1: your uploaded Word CV. More templates and colours come later.</p>
        </div></section>
        <section class="box"><div class="fields">
          <div class="spacehead"><strong>Spacing</strong><span class="hint">in mm · the gap you change is marked pink on the page</span></div>
          {#each gapControls as g (g.id)}
            <div class="space" role="group" aria-label={g.label} onpointerenter={() => (showGap = g.id)} onpointerleave={() => (showGap = null)} onfocusin={() => (showGap = g.id)} onfocusout={() => (showGap = null)}>
              <span class="spacelabel">{g.label}</span>
              <div class="spacerow">
                <input type="range" min="0" max={MAX_SPACING} step="0.5" value={g.get()} oninput={(e) => g.set(Number(e.currentTarget.value))} aria-label={`${g.label}, slider`} />
                <input class="mm" type="number" min="0" max={MAX_SPACING} step="0.1" value={g.get()}
                  oninput={(e) => { const v = spacingValue(e.currentTarget.value, NaN); if (!Number.isNaN(v)) g.set(v); }}
                  onblur={(e) => (e.currentTarget.value = String(g.get()))} aria-label={`${g.label}, in mm`} />
                <span class="unit">mm</span>
              </div>
            </div>
          {/each}
          <label class="check"><input type="checkbox" bind:checked={showAllGaps} />Show all gaps on the page</label>
          <button class="link" type="button" onclick={resetSpacing}>Back to the default spacing</button>
        </div></section>
      {/if}
    </aside>

    <section class="stage" bind:clientWidth={stageWidth} bind:clientHeight={stageHeight} onwheel={wheelZoom}>
      <div class="stagebar">
        <div class="variantbar" role="tablist" aria-label="Template">
          {#each VARIANT_KEYS as k (k)}
            <button type="button" role="tab" aria-selected={variant === k} class:on={variant === k} title={VARIANT_HINTS[k]} onclick={() => (variant = k)}>{VARIANT_LABELS[k]}</button>
          {/each}
        </div>
        <div class="zoomtools">
          <span class="count" title="Pages of the CV">{pageCount}&nbsp;p.</span>
          <button type="button" class:on={zoomMode === "page"} onclick={() => (zoomMode = "page")} title="The whole page on the screen">Fit page</button>
          <button type="button" class:on={zoomMode === "width"} onclick={() => (zoomMode = "width")} title="The page as wide as the space. Ctrl + mouse wheel zooms in and out">Fit width</button>
          <button type="button" class:on={zoomMode === 1} onclick={() => (zoomMode = 1)} title="Real size">100%</button>
        </div>
      </div>
      {#if previewError}<p class="error">The preview failed: {previewError}</p>{/if}
      <div class="sheet"><PdfPages pdf={preview} {zoom} onpages={(n) => (pageCount = n)} /></div>
    </section>
  </div>
</div>

<dialog class="saver" bind:this={saver} onclick={(e) => { if (e.target === saver) saver?.close(); }}>
  <form onsubmit={(e) => { e.preventDefault(); saveVersion(); }}>
    {#if editId}
      <h2>Save v{editNumber}</h2>
      <p class="hint">Its content and PDFs are replaced.{versions.live === editId ? " It is on the website, so the public CV page changes after the rebuild." : " It stays a draft you can edit again, unless you lock it below."}</p>
    {:else}
      <h2>Save as a new version</h2>
      <p class="hint">It joins the history as v{newNumber}, as a draft you can still edit. Nothing changes on the website until you choose “Use on website”.</p>
    {/if}
    <div class="two">
      <label>Date of this CV<input type="date" bind:value={form.date} required /></label>
      <label>Type<select bind:value={form.tag}>{#each TAGS as t}<option>{t}</option>{/each}</select></label>
    </div>
    <label>Made from<select bind:value={form.from}><option value="">Nothing (from scratch)</option>{#each newestFirst(versions.versions) as v (v.id)}<option value={String(v.id)}>v{v.n} – {when(v.date)}</option>{/each}</select></label>
    <label>Note <span class="hint">(optional)</span><textarea rows="2" bind:value={form.note} placeholder="What is different in this one?"></textarea></label>
    <label class="lockrow"><input type="checkbox" bind:checked={form.lock} /><span><b>Lock it: it's finished</b> (you're sending it out). A locked CV can't be edited any more; “Duplicate &amp; edit” makes a new version from it.</span></label>
    {#if formError}<p class="error">{formError}</p>{/if}
    <div class="actions">
      <button class="btn btn--small" type="button" onclick={() => saver?.close()}>Cancel</button>
      <button class="btn btn--small btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editId ? `Save v${editNumber}` : "Save version"}</button>
    </div>
  </form>
</dialog>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--text); }
  .bar { display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: var(--surface); flex: none; }
  .back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; }
  .back:hover { color: var(--ink); }
  .title { color: var(--ink); font-size: 16px; }
  .from { font-size: 13px; color: var(--muted); }
  .spacer { flex: 1; }
  .status { font-size: 13px; color: var(--muted); max-width: 46ch; text-align: right; }
  .status.err, .error { color: var(--err); }

  .main { flex: 1; min-height: 0; display: grid; grid-template-columns: 400px minmax(0, 1fr); }
  .panel { overflow: auto; padding: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
  .tabs { display: flex; gap: 6px; }
  .tabs button { border: 0; background: var(--chip); color: var(--text); border-radius: 999px; padding: 7px 16px; font-weight: 600; font-size: 13.5px; cursor: pointer; }
  .tabs button.on { background: var(--ink); color: var(--bg); }

  .box { background: var(--surface-2); border-radius: 14px; padding: 4px 10px; }
  .box.off { opacity: .55; }
  .boxhead { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 2px; cursor: pointer; font-weight: 600; color: var(--ink); }
  .boxhead.grow { flex: 1; width: auto; }
  .chev { margin-left: auto; color: var(--muted); font-weight: 400; }
  .count { font-size: 12px; font-weight: 500; color: var(--muted); }
  .sechead { display: flex; align-items: center; gap: 4px; }
  .sechead .chev { margin-left: 6px; }
  .mini { all: unset; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: var(--muted); cursor: pointer; }
  .mini:hover:not(:disabled) { background: var(--chip); color: var(--ink); }
  .mini:disabled { opacity: .3; cursor: default; }
  .switch { all: unset; flex: none; width: 34px; height: 20px; border-radius: 999px; background: var(--chip); position: relative; cursor: pointer; margin-left: 4px; }
  .switch::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--muted); transition: transform .12s; }
  .switch.on { background: var(--accent); }
  .switch.on::after { transform: translateX(14px); background: var(--on-accent); }
  .switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .fields { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 10px; }
  .fields.inner { padding: 6px 0 4px; }
  .fields label, .fields .rich { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--muted); }
  .richbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .boldbtn { border: 0; background: var(--chip); color: var(--ink); width: 26px; height: 24px; border-radius: 7px; cursor: pointer; font-size: 13px; line-height: 1; }
  .boldbtn:hover { background: var(--line); }
  .fields input:not([type="checkbox"]), .fields textarea, .fields select, .saver input:not([type="file"]), .saver select, .saver textarea {
    background: var(--chip); border: 0; border-radius: 10px; color: var(--ink); font: inherit; font-size: 14px; padding: 8px 10px; width: 100%; }
  .fields textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hint { font-weight: 400; color: var(--muted); font-size: 12px; }
  .check { flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--text) !important; font-size: 14px !important; }
  .entry { background: var(--surface); border-radius: 12px; padding: 2px 8px; }
  .spacehead { display: flex; flex-direction: column; gap: 2px; color: var(--ink); }
  .space { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
  .spacelabel { color: var(--text); font-size: 13px; }
  .spacerow { display: flex; align-items: center; gap: 8px; }
  .spacerow input[type="range"] { flex: 1; min-width: 0; padding: 0; background: none; accent-color: var(--accent); }
  .spacerow input.mm { width: 62px !important; flex: none; text-align: right; background: var(--chip); border: 0; border-radius: 8px; color: var(--ink); font: inherit; font-size: 13px; padding: 5px 8px; }
  .unit { font-size: 12px; color: var(--muted); }
  .entry.off { opacity: .5; }
  .entryhead { display: flex; align-items: center; gap: 2px; }
  .entrytitle { all: unset; flex: 1; min-width: 0; padding: 8px 2px; font-size: 13.5px; color: var(--ink); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .paperbox { background: var(--surface-2); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .link { all: unset; cursor: pointer; font-size: 13px; color: var(--accent-text); align-self: flex-start; }
  .link:hover { text-decoration: underline; }
  .link.danger { color: var(--err); }

  .stage { overflow: auto; background: #2a2d33; padding: 16px 0 40px; display: flex; flex-direction: column; align-items: center; }
  /* Zoomed in wider than the space: the pages scroll sideways instead of being cut off on the left. */
  .sheet { align-self: safe center; }
  /* The template tabs and the zoom controls stay together at the top while the pages scroll under them. */
  /* One row at the top: the template tabs on the left, the page count and the fit buttons on the right (they wrap on a narrow window). */
  .stagebar { position: sticky; top: -16px; z-index: 3; align-self: stretch; margin-top: -16px; padding: 16px 16px 10px; background: #2a2d33; display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; }
  .variantbar { display: flex; gap: 4px; flex-wrap: wrap; }
  .variantbar button { border: 0; background: #3a3e45; color: #e6e8eb; border-radius: 999px; padding: 6px 10px; font: 600 12px/1 inherit; cursor: pointer; white-space: nowrap; }
  .variantbar button:hover { background: #4a4f57; }
  .variantbar button.on { background: var(--ink); color: var(--bg); }
  .looknote { margin: 0; line-height: 1.4; }
  .looknote b { color: var(--ink); }
  .count { font-size: 12.5px; color: #9aa1aa; }
  .zoomtools { display: flex; align-items: center; gap: 4px; }
  .zoomtools button { border: 0; background: #3a3e45; color: #e6e8eb; border-radius: 8px; height: 28px; min-width: 28px; padding: 0 10px; font: 600 12.5px/1 inherit; cursor: pointer; }
  .zoomtools button:hover { background: #4a4f57; }
  .zoomtools button.on { background: var(--accent); color: var(--on-accent); }

  .saver { border: 0; padding: 0; border-radius: 22px; background: var(--surface); color: var(--text); width: min(520px, calc(100vw - 32px)); }
  .saver::backdrop { background: rgb(5 6 8 / 0.7); }
  .saver form { display: flex; flex-direction: column; gap: 14px; padding: 24px; }
  .saver h2 { margin: 0; color: var(--ink); font-size: 20px; }
  .saver p { margin: 0; }
  .saver label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--muted); }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
  .saver label.lockrow { flex-direction: row; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--text); }
  .lockrow b { color: var(--ink); }
</style>
