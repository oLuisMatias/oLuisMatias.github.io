// "Sign in with GitHub" in the content editor (Sveltia CMS), without a GitHub login screen.
//
// The editor opens /admin/auth in a small window. If Cloudflare Access has confirmed that you are the owner
// (an email code), the Worker hands the editor the GitHub token that is stored as a secret in Cloudflare.
// The token never lives in the repository, and nobody else is ever given it.

import type { Env } from "./env";
import { verifyAccess } from "./access";
import { popupReply } from "./popup";

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const access = await verifyAccess(request, env);
  if (!access.ok) return popupReply({ ok: false, message: access.message }, access.status);

  if (!env.GITHUB_TOKEN) {
    return popupReply({ ok: false, message: "The GitHub token isn't set up yet (GITHUB_TOKEN is missing)." }, 503);
  }
  return popupReply({ ok: true, token: env.GITHUB_TOKEN }, 200);
}
