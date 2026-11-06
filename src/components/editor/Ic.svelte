<script lang="ts">
  import { iconSvg } from "../../lib/icons";
  let { name, size = 17 }: { name: string; size?: number } = $props();
</script>

<span class="ic">{@html iconSvg(name, size)}</span>

<style>
  .ic { display: inline-flex; flex: none; }
  .ic :global(svg) { display: block; }
</style>
