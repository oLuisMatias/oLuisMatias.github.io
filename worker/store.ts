// Where the editor reads and writes the site's files: GitHub in production, the local disk in development.
export interface Entry {
  name: string;
  sha: string;
}

export interface Store {
  /** Files (not folders) directly inside a folder. A missing folder is an empty list. */
  list(dir: string): Promise<Entry[]>;
  /** The file's bytes and its version tag, or null when it doesn't exist. */
  read(path: string): Promise<{ bytes: Uint8Array; sha: string } | null>;
  /** Create or replace a file. `sha` is the version being replaced; a mismatch throws StoreConflict. */
  write(path: string, bytes: Uint8Array, sha: string | undefined, message: string): Promise<{ sha: string }>;
  remove(path: string, sha: string, message: string): Promise<void>;
}

export class StoreConflict extends Error {}
export class StoreFailure extends Error {}
