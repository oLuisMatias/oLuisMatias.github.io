import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// Static site: Cloudflare Pages serves dist/ and runs functions/ for the private API.
export default defineConfig({
  site: "https://lmatias.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [svelte()],
});
