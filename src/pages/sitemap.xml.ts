// The list of public pages for search engines. Hidden projects are left out, like on the site itself.
import type { APIRoute } from "astro";
import { visible } from "../lib/site";

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://lmatias.com")).origin;
  const projects = await visible("projects");
  const paths = ["/", "/cv", "/projects", "/prints", "/contact", ...projects.map((p) => `/projects/${p.id}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${base}${p === "/" ? "/" : p}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
