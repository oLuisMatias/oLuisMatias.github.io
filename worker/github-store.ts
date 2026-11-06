// The editor's store on GitHub: every save is a commit on the site's branch, which Cloudflare then publishes.
import { StoreConflict, StoreFailure, type Entry, type Store } from "./store";

interface GithubConfig {
  token: string;
  repo: string; // "owner/name"
  branch: string;
}

export function githubStore({ token, repo, branch }: GithubConfig): Store {
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}${init.method && init.method !== "GET" ? "" : `?ref=${branch}`}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lmatias-editor",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });

  const fail = async (res: Response, what: string): Promise<never> => {
    if (res.status === 409 || res.status === 422) throw new StoreConflict(`${what}: the file changed on GitHub in the meantime.`);
    if (res.status === 401 || res.status === 403) throw new StoreFailure(`${what}: GitHub refused the token (expired, or without write access to the repository).`);
    throw new StoreFailure(`${what}: GitHub answered ${res.status}.`);
  };

  return {
    async list(dir) {
      const res = await call(dir);
      if (res.status === 404) return [];
      if (!res.ok) return fail(res, "Listing files");
      const items = (await res.json()) as { name: string; sha: string; type: string }[];
      return items.filter((i) => i.type === "file").map((i): Entry => ({ name: i.name, sha: i.sha }));
    },

    async read(path) {
      const res = await call(path);
      if (res.status === 404) return null;
      if (!res.ok) return fail(res, "Reading a file");
      const file = (await res.json()) as { content?: string; sha: string };
      if (typeof file.content !== "string") return null;
      return { bytes: base64ToBytes(file.content), sha: file.sha };
    },

    async write(path, bytes, sha, message) {
      const res = await call(path, {
        method: "PUT",
        body: JSON.stringify({ message, content: bytesToBase64(bytes), branch, ...(sha ? { sha } : {}) }),
      });
      if (!res.ok) return fail(res, "Saving");
      const out = (await res.json()) as { content: { sha: string } };
      return { sha: out.content.sha };
    },

    async remove(path, sha, message) {
      const res = await call(path, { method: "DELETE", body: JSON.stringify({ message, sha, branch }) });
      if (!res.ok) return fail(res, "Deleting");
    },
  };
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
