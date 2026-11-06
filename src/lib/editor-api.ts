// The project editor's calls to the Worker (/admin/api/*). Every change carries the header the Worker checks for.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "X-Editor": "1", ...init.headers } });
  } catch {
    throw new ApiError("Couldn't reach the server. If you were away for a while, reload the page to sign in again.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `The server answered ${res.status}.`, res.status);
  return body as T;
}

export interface ProjectFile {
  slug: string;
  sha: string;
  text: string;
}

export const listProjects = () => call<{ projects: ProjectFile[] }>("/admin/api/projects").then((r) => r.projects);

export const saveProject = (slug: string, text: string, sha?: string) =>
  call<{ sha: string }>(`/admin/api/projects/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sha }),
  });

export const deleteProject = (slug: string, sha: string) =>
  call<{ ok: true }>(`/admin/api/projects/${slug}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha }),
  });

/** The text files of the page editors: "home", "projects-page" and "skills". */
export const loadPage = (name: "home" | "projects-page" | "skills" | "cv-page") => call<{ sha: string | null; text: string }>(`/admin/api/${name}`);

export const savePage = (name: "home" | "projects-page" | "skills" | "cv-page", text: string, sha: string | null) =>
  call<{ sha: string }>(`/admin/api/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sha }),
  });

export const loadHome = () => loadPage("home");
export const saveHome = (text: string, sha: string | null) => savePage("home", text, sha);

/** `area` (a CV section, or "documents" for certificate files) lists and uploads the files of the CV page instead of the project files. */
export const listFiles = (area?: string) => call<{ images: string[]; models: string[] }>(`/admin/api/files${area ? `?area=${area}` : ""}`);

export const uploadFile = (name: string, data: Blob, area?: string) =>
  call<{ path: string }>(`/admin/api/upload?name=${encodeURIComponent(name)}${area ? `&area=${area}` : ""}`, { method: "POST", body: data });

export interface CardFile {
  name: string;
  sha: string;
  text: string;
}

/** The files of the CV page's cards, by section. */
export const listCards = () => call<Record<"work" | "education" | "experiences" | "certifications", CardFile[]>>("/admin/api/cv");

export const saveCard = (section: string, name: string, text: string, sha: string | null) =>
  call<{ sha: string }>(`/admin/api/cv/${section}/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sha }),
  });

export const deleteCard = (section: string, name: string, sha: string) =>
  call<{ ok: true }>(`/admin/api/cv/${section}/${name}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha }),
  });

/** Phone photos are huge. Photos (jpeg/webp) wider than 2200 px are scaled down before uploading; other files are sent as they are. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|webp)$/.test(file.type) || file.size < 600_000) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap || bitmap.width <= 2200) return file;
  const scale = 2200 / bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = 2200;
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, file.type, 0.86));
  return blob && blob.size < file.size ? blob : file;
}
