<script lang="ts">
  // A text box with a small toolbar (bold, italic, list, link). Used for text blocks and for the intro text.
  let { value = $bindable(), rows = 9, hint = "" }: { value: string; rows?: number; hint?: string } = $props();

  let textarea = $state<HTMLTextAreaElement>();

  function wrap(before: string, after = before, placeholder = "text") {
    if (!textarea) return;
    const { selectionStart: a, selectionEnd: b, value: text } = textarea;
    const chosen = text.slice(a, b) || placeholder;
    value = text.slice(0, a) + before + chosen + after + text.slice(b);
    queueMicrotask(() => {
      textarea?.focus();
      textarea?.setSelectionRange(a + before.length, a + before.length + chosen.length);
    });
  }

  function bullets() {
    if (!textarea) return;
    const { selectionStart: a, selectionEnd: b, value: text } = textarea;
    const start = text.lastIndexOf("\n", a - 1) + 1;
    const lines = text.slice(start, b).split("\n").map((l) => (l.startsWith("- ") ? l.slice(2) : `- ${l}`));
    value = text.slice(0, start) + lines.join("\n") + text.slice(b);
  }

  function link() {
    const url = prompt("Link address (https://…)");
    if (url) wrap("[", `](${url})`, "link text");
  }
</script>

{#if hint}<p class="hint">{hint}</p>{/if}
<div class="toolbar">
  <button type="button" onclick={() => wrap("**")} title="Bold"><b>B</b></button>
  <button type="button" onclick={() => wrap("*")} title="Italic"><i>I</i></button>
  <button type="button" onclick={bullets} title="Bulleted list">• List</button>
  <button type="button" onclick={link} title="Link">Link</button>
</div>
<textarea bind:this={textarea} bind:value {rows} placeholder="Write here. Leave an empty line between paragraphs."></textarea>

<style>
  textarea { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); color: var(--ink); font: inherit; font-size: 14px; resize: vertical; line-height: 1.5; }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .hint { font-size: 13px; color: var(--muted); }
  .toolbar { display: flex; gap: 6px; margin: 6px 0; }
  .toolbar button { min-width: 34px; height: 30px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--chip); color: var(--ink); cursor: pointer; font: inherit; font-size: 13px; }
  .toolbar button:hover { background: var(--line); }
</style>
