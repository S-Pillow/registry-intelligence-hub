import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createManifestStore } from "./manifest-store";
import type { ManifestEntry } from "./types";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "manifest-store-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function makeEntry(sourceId: string, attempt: number, overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    manifestEntryVersion: "1.0.0",
    sourceId,
    sourceVersion: 1,
    format: "text",
    adapterId: "fixture",
    adapterSchemaVersion: "fixture-adapter/1.0.0",
    attempt,
    attemptId: `attempt-${attempt}`,
    url: "https://example.test/source",
    attemptedAt: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    effectiveAt: null,
    httpStatus: 200,
    responseHeaders: null,
    mediaType: "text/plain",
    byteCount: 10,
    sha256: "deadbeef".repeat(8),
    storageKey: "blobs/de/ad/deadbeef.bin",
    outcome: "success",
    errorMessage: null,
    ...overrides,
  };
}

describe("createManifestStore", () => {
  it("append() is append-only: entries accumulate in write order and are never rewritten", async () => {
    const store = createManifestStore(root);
    await store.append(makeEntry("source-a", 1));
    await store.append(makeEntry("source-a", 2));
    await store.append(makeEntry("source-a", 3));

    const entries = await store.readAll("source-a");
    expect(entries.map((e) => e.attempt)).toEqual([1, 2, 3]);

    const raw = await readFile(join(root, "manifests", "source-a.jsonl"), "utf8");
    expect(raw.trim().split("\n")).toHaveLength(3);
  });

  it("readAll() returns an empty array for a source with no manifest yet, rather than throwing", async () => {
    const store = createManifestStore(root);
    expect(await store.readAll("never-fetched")).toEqual([]);
  });

  it("readAllSources() groups entries by source across multiple manifest files", async () => {
    const store = createManifestStore(root);
    await store.append(makeEntry("source-a", 1));
    await store.append(makeEntry("source-b", 1));

    const bySource = await store.readAllSources();
    expect(Object.keys(bySource).sort()).toEqual(["source-a", "source-b"]);
    expect(bySource["source-a"]).toHaveLength(1);
    expect(bySource["source-b"]).toHaveLength(1);
  });

  it("appendNextAttempt() assigns monotonically increasing attempt numbers", async () => {
    const store = createManifestStore(root);
    const first = await store.appendNextAttempt("source-a", (attempt) => makeEntry("source-a", attempt));
    const second = await store.appendNextAttempt("source-a", (attempt) => makeEntry("source-a", attempt));
    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
  });

  it("appendNextAttempt() stays correct under concurrent writers — no two attempts collide or get lost", async () => {
    const store = createManifestStore(root);
    const concurrentWrites = 20;

    await Promise.all(
      Array.from({ length: concurrentWrites }, () => store.appendNextAttempt("shared-source", (attempt) => makeEntry("shared-source", attempt))),
    );

    const entries = await store.readAll("shared-source");
    expect(entries).toHaveLength(concurrentWrites);
    const attemptNumbers = entries.map((e) => e.attempt).sort((a, b) => a - b);
    expect(attemptNumbers).toEqual(Array.from({ length: concurrentWrites }, (_, i) => i + 1));
    // Every entry's own `attempt` field must match its recorded attemptId (built inside the same lock).
    for (const entry of entries) {
      expect(entry.attemptId).toBe(`attempt-${entry.attempt}`);
    }
  });

  it("concurrent writers to different sources do not interfere with each other's attempt numbering", async () => {
    const store = createManifestStore(root);
    await Promise.all([
      ...Array.from({ length: 5 }, () => store.appendNextAttempt("source-a", (attempt) => makeEntry("source-a", attempt))),
      ...Array.from({ length: 5 }, () => store.appendNextAttempt("source-b", (attempt) => makeEntry("source-b", attempt))),
    ]);

    const a = await store.readAll("source-a");
    const b = await store.readAll("source-b");
    expect(a.map((e) => e.attempt).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(b.map((e) => e.attempt).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });
});
