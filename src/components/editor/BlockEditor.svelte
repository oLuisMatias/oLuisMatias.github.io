<script lang="ts">
  // The fields of one content block, shown when the block is opened in the editor.
  import type { Block, Side } from "../../lib/project-model";
  import TextEditor from "./TextEditor.svelte";

  interface Props {
    block: Block;
    pick: (kind: "image" | "model") => Promise<string | null>;
    local: Record<string, string>;
  }
  let { block = $bindable(), pick, local }: Props = $props();

  const sides: Side[] = ["top", "right", "bottom", "left"];

  async function choose(set: (path: string) => void, kind: "image" | "model") {
    const path = await pick(kind);
    if (path) set(path);
  }

  function toggleSide(list: Side[], side: Side) {
    const i = list.indexOf(side);
    if (i >= 0) list.splice(i, 1);
    else list.push(side);
  }

  // The table: every row has the same number of columns.
  function addRow() {
    if (block.type !== "table") return;
    block.rows.push(Array(Math.max(1, block.rows[0]?.length ?? 1)).fill(""));
  }
  function addColumn() {
    if (block.type !== "table") return;
    if (block.rows.length === 0) block.rows.push([""]);
    else for (const row of block.rows) row.push("");
  }
  function removeRow(i: number) {
    if (block.type === "table") block.rows.splice(i, 1);
  }
  function removeColumn(j: number) {
    if (block.type !== "table") return;
    for (const row of block.rows) row.splice(j, 1);
    if (block.rows[0]?.length === 0) block.rows = [];
  }

  function moveImage(i: number, to: number) {
    if (block.type !== "gallery" || to < 0 || to >= block.images.length) return;
    const [item] = block.images.splice(i, 1);
    block.images.splice(to, 0, item);
  }
</script>

{#if block.type === "text"}
  <TextEditor bind:value={block.text} />
{:else if block.type === "image"}
  <div class="thumb-row">
    {#if block.src}<img class="thumb" src={local[block.src] ?? block.src} alt="" />{/if}
    <button class="btn btn--small" type="button" onclick={() => choose((p) => block.type === "image" && (block.src = p), "image")}>{block.src ? "Change picture" : "Choose picture"}</button>
  </div>
  <label>Caption <input type="text" bind:value={block.caption} placeholder="Optional" /></label>
  <label>Description for screen readers <input type="text" bind:value={block.alt} placeholder="Optional" /></label>
  <fieldset>
    <legend>Space around the picture</legend>
    <div class="seg">
      {#each sides as s (s)}
        <button type="button" class:on={block.spacing.includes(s)} onclick={() => block.type === "image" && toggleSide(block.spacing, s)}>{s}</button>
      {/each}
    </div>
  </fieldset>
{:else if block.type === "gallery"}
  <ul class="gallery">
    {#each block.images as image, i (i)}
      <li>
        <img class="thumb" src={local[image.src] ?? image.src} alt="" />
        <input type="text" bind:value={image.caption} placeholder="Caption (optional)" />
        <span class="mini">
          <button type="button" onclick={() => moveImage(i, i - 1)} disabled={i === 0} aria-label="Move earlier">↑</button>
          <button type="button" onclick={() => moveImage(i, i + 1)} disabled={block.type === "gallery" && i === block.images.length - 1} aria-label="Move later">↓</button>
          <button type="button" onclick={() => block.type === "gallery" && block.images.splice(i, 1)} aria-label="Remove">✕</button>
        </span>
      </li>
    {/each}
  </ul>
  <button class="btn btn--small" type="button" onclick={() => choose((p) => block.type === "gallery" && block.images.push({ src: p, caption: "" }), "image")}>Add a picture</button>
{:else if block.type === "model"}
  <div class="thumb-row">
    {#if block.src}<code>{block.src.split("/").pop()}</code>{/if}
    <button class="btn btn--small" type="button" onclick={() => choose((p) => block.type === "model" && (block.src = p), "model")}>{block.src ? "Change model" : "Choose model"}</button>
  </div>
  <label>Caption <input type="text" bind:value={block.caption} placeholder="Optional" /></label>
{:else if block.type === "youtube"}
  <label>YouTube link <input type="url" bind:value={block.url} placeholder="https://www.youtube.com/watch?v=…" /></label>
{:else if block.type === "heading"}
  <label>Heading <input type="text" bind:value={block.text} placeholder="A short title" /></label>
{:else if block.type === "button"}
  <label>Button text <input type="text" bind:value={block.label} placeholder="Open on GitHub" /></label>
  <label>Web address <input type="url" bind:value={block.url} placeholder="https://…" /></label>
{:else if block.type === "table"}
  <label class="check"><input type="checkbox" bind:checked={block.header} /> The first row is a header</label>
  <div class="tablescroll">
    <table class="tgrid">
      <tbody>
        {#each block.rows as row, i (i)}
          <tr>
            {#each row as _, j (j)}
              <td><input type="text" bind:value={block.rows[i][j]} aria-label={`Row ${i + 1}, column ${j + 1}`} /></td>
            {/each}
            <td class="tool"><button type="button" onclick={() => removeRow(i)} aria-label={`Delete row ${i + 1}`} title="Delete this row">✕</button></td>
          </tr>
        {/each}
        {#if block.rows.length > 0}
          <tr class="tools">
            {#each block.rows[0] as _, j (j)}
              <td class="tool"><button type="button" onclick={() => removeColumn(j)} aria-label={`Delete column ${j + 1}`} title="Delete this column">✕</button></td>
            {/each}
            <td></td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
  <div class="seg">
    <button type="button" onclick={addRow}>+ Row</button>
    <button type="button" onclick={addColumn}>+ Column</button>
  </div>
{/if}

<style>
  label, fieldset { display: grid; gap: 6px; font-size: 13px; color: var(--muted); border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 6px; font-size: 13px; color: var(--muted); }
  input[type="text"], input[type="url"] { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); color: var(--ink); font: inherit; font-size: 14px; }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .mini button { min-width: 34px; height: 30px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--chip); color: var(--ink); cursor: pointer; font: inherit; font-size: 13px; }
  .mini button:hover:not(:disabled) { background: var(--line); }
  .mini button:disabled { opacity: 0.35; cursor: default; }
  .thumb-row { display: flex; align-items: center; gap: 12px; }
  .thumb { width: 72px; height: 54px; object-fit: contain; border-radius: 8px; background: var(--placeholder); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { padding: 6px 12px; border: 0; border-radius: 999px; background: var(--chip); color: var(--text); cursor: pointer; font: inherit; font-size: 13px; text-transform: capitalize; }
  .seg button.on { background: var(--accent); color: var(--on-accent); }
  .gallery { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .gallery li { display: flex; align-items: center; gap: 8px; }
  .gallery li input { flex: 1; min-width: 0; }
  .mini { display: flex; gap: 4px; }
  .check { display: flex; align-items: center; gap: 10px; color: var(--text); font-size: 14px; grid-template-columns: none; }
  .check input { width: 17px; height: 17px; accent-color: var(--accent); }
  .tablescroll { overflow-x: auto; }
  .tgrid { border-collapse: separate; border-spacing: 4px; }
  .tgrid input { min-width: 96px; padding: 7px 9px; font-size: 13px; }
  .tgrid .tool { width: 1%; text-align: center; }
  .tgrid .tool button { width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .tgrid .tool button:hover { background: var(--chip); color: var(--ink); }
  code { font-family: var(--font-mono); font-size: 13px; color: var(--ink); }
</style>
