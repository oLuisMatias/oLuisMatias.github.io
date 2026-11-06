// The Worker of lmatias.com. Every page, image and file of the site is served straight from the built
// site (static assets, free and unlimited). Only the addresses listed in wrangler.toml under
// `run_worker_first` reach this code; everything else never wakes it up.
import type { Env } from "./env";
import { verifyAccess } from "./access";
import { handleApi } from "./api";
import { githubStore } from "./github-store";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/admin/api/")) {
      const who = await verifyAccess(request, env);
      if (!who.ok) return Response.json({ error: who.message }, { status: who.status, headers: { "Cache-Control": "no-store" } });
      if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
        return Response.json({ error: "The GITHUB_TOKEN secret or GITHUB_REPO setting is missing." }, { status: 503 });
      }
      return handleApi(request, githubStore({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || "main" }));
    }

    // Anything else is a file of the site.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
