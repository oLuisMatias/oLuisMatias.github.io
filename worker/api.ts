// The project editor's API (/admin/api/*). Callers are already known to be the owner: the Worker checks the
// Cloudflare Access ticket first, and the local dev server skips it. This file only handles the requests
// and decides which files may be touched: project files, the page-text files listed in PAGE_FILES and uploaded
// images/models, nothing else.
import { StoreConflict, StoreFailure, type Change, type Store } from "./store";

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

/** Own keys only: a user-supplied name like "__proto__" or "constructor" must not find anything. */
const own = <T>(table: Record<string, T>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);

/** The text of a save request, checked; or the reply to send when it is not acceptable. */
async function readText(request: Request, tooLarge: string): Promise<{ text: string; sha: string | undefined } | Response> {
  const body = (await request.json().catch(() => null)) as { text?: unknown; sha?: unknown } | null;
  if (!body || typeof body.text !== "string" || !body.text.trim()) return problem(400, "Nothing to save.");
  if (body.text.length > MAX_TEXT) return problem(413, tooLarge);
  if (body.sha !== undefined && body.sha !== null && typeof body.sha !== "string") return problem(400, "Bad version tag.");
  return { text: body.text, sha: body.sha ?? undefined };
}

async function saveText(request: Request, store: Store, file: string, tooLarge: string, message: string): Promise<Response> {
  const read = await readText(request, tooLarge);
  if (read instanceof Response) return read;
  return json(await store.write(file, encode(read.text), read.sha, message));
}

async function deleteFile(request: Request, store: Store, file: string, message: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { sha?: unknown } | null;
  if (!body || typeof body.sha !== "string" || !body.sha) return problem(400, "Missing version tag.");
  await store.remove(file, body.sha, message);
  return json({ ok: true });
}

/** The version tag of a file that is already there (so an upload with the same name replaces it), or undefined. */
async function existingSha(store: Store, dir: string, name: string): Promise<string | undefined> {
  return (await store.list(dir)).find((e) => e.name === name)?.sha;
}

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

      if (method === "PUT") return await saveText(request, store, file, "That project is too large.", `Edit project ${slug} (project editor)`);
      if (method === "DELETE") return await deleteFile(request, store, file, `Delete project ${slug} (project editor)`);
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

    if (path === "/admin/api/cv/save" && method === "POST") return await saveCards(request, store);

    const card = path.match(/^\/admin\/api\/cv\/(work|education|experiences|certifications)\/([^/]+)$/);
    if (card) {
      const { dir } = CV_DIRS[card[1]];
      const name = card[2];
      if (!CV_FILE.test(name)) return problem(400, "That card name isn't valid (use lowercase letters, numbers and dashes).");
      const file = `${dir}/${name}`;

      if (method === "PUT") return await saveText(request, store, file, "That card is too large.", `Edit CV card ${card[1]}/${name} (CV page editor)`);
      if (method === "DELETE") return await deleteFile(request, store, file, `Delete CV card ${card[1]}/${name} (CV page editor)`);
    }

    const pageFile = path.match(/^\/admin\/api\/([a-z-]+)$/);
    const target = pageFile ? own(PAGE_FILES, pageFile[1]) : undefined;
    if (target && (method === "GET" || method === "PUT")) {
      if (method === "GET") {
        const file = await store.read(target.file);
        return json({ sha: file?.sha ?? null, text: file ? decode(file.bytes) : "" });
      }
      return await saveText(request, store, target.file, "That is too large.", target.message);
    }

    // `?area=work` or `?area=education`: the logos of that CV section instead of the project files.
    const areaName = url.searchParams.get("area") ?? "";
    const documents = areaName === "documents";
    const area = own(CV_DIRS, areaName);
    if (areaName && !documents && !area) return problem(400, "Unknown picture folder.");

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
        await store.write(`${DOCUMENTS.dir}/${name}`, bytes, await existingSha(store, DOCUMENTS.dir, name), `Add ${name} (CV page editor)`);
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
        await store.write(`${area.images}/${name}`, bytes, await existingSha(store, area.images, name), `Add ${name} (CV page editor)`);
        return json({ path: `${area.publicImages}/${name}` });
      }
      const dir = isModel ? MODELS_DIR : IMAGES_DIR;
      await store.write(`${dir}/${name}`, bytes, await existingSha(store, dir, name), `Add ${name} (project editor)`);
      return json({ path: isModel ? `/data/models/${name}` : `/images/projects/${name}` });
    }

    return problem(404, "Unknown request.");
  } catch (e) {
    if (e instanceof StoreConflict) return problem(409, e.message);
    if (e instanceof StoreFailure) return problem(502, e.message);
    return problem(500, "Something went wrong on the server.");
  }
}

/** The whole CV page's cards in ONE commit (one deploy): `files` are written, `deletes` removed. Each carries the version it was loaded at. */
async function saveCards(request: Request, store: Store): Promise<Response> {
  type Item = { section?: unknown; name?: unknown; text?: unknown; sha?: unknown };
  const body = (await request.json().catch(() => null)) as { files?: Item[]; deletes?: Item[] } | null;
  const files = body?.files ?? [];
  const deletes = body?.deletes ?? [];
  if (!Array.isArray(files) || !Array.isArray(deletes) || files.length + deletes.length === 0) return problem(400, "Nothing to save.");
  if (files.length + deletes.length > 200) return problem(413, "Too many cards in one save.");

  const changes: Change[] = [];
  const expected = new Map<string, string | null>(); // path -> the version the editor started from
  const keys = new Map<string, string>(); // path -> "section/file", the name the editor uses
  for (const [list, isWrite] of [[files, true], [deletes, false]] as const) {
    for (const item of list) {
      const cv = typeof item?.section === "string" ? own(CV_DIRS, item.section) : undefined;
      if (!cv || typeof item.name !== "string" || !CV_FILE.test(item.name)) return problem(400, "That card name isn't valid (use lowercase letters, numbers and dashes).");
      const path = `${cv.dir}/${item.name}`;
      if (expected.has(path)) return problem(400, "The same card was sent twice.");
      if (item.sha !== undefined && item.sha !== null && typeof item.sha !== "string") return problem(400, "Bad version tag.");
      if (!isWrite && !item.sha) return problem(400, "Missing version tag.");
      expected.set(path, (item.sha as string | null | undefined) ?? null);
      keys.set(path, `${item.section}/${item.name}`);
      if (isWrite) {
        if (typeof item.text !== "string" || !item.text.trim()) return problem(400, "Nothing to save.");
        if (item.text.length > MAX_TEXT) return problem(413, "That card is too large.");
        changes.push({ path, bytes: encode(item.text) });
      } else {
        changes.push({ path, bytes: null });
      }
    }
  }

  // A commit has no per-file check, so compare the versions here: an editor tab that is out of date must not overwrite newer cards.
  const current = new Map<string, string>();
  for (const dir of new Set(Object.values(CV_DIRS).map((d) => d.dir))) {
    for (const e of await store.list(dir)) current.set(`${dir}/${e.name}`, e.sha);
  }
  for (const [path, sha] of expected) {
    if ((current.get(path) ?? null) !== sha) throw new StoreConflict("Saving: a card changed in the meantime. Reload the page.");
  }

  const written = await store.commit(changes, "Edit CV cards (CV page editor)");
  return json({ shas: Object.fromEntries(Object.entries(written).map(([path, sha]) => [keys.get(path), sha])) });
}
