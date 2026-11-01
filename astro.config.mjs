import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// The Astro dev server doesn't open a folder's index.html for files in public/ (Cloudflare Pages does).
// This makes /admin/editor/ work while testing locally.
const folderIndexInDev = {
  name: "folder-index-in-dev",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/admin/editor" || req.url === "/admin/editor/") req.url = "/admin/editor/index.html";
      next();
    });
  },
};

// Static site: Cloudflare Pages serves dist/ and runs functions/ for the private API.
export default defineConfig({
  site: "https://lmatias.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [svelte()],
  vite: { plugins: [folderIndexInDev] },
});
