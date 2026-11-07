<script lang="ts">
  // Shows a PDF's pages with pdf.js, at a given zoom. A new PDF is drawn off screen and swapped in when it is ready, so the
  // pages don't flicker and the scroll position stays where it was while you edit.
  import * as pdfjs from "pdfjs-dist";
  import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let { pdf, zoom = 1, onpages }: { pdf: Blob | null; zoom?: number; onpages?: (count: number) => void } = $props();

  let host: HTMLDivElement | undefined = $state();
  let drawing = 0; // the newest request wins: an older one that finishes late is thrown away

  async function draw(blob: Blob, scale: number) {
    const ticket = ++drawing;
    const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const done = () => void task.destroy().catch(() => {}); // frees the PDF in pdf.js once its pages are drawn (or thrown away)
    const doc = await task.promise;
    const ratio = window.devicePixelRatio || 1;
    const pages: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const view = page.getViewport({ scale: scale * (96 / 72) }); // pdf points to screen pixels
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(view.width * ratio);
      canvas.height = Math.floor(view.height * ratio);
      canvas.style.width = `${Math.floor(view.width)}px`;
      canvas.style.height = `${Math.floor(view.height)}px`;
      canvas.className = "pdfpage";
      await page.render({ canvas, viewport: page.getViewport({ scale: scale * (96 / 72) * ratio }) }).promise;
      if (ticket !== drawing) return done();
      pages.push(canvas);
    }
    if (ticket !== drawing || !host) return done();
    host.replaceChildren(...pages);
    onpages?.(doc.numPages);
    done();
  }

  $effect(() => {
    if (pdf && host) draw(pdf, zoom).catch((e) => console.error("Couldn't draw the PDF", e));
  });
</script>

<div class="pdfpages" bind:this={host}></div>

<style>
  .pdfpages { display: flex; flex-direction: column; align-items: center; gap: 24px; }
  .pdfpages :global(.pdfpage) { display: block; background: #fff; box-shadow: 0 8px 30px rgb(0 0 0 / 0.35); flex: none; }
</style>
