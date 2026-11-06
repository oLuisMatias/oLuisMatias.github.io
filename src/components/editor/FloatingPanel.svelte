<script lang="ts">
  // The popup of the visual mode: a small panel beside the box being edited, with the same fields as the left menu.
  import type { Snippet } from "svelte";
  import Ic from "./Ic.svelte";

  let { title, left, top, onclose, children }: { title: string; left: number; top: number; onclose: () => void; children: Snippet } = $props();
</script>

<div class="panel" style:left={`${left}px`} style:top={`${top}px`} style:max-height={`calc(100dvh - ${top}px - 12px)`} role="dialog" aria-label={title}>
  <header>
    <strong>{title}</strong>
    <button type="button" onclick={onclose} aria-label="Close" title="Close"><Ic name="x" size={16} /></button>
  </header>
  <div class="body">{@render children()}</div>
</div>

<style>
  .panel { position: fixed; z-index: 40; width: 360px; display: flex; flex-direction: column; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: 0 16px 48px rgb(0 0 0 / 0.5); overflow: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 8px 16px; color: var(--ink); font-size: 14px; }
  header button { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer; }
  header button:hover { background: var(--chip); color: var(--ink); }
  .body { display: grid; gap: 14px; padding: 4px 16px 16px; overflow-y: auto; }
</style>
