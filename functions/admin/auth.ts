// Step 1 of "Sign in with GitHub" for the content editor (Sveltia CMS).
// The editor opens this address in a popup; we send the browser on to GitHub's sign-in page.
// Route: /admin/auth. It sits under /admin, so Cloudflare Access protects it like the editor itself.

interface Env {
  GITHUB_CLIENT_ID?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response("GitHub sign-in isn't set up yet (GITHUB_CLIENT_ID is missing).", { status: 503 });
  }

  const origin = new URL(request.url).origin;
  // Random value that proves, in the callback, that this sign-in was started from this browser.
  const state = crypto.randomUUID();

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/admin/callback`);
  authorize.searchParams.set("scope", "repo,read:user");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": `oauth_state=${state}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
};
