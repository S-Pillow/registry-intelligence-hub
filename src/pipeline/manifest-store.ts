import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestEntry } from "./types";

/**
 * A simple, dependency-free mutual-exclusion lock implemented with an
 * atomically-created directory (`mkdir` fails if the directory already
 * exists, which POSIX guarantees is atomic even across processes on the
 * same filesystem). Used to serialize concurrent manifest appends across
 * processes without adding a file-locking dependency.
 */
async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const staleAfterMs = 10_000;
  const retryDelayMs = 15;
  const deadline = Date.now() + 20_000;

  for (;;) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > staleAfterMs) {
          await rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for manifest lock at ${lockPath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

export interface ManifestStore {
  root: string;
  /** Appends one entry as a single JSON line. Never rewrites or removes existing lines. */
  append(entry: ManifestEntry): Promise<void>;
  /**
   * Atomically reserves the next attempt number for `sourceId` and appends
   * the entry `build(attempt)` produces, all under one lock acquisition —
   * so two concurrent pipeline runs against the same source can never be
   * handed the same attempt number (see manifest-store.test.ts's concurrent
   * writers case).
   */
  appendNextAttempt(sourceId: string, build: (attempt: number) => ManifestEntry): Promise<ManifestEntry>;
  /** Reads every entry for a source, in append order (oldest first). */
  readAll(sourceId: string): Promise<ManifestEntry[]>;
  /** Reads every entry across every source that has a manifest file. */
  readAllSources(): Promise<Record<string, ManifestEntry[]>>;
  /** The next 1-based attempt number for a source, based on how many entries already exist. */
  nextAttemptNumber(sourceId: string): Promise<number>;
}

function manifestPath(root: string, sourceId: string): string {
  return join(root, "manifests", `${sourceId}.jsonl`);
}

export function createManifestStore(root: string): ManifestStore {
  return {
    root,
    async append(entry: ManifestEntry) {
      const path = manifestPath(root, entry.sourceId);
      await mkdir(join(root, "manifests"), { recursive: true });
      const lockPath = join(root, "manifests", ".lock");
      await withLock(lockPath, async () => {
        const handle = await open(path, "a");
        try {
          await handle.writeFile(`${JSON.stringify(entry)}\n`);
          await handle.sync();
        } finally {
          await handle.close();
        }
      });
    },
    async appendNextAttempt(sourceId: string, build: (attempt: number) => ManifestEntry) {
      const path = manifestPath(root, sourceId);
      await mkdir(join(root, "manifests"), { recursive: true });
      const lockPath = join(root, "manifests", ".lock");
      return withLock(lockPath, async () => {
        let existingCount = 0;
        try {
          const text = await readFile(path, "utf8");
          existingCount = text.split("\n").filter((line) => line.trim().length > 0).length;
        } catch {
          existingCount = 0;
        }
        const entry = build(existingCount + 1);
        const handle = await open(path, "a");
        try {
          await handle.writeFile(`${JSON.stringify(entry)}\n`);
          await handle.sync();
        } finally {
          await handle.close();
        }
        return entry;
      });
    },
    async readAll(sourceId: string) {
      const path = manifestPath(root, sourceId);
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch {
        return [];
      }
      return text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as ManifestEntry);
    },
    async readAllSources() {
      const { readdir } = await import("node:fs/promises");
      let files: string[];
      try {
        files = await readdir(join(root, "manifests"));
      } catch {
        return {};
      }
      const result: Record<string, ManifestEntry[]> = {};
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const sourceId = file.slice(0, -".jsonl".length);
        result[sourceId] = await this.readAll(sourceId);
      }
      return result;
    },
    async nextAttemptNumber(sourceId: string) {
      const entries = await this.readAll(sourceId);
      return entries.length + 1;
    },
  };
}
