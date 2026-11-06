import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// Development only: the project editor's API (/admin/api/*) runs here and saves to the files on this computer,
// so the editor can be tried without GitHub or a login. On Cloudflare the Worker answers these requests instead.
const editorApiInDev = {
  name: "editor-api-in-dev",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/admin/api/")) return next();
      // This API writes files without a login, so it only answers requests addressed to this computer. That also
      // stops other sites from reaching it through a changed address (DNS rebinding) or from the network.
      if (!["localhost", "127.0.0.1", "[::1]"].includes((req.headers.host ?? "").replace(/:\d+$/, ""))) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "The editor API only answers on localhost." }));
        return;
      }
      try {
        const { handleApi } = await server.ssrLoadModule("/worker/api.ts");
        const { fsStore } = await server.ssrLoadModule("/worker/fs-store.ts");
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(name, value);
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody ? Buffer.concat(chunks) : undefined,
        });
        const reply = await handleApi(request, fsStore(process.cwd()));
        res.statusCode = reply.status;
        reply.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(Buffer.from(await reply.arrayBuffer()));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  },
};

// Static site: Cloudflare serves dist/ and runs worker/ for the private API.
export default defineConfig({
  site: "https://lmatias.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [svelte()],
  vite: { plugins: [editorApiInDev] },
});
