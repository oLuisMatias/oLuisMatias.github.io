<script lang="ts">
  // A window to choose the tools of a card: click a tool to add it, click it again to take it out. A tool that isn't in
  // the list can be typed in; it shows as a plain label.
  import type { Tool } from "../../lib/site-types";

  interface Props {
    tools: Tool[];
    chosen: string[];
    ontoggle: (id: string) => void;
    onclose: () => void;
  }
  let { tools, chosen, ontoggle, onclose }: Props = $props();

  let custom = $state("");
  const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Tools already on the card that aren't in the list (typed in earlier) stay visible so they can be taken out.
  const extra = $derived(chosen.filter((id) => !tools.some((t) => t.id === id)));

  function addCustom() {
    const id = slug(custom);
    if (id && !chosen.includes(id)) ontoggle(id);
    custom = "";
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<div class="backdrop" role="presentation" onclick={onclose}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Choose tools" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <header>
      <h2>Tools</h2>
      <button class="btn btn--small btn--primary" type="button" onclick={onclose}>Done</button>
    </header>
    <ul class="grid">
      {#each tools as t (t.id)}
        <li><button type="button" class:on={chosen.includes(t.id)} aria-pressed={chosen.includes(t.id)} onclick={() => ontoggle(t.id)}>
          {#if t.icon}<img src={t.icon} alt="" width="22" height="22" />{:else}<span class="noimg"></span>{/if}
          <span>{t.name}</span>
        </button></li>
      {/each}
      {#each extra as id (id)}
        <li><button type="button" class="on" aria-pressed="true" onclick={() => ontoggle(id)}><span class="noimg"></span><span>{id}</span></button></li>
      {/each}
    </ul>
    <form class="custom" onsubmit={(e) => { e.preventDefault(); addCustom(); }}>
      <input type="text" bind:value={custom} placeholder="A tool that is not in the list…" />
      <button class="btn btn--small" type="submit" disabled={!slug(custom)}>Add</button>
    </form>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(5 6 8 / 0.7); display: grid; place-items: center; padding: 20px; }
  .dialog { width: min(640px, 100%); max-height: min(80vh, 720px); overflow: auto; background: var(--surface); border-radius: var(--radius); padding: 20px; display: grid; gap: 14px; align-content: start; }
  header { display: flex; align-items: center; gap: 10px; }
  h2 { flex: 1; font-size: 18px; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  .grid button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 0; border-radius: 12px; background: var(--chip); color: var(--text); cursor: pointer; font: inherit; font-size: 14px; text-align: left; }
  .grid button:hover { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); }
  .grid button.on { outline: 2px solid var(--accent); color: var(--ink); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .grid img, .noimg { width: 22px; height: 22px; flex: none; border-radius: 6px; object-fit: contain; }
  .noimg { background: var(--placeholder); }
  .custom { display: flex; gap: 8px; }
  .custom input { flex: 1; padding: 8px 12px; border: 0; border-radius: 999px; background: var(--chip); color: var(--ink); font: inherit; font-size: 14px; }
</style>
