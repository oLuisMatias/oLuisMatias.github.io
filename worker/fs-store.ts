// Development only: the same store, on the local disk, so the editor can be tried without GitHub.
// The "sha" is a hash of the content, like on GitHub, so conflicts behave the same.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StoreConflict, type Store } from "./store";

const hash = (bytes: Uint8Array) => createHash("sha1").update(bytes).digest("hex");

export function fsStore(root: string): Store {
  const abs = (p: string) => join(root, p);
  const current = async (p: string) => {
    try {
      return new Uint8Array(await readFile(abs(p)));
    } catch {
      return null;
    }
  };
  return {
    async list(dir) {
      try {
        const items = await readdir(abs(dir), { withFileTypes: true });
        const out = [];
        for (const i of items) if (i.isFile()) out.push({ name: i.name, sha: hash((await current(`${dir}/${i.name}`))!) });
        return out;
      } catch {
        return [];
      }
    },
    async read(p) {
      const bytes = await current(p);
      return bytes ? { bytes, sha: hash(bytes) } : null;
    },
    async write(p, bytes, sha) {
      const existing = await current(p);
      if (existing && sha !== hash(existing)) throw new StoreConflict("Saving: the file changed in the meantime.");
      if (!existing && sha) throw new StoreConflict("Saving: the file no longer exists.");
      await mkdir(dirname(abs(p)), { recursive: true });
      await writeFile(abs(p), bytes);
      return { sha: hash(bytes) };
    },
    async remove(p, sha) {
      const existing = await current(p);
      if (existing && sha !== hash(existing)) throw new StoreConflict("Deleting: the file changed in the meantime.");
      await rm(abs(p), { force: true });
    },
  };
}
