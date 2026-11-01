// Step 2 of "Sign in with GitHub": GitHub sends the browser back here with a one-time code.
// We swap the code for an access token and hand it to the editor window that opened this popup.
// Route: /admin/callback (the "Authorization callback URL" of the GitHub OAuth app).

interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

type Result = { ok: true; token: string } | { ok: false; message: string };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const clearState = "oauth_state=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = /(?:^|;\s*)oauth_state=([^;]+)/.exec(request.headers.get("Cookie") ?? "")?.[1];

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return reply({ ok: false, message: "GitHub sign-in isn't set up yet." }, 503, clearState);
  }
  if (!code || !state || !savedState || state !== savedState) {
    return reply({ ok: false, message: "The sign-in could not be verified. Close this window and try again." }, 400, clearState);
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "lmatias-content-editor" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/admin/callback`,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };

  if (!data.access_token) {
    return reply({ ok: false, message: data.error_description || "GitHub did not give an access token." }, 401, clearState);
  }
  return reply({ ok: true, token: data.access_token }, 200, clearState);
};

/** A tiny page that passes the result to the editor window that opened this popup, then it can close. */
function reply(result: Result, status: number, setCookie: string): Response {
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
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie, "Cache-Control": "no-store" },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
