// The small page the editor's sign-in window shows. It hands the result to the editor window that
// opened it (the protocol Sveltia CMS and Decap CMS use for "Sign in with GitHub"), and then it can close.

export type PopupResult = { ok: true; token: string } | { ok: false; message: string };

export function popupReply(result: PopupResult, status: number): Response {
  const message = result.ok
    ? `authorization:github:success:${JSON.stringify({ token: result.token, provider: "github" })}`
    : `authorization:github:error:${JSON.stringify({ message: result.message })}`;
  // "<" is escaped so the text can never close the script tag.
  const safe = JSON.stringify(message).replace(/</g, "\\u003c");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px">${result.ok ? "Signed in. This window will close." : `<p>${escapeHtml(result.message)}</p>`}
<script>
(function () {
  var message = ${safe};
  function receive(e) {
    // Only answer the editor that is served from this same site.
    if (e.origin !== window.location.origin) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
})();
</script></body></html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
