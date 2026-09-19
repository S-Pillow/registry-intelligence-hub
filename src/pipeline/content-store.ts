import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readdir, rename, rm, stat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Content-addressed key for a blob, sharded two levels deep (git-style) so
 * a storage root never ends up with tens of thousands of files in one
 * directory. Purely a function of the hash — never of source id, time, or
 * any other mutable metadata — which is what makes storage immutable and
 * naturally deduplicating: identical bytes from different sources or
 * different attempts land on the exact same key.
 */
export function blobKeyForHash(sha256: string): string {
  return join("blobs", sha256.slice(0, 2), sha256.slice(2, 4), `${sha256}.bin`);
}

export interface ContentStore {
  root: string;
  /** True if a blob for this hash is already stored (used for dedup / idempotency checks). */
  has(sha256: string): Promise<boolean>;
  /**
   * Atomically write `bytes` under its content-addressed key if not already
   * present. Writes to a per-call temp file first and renames into place,
   * so a reader never observes a partial blob at the final path, and a
   * crash mid-write leaves only an orphaned temp file, never a corrupt
   * "real" one. Returns the relative storage key and whether this call
   * actually wrote new bytes (false = the blob already existed).
   */
  put(bytes: Uint8Array): Promise<{ storageKey: string; sha256: string; wroteNewBlob: boolean }>;
  read(storageKey: string): Promise<Uint8Array>;
  /** Recomputes the hash of the bytes stored at `storageKey` — used by `verify` to detect tampering. */
  verify(storageKey: string, expectedSha256: string): Promise<{ ok: boolean; actualSha256: string | null; error?: string }>;
}

export function createContentStore(root: string): ContentStore {
  const blobsDir = join(root, "blobs");
  const tmpDir = join(root, "tmp");

  async function ensureDirs() {
    await mkdir(blobsDir, { recursive: true });
    await mkdir(tmpDir, { recursive: true });
  }

  return {
    root,
    async has(sha256: string) {
      try {
        await stat(join(root, blobKeyForHash(sha256)));
        return true;
      } catch {
        return false;
      }
    },
    async put(bytes: Uint8Array) {
      await ensureDirs();
      const sha256 = sha256Hex(bytes);
      const storageKey = blobKeyForHash(sha256);
      const finalPath = join(root, storageKey);

      try {
        await stat(finalPath);
        return { storageKey, sha256, wroteNewBlob: false };
      } catch {
        // Not present yet — fall through to write it.
      }

      const tmpPath = join(tmpDir, `${randomUUID()}.part`);
      const handle = await open(tmpPath, "wx");
      try {
        try {
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
      } catch (error) {
        // Never leave a half-written temp file behind on a failed write.
        await rm(tmpPath, { force: true });
        throw error;
      }

      await mkdir(dirname(finalPath), { recursive: true });
      try {
        await rename(tmpPath, finalPath);
      } catch (error) {
        // Another concurrent writer won the race for the same content hash —
        // that's fine, the bytes are identical by construction (same hash).
        // Clean up our now-redundant temp file either way.
        await rm(tmpPath, { force: true });
        try {
          await stat(finalPath);
          return { storageKey, sha256, wroteNewBlob: false };
        } catch {
          throw error;
        }
      }

      return { storageKey, sha256, wroteNewBlob: true };
    },
    async read(storageKey: string) {
      return readFile(join(root, storageKey));
    },
    async verify(storageKey: string, expectedSha256: string) {
      let bytes: Uint8Array;
      try {
        bytes = await readFile(join(root, storageKey));
      } catch (error) {
        return { ok: false, actualSha256: null, error: `blob missing or unreadable: ${(error as Error).message}` };
      }
      const actualSha256 = sha256Hex(bytes);
      return { ok: actualSha256 === expectedSha256, actualSha256 };
    },
  };
}

/**
 * Defensive cleanup for orphaned `tmp/*.part` files — the happy path in
 * `put()` always removes its own temp file on failure, but a hard process
 * kill between the write and the rename can still leave one behind. `verify`
 * and the CLI's `sweep` command call this so partial downloads never
 * accumulate silently. Returns the list of files removed.
 */
export async function sweepStaleTempFiles(root: string, maxAgeMs = 0): Promise<string[]> {
  const tmpDir = join(root, "tmp");
  let entries: string[];
  try {
    entries = await readdir(tmpDir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.endsWith(".part")) continue;
    const path = join(tmpDir, entry);
    try {
      const info = await stat(path);
      if (now - info.mtimeMs >= maxAgeMs) {
        await rm(path, { force: true });
        removed.push(entry);
      }
    } catch {
      // Already gone — nothing to do.
    }
  }
  return removed;
}
