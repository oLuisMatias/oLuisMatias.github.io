// The project editor's API (/admin/api/*). Callers are already known to be the owner: the Worker checks the
// Cloudflare Access ticket first, and the local dev server skips it. This file only handles the requests
// and decides which files may be touched: project files, the page-text files listed in PAGE_FILES and uploaded
// images/models, nothing else.
import { StoreConflict, StoreFailure, type Store } from "./store";

const PROJECTS_DIR = "src/content/projects";
/** The page-text files of the page editors, by the name used in the address (/admin/api/home, /admin/api/projects-page). */
const PAGE_FILES: Record<string, { file: string; message: string }> = {
  home: { file: "src/data/home.yml", message: "Edit home page (home page editor)" },
  "projects-page": { file: "src/data/projects-page.yml", message: "Edit projects page (project page editor)" },
  "cv-page": { file: "src/data/cv-page.yml", message: "Edit CV page layout (CV page editor)" },
  skills: { file: "src/data/skills.yml", message: "Edit skills and languages (CV page editor)" },
};
const IMAGES_DIR = "public/images/projects";
const MODELS_DIR = "public/data/models";
/** The CV page's cards: one file each, in these folders. Their logos are uploaded to the pictures folder of the section. */
const CV_DIRS: Record<string, { dir: string; images: string; publicImages: string }> = {
  work: { dir: "src/content/work", images: "public/images/cv/work", publicImages: "/images/cv/work" },
  education: { dir: "src/content/education", images: "public/images/cv/studies", publicImages: "/images/cv/studies" },
  experiences: { dir: "src/content/experiences", images: "public/images/cv/experiences", publicImages: "/images/cv/experiences" },
  certifications: { dir: "src/content/certifications", images: "public/images/cv/certifications", publicImages: "/images/cv/certifications" },
};
/** Certificates and verification files of the certifications: PDFs and pictures. */
const DOCUMENTS = { dir: "public/data/documents", publicDir: "/data/documents" };
const DOCUMENT_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.(pdf|png|jpe?g|webp)$/;
const CV_FILE = /^[a-z0-9][a-z0-9-]{0,70}\.yml$/;

const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.(png|jpe?g|webp|gif|glb)$/;
const MAX_TEXT = 300_000;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_MODEL = 24 * 1024 * 1024; // Cloudflare assets stop at 25 MiB per file

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const problem = (status: number, message: string) => json({ error: message }, status);

const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const encode = (s: string) => new TextEncoder().encode(s);

export async function handleApi(request: Request, store: Store): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  // Requests that change something must come from the editor page itself. The login cookie travels with
  // any request a browser makes, so a page on another site must not be able to trigger these.
  if (method !== "GET" && method !== "HEAD") {
    if (request.headers.get("Origin") !== url.origin || request.headers.get("X-Editor") !== "1") {
      return problem(403, "This request did not come from the editor.");
    }
  }

  try {
    if (path === "/admin/api/projects" && method === "GET") {
      const entries = (await store.list(PROJECTS_DIR)).filter((e) => /^[a-z0-9-]+\.yml$/.test(e.name));
      const projects = await Promise.all(
        entries.map(async (e) => {
          const file = await store.read(`${PROJECTS_DIR}/${e.name}`);
          return file ? { slug: e.name.replace(/\.yml$/, ""), sha: file.sha, text: decode(file.bytes) } : null;
        }),
      );
      return json({ projects: projects.filter(Boolean) });
    }

    const project = path.match(/^\/admin\/api\/projects\/([^/]+)$/);
    if (project) {
      const slug = project[1];
      if (!SLUG.test(slug)) return problem(400, "That project name isn't valid (use lowercase letters, numbers and dashes).");
      const file = `${PROJECTS_DIR}/${slug}.yml`;

      if (method === "PUT") {
        const body = (await request.json().catch(() => null)) as { text?: unknown; sha?: unknown } | null;
        if (!body || typeof body.text !== "string" || !body.text.trim()) return problem(400, "Nothing to save.");
        if (body.text.length > MAX_TEXT) return problem(413, "That project is too large.");
        if (body.sha !== undefined && typeof body.sha !== "string") return problem(400, "Bad version tag.");
        const out = await store.write(file, encode(body.text), body.sha, `Edit project ${slug} (project editor)`);
        return json(out);
      }

      if (method === "DELETE") {
        const body = (await request.json().catch(() => null)) as { sha?: unknown } | null;
        if (!body || typeof body.sha !== "string" || !body.sha) return problem(400, "Missing version tag.");
        await store.remove(file, body.sha, `Delete project ${slug} (project editor)`);
        return json({ ok: true });
      }
    }

    if (path === "/admin/api/cv" && method === "GET") {
      const read = async (section: string) => {
        const { dir } = CV_DIRS[section];
        const entries = (await store.list(dir)).filter((e) => CV_FILE.test(e.name));
        const files = await Promise.all(
          entries.map(async (e) => {
            const file = await store.read(`${dir}/${e.name}`);
            return file ? { name: e.name, sha: file.sha, text: decode(file.bytes) } : null;
          }),
        );
        return files.filter(Boolean);
      };
      const [work, education, experiences, certifications] = await Promise.all(["work", "education", "experiences", "certifications"].map(read));
      return json({ work, education, experiences, certifications });
    }

    const card = path.match(/^\/admin\/api\/cv\/(work|education|experiences|certifications)\/([^/]+)$/);
    if (card) {
      const { dir } = CV_DIRS[card[1]];
      const name = card[2];
      if (!CV_FILE.test(name)) return problem(400, "That card name isn't valid (use lowercase letters, numbers and dashes).");
      const file = `${dir}/${name}`;

      if (method === "PUT") {
        const body = (await request.json().catch(() => null)) as { text?: unknown; sha?: unknown } | null;
        if (!body || typeof body.text !== "string" || !body.text.trim()) return problem(400, "Nothing to save.");
        if (body.text.length > MAX_TEXT) return problem(413, "That card is too large.");
        if (body.sha !== undefined && body.sha !== null && typeof body.sha !== "string") return problem(400, "Bad version tag.");
        const out = await store.write(file, encode(body.text), body.sha ?? undefined, `Edit CV card ${card[1]}/${name} (CV page editor)`);
        return json(out);
      }

      if (method === "DELETE") {
        const body = (await request.json().catch(() => null)) as { sha?: unknown } | null;
        if (!body || typeof body.sha !== "string" || !body.sha) return problem(400, "Missing version tag.");
        await store.remove(file, body.sha, `Delete CV card ${card[1]}/${name} (CV page editor)`);
        return json({ ok: true });
      }
    }

    const pageFile = path.match(/^\/admin\/api\/([a-z-]+)$/);
    const target = pageFile ? PAGE_FILES[pageFile[1]] : undefined;
    if (target && (method === "GET" || method === "PUT")) {
      if (method === "GET") {
        const file = await store.read(target.file);
        return json({ sha: file?.sha ?? null, text: file ? decode(file.bytes) : "" });
      }
      const body = (await request.json().catch(() => null)) as { text?: unknown; sha?: unknown } | null;
      if (!body || typeof body.text !== "string" || !body.text.trim()) return problem(400, "Nothing to save.");
      if (body.text.length > MAX_TEXT) return problem(413, "That is too large.");
      if (body.sha !== undefined && body.sha !== null && typeof body.sha !== "string") return problem(400, "Bad version tag.");
      const out = await store.write(target.file, encode(body.text), body.sha ?? undefined, target.message);
      return json(out);
    }

    // `?area=work` or `?area=education`: the logos of that CV section instead of the project files.
    const areaName = url.searchParams.get("area") ?? "";
    const documents = areaName === "documents";
    const area = CV_DIRS[areaName];

    if (path === "/admin/api/files" && method === "GET") {
      if (documents) {
        const files = await store.list(DOCUMENTS.dir);
        return json({ images: files.map((e) => e.name).filter((n) => DOCUMENT_NAME.test(n)).sort().map((n) => `${DOCUMENTS.publicDir}/${n}`), models: [] });
      }
      if (area) {
        const images = await store.list(area.images);
        return json({ images: images.map((e) => e.name).filter((n) => /\.(png|jpe?g|webp|gif)$/i.test(n)).sort().map((n) => `${area.publicImages}/${n}`), models: [] });
      }
      const [images, models] = await Promise.all([store.list(IMAGES_DIR), store.list(MODELS_DIR)]);
      const names = (list: { name: string }[], re: RegExp) => list.map((e) => e.name).filter((n) => re.test(n)).sort();
      return json({
        images: names(images, /\.(png|jpe?g|webp|gif)$/i).map((n) => `/images/projects/${n}`),
        models: names(models, /\.glb$/i).map((n) => `/data/models/${n}`),
      });
    }

    if (path === "/admin/api/upload" && method === "POST") {
      const name = (url.searchParams.get("name") ?? "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
      if (documents) {
        if (!DOCUMENT_NAME.test(name)) return problem(400, "Use a .pdf, .png, .jpg or .webp file.");
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.length === 0) return problem(400, "The file is empty.");
        if (bytes.length > MAX_IMAGE) return problem(413, "Files can be up to 10 MB.");
        await store.write(`${DOCUMENTS.dir}/${name}`, bytes, undefined, `Add ${name} (CV page editor)`);
        return json({ path: `${DOCUMENTS.publicDir}/${name}` });
      }
      if (!FILE_NAME.test(name)) return problem(400, "Use a .png, .jpg, .webp, .gif or .glb file.");
      const isModel = name.endsWith(".glb");
      if (area && isModel) return problem(400, "Use a .png, .jpg, .webp or .gif picture.");
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length === 0) return problem(400, "The file is empty.");
      if (bytes.length > (isModel ? MAX_MODEL : MAX_IMAGE)) {
        return problem(413, isModel ? "3D models can be up to 24 MB." : "Images can be up to 10 MB.");
      }
      if (area) {
        await store.write(`${area.images}/${name}`, bytes, undefined, `Add ${name} (CV page editor)`);
        return json({ path: `${area.publicImages}/${name}` });
      }
      const dir = isModel ? MODELS_DIR : IMAGES_DIR;
      await store.write(`${dir}/${name}`, bytes, undefined, `Add ${name} (project editor)`);
      return json({ path: isModel ? `/data/models/${name}` : `/images/projects/${name}` });
    }

    return problem(404, "Unknown request.");
  } catch (e) {
    if (e instanceof StoreConflict) return problem(409, e.message);
    if (e instanceof StoreFailure) return problem(502, e.message);
    return problem(500, "Something went wrong on the server.");
  }
}
