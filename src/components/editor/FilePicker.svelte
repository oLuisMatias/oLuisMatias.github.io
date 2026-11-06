<script lang="ts">
  // A window to choose an image or 3D model from the site's files, or to upload a new one.
  interface Props {
    kind: "image" | "model" | "document";
    files: string[];
    /** Files uploaded in this session and not yet published, with a temporary address to show them. */
    local: Record<string, string>;
    onpick: (path: string) => void;
    onclose: () => void;
    onupload: (file: File) => Promise<string>;
  }
  let { kind, files, local, onpick, onclose, onupload }: Props = $props();

  let busy = $state(false);
  let error = $state("");

  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    error = "";
    try {
      onpick(await onupload(file));
    } catch (err) {
      error = err instanceof Error ? err.message : "The upload failed.";
    } finally {
      busy = false;
      input.value = "";
    }
  }

  const title = $derived(kind === "image" ? "Choose a picture" : kind === "document" ? "Choose a file" : "Choose a 3D model");
  const name = (path: string) => path.split("/").pop() ?? path;
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<div class="backdrop" role="presentation" onclick={onclose}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <header>
      <h2>{title}</h2>
      <label class="btn btn--small btn--primary upload">
        {busy ? "Uploading…" : "Upload new"}
        <input type="file" accept={kind === "image" ? "image/png,image/jpeg,image/webp,image/gif" : kind === "document" ? ".pdf,image/png,image/jpeg,image/webp" : ".glb"} onchange={upload} disabled={busy} hidden />
      </label>
      <button class="btn btn--small" type="button" onclick={onclose}>Close</button>
    </header>
    {#if error}<p class="error">{error}</p>{/if}
    {#if files.length === 0}
      <p class="empty">Nothing here yet. Use “Upload new”.</p>
    {:else if kind === "image"}
      <ul class="grid">
        {#each files as path (path)}
          <li><button type="button" onclick={() => onpick(path)} title={name(path)}>
            <img src={local[path] ?? path} alt="" loading="lazy" />
            <span>{name(path)}</span>
          </button></li>
        {/each}
      </ul>
    {:else}
      <ul class="list">
        {#each files as path (path)}
          <li><button type="button" onclick={() => onpick(path)}>{name(path)}</button></li>
        {/each}
      </ul>
    {/if}
    <p class="note">{kind === "image" ? "Pictures up to 10 MB. Large photos are scaled down automatically." : kind === "document" ? "PDF files and pictures up to 10 MB." : "3D models (.glb) up to 24 MB."} New files appear on the live site about a minute after you save.</p>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(5 6 8 / 0.7); display: grid; place-items: center; padding: 20px; }
  .dialog { width: min(760px, 100%); max-height: min(80vh, 720px); overflow: auto; background: var(--surface); border-radius: var(--radius); padding: 20px; display: grid; gap: 14px; align-content: start; }
  header { display: flex; align-items: center; gap: 10px; }
  h2 { flex: 1; font-size: 18px; }
  .upload { cursor: pointer; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .grid button { width: 100%; display: grid; gap: 6px; padding: 8px; border: 0; border-radius: var(--radius-sm); background: var(--chip); color: var(--text); cursor: pointer; font: inherit; font-size: 12px; text-align: left; }
  .grid button:hover { outline: 2px solid var(--accent); }
  .grid img { width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: var(--placeholder); border-radius: 8px; }
  .grid span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .list button { width: 100%; padding: 10px 14px; border: 0; border-radius: var(--radius-sm); background: var(--chip); color: var(--ink); cursor: pointer; font: inherit; text-align: left; }
  .list button:hover { outline: 2px solid var(--accent); }
  .error { color: var(--err); font-size: 14px; }
  .empty, .note { color: var(--muted); font-size: 13px; }
</style>
