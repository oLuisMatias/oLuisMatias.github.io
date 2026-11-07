// The 3D viewer (the <model-viewer> element) is only downloaded on pages that have a 3D model.
// `always` is for the editor's preview, which draws its models after the page has loaded.
// The models are compressed with Draco; its decoder is served from this site (public/draco), not from Google.
export function loadModelViewer(always = false) {
  if (!always && !document.querySelector("model-viewer, [data-model-frame]")) return;
  void import("@google/model-viewer").then((m) => {
    (m.ModelViewerElement as unknown as { dracoDecoderLocation: string }).dracoDecoderLocation = "/draco/";
  });
}
