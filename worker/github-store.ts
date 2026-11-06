// The editor's store on GitHub: every save is a commit on the site's branch, which Cloudflare then publishes.
import { base64ToBytes, bytesToBase64 } from "./base64";
import { StoreConflict, StoreFailure, type Entry, type Store } from "./store";

interface GithubConfig {
  token: string;
  repo: string; // "owner/name"
  branch: string;
}

export function githubStore({ token, repo, branch }: GithubConfig): Store {
  const refPath = branch.split("/").map(encodeURIComponent).join("/");
  const github = (path: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${repo}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lmatias-editor",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  const send = (path: string, method: string, body: unknown) => github(path, { method, body: JSON.stringify(body) });
  const call = (path: string, init: RequestInit = {}) => {
    const file = `contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    return github(init.method && init.method !== "GET" ? file : `${file}?ref=${encodeURIComponent(branch)}`, init);
  };

  const fail = async (res: Response, what: string): Promise<never> => {
    if (res.status === 409 || res.status === 422) throw new StoreConflict(`${what}: the file changed on GitHub in the meantime.`);
    if (res.status === 401 || res.status === 403) throw new StoreFailure(`${what}: GitHub refused the token (expired, or without write access to the repository).`);
    throw new StoreFailure(`${what}: GitHub answered ${res.status}.`);
  };

  // GitHub also answers 404 when the repository or branch is wrong or the token can't see it. That must not look
  // like an empty folder, so a 404 is only believed once the branch itself is known to exist.
  const checkBranch = async () => {
    const res = await github(`git/ref/heads/${refPath}`);
    if (res.status === 404) throw new StoreFailure("GitHub can't find the repository or branch. Check GITHUB_REPO, GITHUB_BRANCH and the token's access.");
    if (!res.ok) await fail(res, "Checking the repository");
  };

  return {
    async list(dir) {
      const res = await call(dir);
      if (res.status === 404) {
        await checkBranch();
        return [];
      }
      if (!res.ok) return fail(res, "Listing files");
      const items = (await res.json()) as { name: string; sha: string; type: string }[];
      return items.filter((i) => i.type === "file").map((i): Entry => ({ name: i.name, sha: i.sha }));
    },

    async read(path) {
      const res = await call(path);
      if (res.status === 404) {
        await checkBranch();
        return null;
      }
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

    // Several files as one commit (Git Data API): one deploy instead of one per file, and all or nothing.
    async commit(changes, message) {
      const ref = await github(`git/ref/heads/${refPath}`);
      if (!ref.ok) return fail(ref, "Saving");
      const head = ((await ref.json()) as { object: { sha: string } }).object.sha;
      const parent = await github(`git/commits/${head}`);
      if (!parent.ok) return fail(parent, "Saving");
      const baseTree = ((await parent.json()) as { tree: { sha: string } }).tree.sha;

      const shas: Record<string, string> = {};
      const entries = await Promise.all(
        changes.map(async ({ path, bytes }) => {
          if (!bytes) return { path, mode: "100644", type: "blob", sha: null };
          const blob = await send("git/blobs", "POST", { content: bytesToBase64(bytes), encoding: "base64" });
          if (!blob.ok) return fail(blob, "Saving");
          shas[path] = ((await blob.json()) as { sha: string }).sha;
          return { path, mode: "100644", type: "blob", sha: shas[path] };
        }),
      );
      const tree = await send("git/trees", "POST", { base_tree: baseTree, tree: entries });
      if (!tree.ok) return fail(tree, "Saving");
      const created = await send("git/commits", "POST", { message, tree: ((await tree.json()) as { sha: string }).sha, parents: [head] });
      if (!created.ok) return fail(created, "Saving");
      // Not forced: if the branch moved in the meantime this is refused instead of overwriting the other commit.
      const moved = await send(`git/refs/heads/${refPath}`, "PATCH", { sha: ((await created.json()) as { sha: string }).sha });
      if (!moved.ok) return fail(moved, "Saving");
      return shas;
    },
  };
}
