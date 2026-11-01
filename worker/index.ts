// The Worker of lmatias.com. Every page, image and file of the site is served straight from the built
// site (static assets, free and unlimited). Only the addresses listed in wrangler.toml under
// `run_worker_first` reach this code; everything else never wakes it up.
import type { Env } from "./env";
import { handleAuth } from "./admin-auth";
import { handleCallback } from "./admin-callback";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" || request.method === "HEAD") {
      if (pathname === "/admin/auth") return handleAuth(request, env);
      if (pathname === "/admin/callback") return handleCallback(request, env);
    }

    // Anything else is a file of the site.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
