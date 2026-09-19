import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blobKeyForHash, createContentStore, sha256Hex, sweepStaleTempFiles } from "./content-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "content-store-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("createContentStore", () => {
  it("writes bytes under a content-addressed key derived only from their hash", async () => {
    const store = createContentStore(root);
    const bytes = new TextEncoder().encode("hello registry intelligence hub");
    const { storageKey, sha256, wroteNewBlob } = await store.put(bytes);

    expect(sha256).toBe(sha256Hex(bytes));
    expect(storageKey).toBe(blobKeyForHash(sha256));
    expect(wroteNewBlob).toBe(true);

    const readBack = await store.read(storageKey);
    expect(Buffer.from(readBack).toString()).toBe("hello registry intelligence hub");
  });

  it("dedupes identical bytes: a second put() of the same content does not rewrite the blob", async () => {
    const store = createContentStore(root);
    const bytes = new TextEncoder().encode("identical payload");

    const first = await store.put(bytes);
    expect(first.wroteNewBlob).toBe(true);

    const second = await store.put(bytes);
    expect(second.wroteNewBlob).toBe(false);
    expect(second.storageKey).toBe(first.storageKey);
    expect(second.sha256).toBe(first.sha256);
  });

  it("never leaves a partial blob visible at the final path even under concurrent writers of the same content", async () => {
    const store = createContentStore(root);
    const bytes = new TextEncoder().encode("concurrent payload".repeat(1000));

    const results = await Promise.all(Array.from({ length: 8 }, () => store.put(bytes)));
    const keys = new Set(results.map((r) => r.storageKey));
    expect(keys.size).toBe(1);

    const readBack = await store.read(results[0]!.storageKey);
    expect(sha256Hex(readBack)).toBe(results[0]!.sha256);
    expect(readBack.byteLength).toBe(bytes.byteLength);
  });

  it("detects tampering: verify() fails if stored bytes no longer match the recorded hash", async () => {
    const store = createContentStore(root);
    const bytes = new TextEncoder().encode("original, untampered content");
    const { storageKey, sha256 } = await store.put(bytes);

    const okBefore = await store.verify(storageKey, sha256);
    expect(okBefore.ok).toBe(true);

    await writeFile(join(root, storageKey), "tampered content, different bytes entirely");
    const afterTamper = await store.verify(storageKey, sha256);
    expect(afterTamper.ok).toBe(false);
    expect(afterTamper.actualSha256).not.toBe(sha256);
  });

  it("verify() reports a clear error (not a throw) when the blob file is missing entirely", async () => {
    const store = createContentStore(root);
    const result = await store.verify(blobKeyForHash("0".repeat(64)), "0".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing|unreadable/);
  });

  it("has() reflects whether a hash is already stored", async () => {
    const store = createContentStore(root);
    const bytes = new TextEncoder().encode("check has()");
    const sha256 = sha256Hex(bytes);

    expect(await store.has(sha256)).toBe(false);
    await store.put(bytes);
    expect(await store.has(sha256)).toBe(true);
  });
});

describe("sweepStaleTempFiles", () => {
  it("removes orphaned .part files left behind by an interrupted write, without touching real blobs", async () => {
    const store = createContentStore(root);
    await store.put(new TextEncoder().encode("a real, complete blob"));

    const tmpDir = join(root, "tmp");
    await writeFile(join(tmpDir, "orphaned-from-a-crash.part"), "half-written bytes");

    const removed = await sweepStaleTempFiles(root, 0);
    expect(removed).toContain("orphaned-from-a-crash.part");

    const remaining = await readFile(join(tmpDir, "orphaned-from-a-crash.part")).catch(() => null);
    expect(remaining).toBeNull();
  });

  it("respects maxAgeMs so an in-flight write's temp file is not swept out from under it", async () => {
    const store = createContentStore(root);
    await store.put(new TextEncoder().encode("ensure tmp dir exists"));
    const tmpDir = join(root, "tmp");
    await writeFile(join(tmpDir, "freshly-written.part"), "still being written");

    const removed = await sweepStaleTempFiles(root, 60_000);
    expect(removed).not.toContain("freshly-written.part");
  });

  it("is a no-op when the storage root has no tmp directory yet", async () => {
    const removed = await sweepStaleTempFiles(join(root, "never-initialized"), 0);
    expect(removed).toEqual([]);
  });
});
