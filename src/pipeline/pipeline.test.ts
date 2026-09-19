import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFixtureAdapter } from "./adapters/fixture-adapter";
import { createContentStore } from "./content-store";
import { createManifestStore } from "./manifest-store";
import { fetchOne, listHandoff, verifyAll } from "./pipeline";
import type { FetchAdapter, RawFetchResult, SourceDefinition } from "./types";
import { FetchAdapterError } from "./types";

let root: string;
let fixturesDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pipeline-test-"));
  fixturesDir = await mkdtemp(join(tmpdir(), "pipeline-test-fixtures-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(fixturesDir, { recursive: true, force: true });
});

function makeSource(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: "test-source",
    version: 1,
    name: "Test source",
    owner: "Test",
    url: "https://example.test/data",
    format: "text",
    mediaTypeHint: "text/plain",
    cadence: "test",
    coverage: "test",
    effectiveTimeSemantics: "live-current-status",
    rights: "public-reference-unapproved",
    rightsNote: "test",
    adapterId: "fixture",
    schemaVersion: "fixture-adapter/1.0.0",
    maxBytes: 1_000_000,
    ...overrides,
  };
}

async function writeFixtureFile(name: string, contents: string): Promise<string> {
  const path = join(fixturesDir, name);
  await writeFile(path, contents);
  return path;
}

async function blobCount(): Promise<number> {
  try {
    const shards = await readdir(join(root, "blobs"));
    let count = 0;
    for (const shard of shards) {
      const inner = await readdir(join(root, "blobs", shard));
      for (const sub of inner) {
        count += (await readdir(join(root, "blobs", shard, sub))).length;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function tmpFileCount(): Promise<number> {
  try {
    return (await readdir(join(root, "tmp"))).length;
  } catch {
    return 0;
  }
}

describe("fetchOne — happy path and repeat fetch", () => {
  it("stores a successful fetch as outcome 'success' with a matching sha256 and byte count", async () => {
    const filePath = await writeFixtureFile("ok.txt", "hello world");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });

    expect(entry.outcome).toBe("success");
    expect(entry.attempt).toBe(1);
    expect(entry.byteCount).toBe("hello world".length);
    expect(entry.sha256).toHaveLength(64);
    expect(entry.storageKey).not.toBeNull();
    expect(await blobCount()).toBe(1);
  });

  it("repeat fetch of unchanged content is recorded as 'duplicate-skip', not a second 'success'", async () => {
    const filePath = await writeFixtureFile("stable.txt", "unchanged content");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const first = await fetchOne(source, { root, adapterOverride: adapter });
    const second = await fetchOne(source, { root, adapterOverride: adapter });
    const third = await fetchOne(source, { root, adapterOverride: adapter });

    expect(first.entry.outcome).toBe("success");
    expect(second.entry.outcome).toBe("duplicate-skip");
    expect(third.entry.outcome).toBe("duplicate-skip");
    expect([first, second, third].map((r) => r.entry.attempt)).toEqual([1, 2, 3]);
    expect([first, second, third].map((r) => r.entry.sha256)).toEqual([first.entry.sha256, first.entry.sha256, first.entry.sha256]);
    // Content-addressing means repeat fetches of identical bytes never write a second blob.
    expect(await blobCount()).toBe(1);
  });

  it("a fetch after the underlying content actually changes is recorded as a new 'success', not a duplicate", async () => {
    const filePath = await writeFixtureFile("changing.txt", "version one");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const first = await fetchOne(source, { root, adapterOverride: adapter });
    await writeFile(filePath, "version two — genuinely different content");
    const second = await fetchOne(source, { root, adapterOverride: adapter });

    expect(first.entry.outcome).toBe("success");
    expect(second.entry.outcome).toBe("success");
    expect(second.entry.sha256).not.toBe(first.entry.sha256);
    expect(await blobCount()).toBe(2);
  });
});

describe("fetchOne — malformed and oversized (partial) payloads", () => {
  it("rejects a payload declared as JSON that fails to parse, and never stores any bytes for it", async () => {
    const filePath = await writeFixtureFile("bad.json", "{ this is not valid json ");
    const source = makeSource({ format: "json", mediaTypeHint: "application/json" });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "application/json" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });

    expect(entry.outcome).toBe("validation-failed");
    expect(entry.errorMessage).toMatch(/failed to parse/i);
    expect(entry.storageKey).toBeNull();
    expect(entry.sha256).toBeNull();
    expect(await blobCount()).toBe(0);
  });

  it("rejects a payload larger than the source's byte bound, and never stores any bytes for it (partial-download safety)", async () => {
    const filePath = await writeFixtureFile("oversized.txt", "x".repeat(1000));
    const source = makeSource({ maxBytes: 100 });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });

    expect(entry.outcome).toBe("validation-failed");
    expect(entry.errorMessage).toMatch(/exceeded.*bound/i);
    expect(entry.storageKey).toBeNull();
    expect(await blobCount()).toBe(0);
    expect(await tmpFileCount()).toBe(0);
  });

  it("rejects an empty payload", async () => {
    const filePath = await writeFixtureFile("empty.txt", "");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });
    expect(entry.outcome).toBe("validation-failed");
    expect(entry.errorMessage).toMatch(/empty/i);
  });

  it("rejects a media-type mismatch (e.g. an HTML error/challenge page in place of the expected payload)", async () => {
    const filePath = await writeFixtureFile("challenge.html", "<html>please enable JavaScript</html>");
    const source = makeSource({ format: "json", mediaTypeHint: "application/json" });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/html" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });
    expect(entry.outcome).toBe("validation-failed");
    expect(entry.errorMessage).toMatch(/media type/i);
  });

  it("never leaves an orphaned temp file behind after any number of failed attempts", async () => {
    const filePath = await writeFixtureFile("bad.json", "not json");
    const source = makeSource({ format: "json", mediaTypeHint: "application/json" });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "application/json" } });

    for (let i = 0; i < 5; i++) {
      await fetchOne(source, { root, adapterOverride: adapter });
    }
    expect(await tmpFileCount()).toBe(0);
    expect(await blobCount()).toBe(0);
  });
});

describe("fetchOne — retries and backoff", () => {
  function flakyAdapter(failTimes: number, finalResult: RawFetchResult): { adapter: FetchAdapter; callTimes: number[] } {
    const callTimes: number[] = [];
    let calls = 0;
    const adapter: FetchAdapter = {
      id: "flaky-test-adapter",
      schemaVersion: "test/1.0.0",
      async fetchRaw(): Promise<RawFetchResult> {
        callTimes.push(Date.now());
        calls += 1;
        if (calls <= failTimes) {
          throw new FetchAdapterError(`simulated transient failure #${calls}`, "network-error");
        }
        return finalResult;
      },
    };
    return { adapter, callTimes };
  }

  it("retries network errors with backoff and succeeds once the transient failure clears", async () => {
    const bytes = new TextEncoder().encode("recovered payload");
    const { adapter, callTimes } = flakyAdapter(2, { bytes, httpStatus: 200, responseHeaders: {}, mediaType: "text/plain" });
    const source = makeSource();

    const { entry, retryCount } = await fetchOne(source, { root, adapterOverride: adapter, maxRetries: 3, backoffMs: 20 });

    expect(entry.outcome).toBe("success");
    expect(retryCount).toBe(2);
    expect(callTimes).toHaveLength(3);
    // Exponential backoff: second gap should be roughly double the first (20ms then 40ms), not identical/instant retries.
    const firstGap = callTimes[1]! - callTimes[0]!;
    const secondGap = callTimes[2]! - callTimes[1]!;
    expect(firstGap).toBeGreaterThanOrEqual(15);
    expect(secondGap).toBeGreaterThanOrEqual(firstGap);
  });

  it("gives up after maxRetries and records a 'network-error' outcome with the retry count noted", async () => {
    const { adapter, callTimes } = flakyAdapter(10, { bytes: new Uint8Array(), httpStatus: 200, responseHeaders: {}, mediaType: "text/plain" });
    const source = makeSource();

    const { entry, retryCount } = await fetchOne(source, { root, adapterOverride: adapter, maxRetries: 2, backoffMs: 5 });

    expect(entry.outcome).toBe("network-error");
    expect(retryCount).toBe(2);
    expect(callTimes).toHaveLength(3); // initial attempt + 2 retries
    expect(entry.errorMessage).toMatch(/after 2 retries/);
  });

  it("never retries a validation failure — it is a terminal outcome on the first attempt", async () => {
    let calls = 0;
    const adapter: FetchAdapter = {
      id: "always-invalid",
      schemaVersion: "test/1.0.0",
      async fetchRaw() {
        calls += 1;
        throw new FetchAdapterError("permanently invalid", "validation-failed");
      },
    };
    const source = makeSource();

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter, maxRetries: 5, backoffMs: 5 });
    expect(entry.outcome).toBe("validation-failed");
    expect(calls).toBe(1);
  });
});

describe("fetchOne — timestamp distinctions", () => {
  it("distinguishes attemptedAt, retrievedAt, and effectiveAt as independent timestamps", async () => {
    const pastEffectiveDate = new Date("2020-01-01T00:00:00Z");
    const adapter: FetchAdapter = {
      id: "headers-test-adapter",
      schemaVersion: "test/1.0.0",
      async fetchRaw(): Promise<RawFetchResult> {
        return {
          bytes: new TextEncoder().encode("content with a claimed effective date"),
          httpStatus: 200,
          responseHeaders: { "last-modified": pastEffectiveDate.toUTCString() },
          mediaType: "text/plain",
        };
      },
    };
    const source = makeSource();

    const before = Date.now();
    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });
    const after = Date.now();

    expect(entry.effectiveAt).toBe(pastEffectiveDate.toISOString());
    expect(new Date(entry.attemptedAt).getTime()).toBeGreaterThanOrEqual(before - 5);
    expect(new Date(entry.retrievedAt!).getTime()).toBeLessThanOrEqual(after + 5);
    // The source's claimed effective time is years before when we actually retrieved it — these must never be conflated.
    expect(new Date(entry.effectiveAt!).getTime()).toBeLessThan(new Date(entry.retrievedAt!).getTime());
  });

  it("leaves effectiveAt null when the source provides no dating signal, rather than guessing", async () => {
    const filePath = await writeFixtureFile("no-date.txt", "content with no last-modified header");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });
    expect(entry.effectiveAt).toBeNull();
    expect(entry.retrievedAt).not.toBeNull();
  });
});

describe("fetchOne — concurrent safety", () => {
  it("many concurrent fetches of the same unchanged source produce one blob and N sequential, unique manifest attempts", async () => {
    const filePath = await writeFixtureFile("concurrent.txt", "shared stable content");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    const concurrency = 10;
    await Promise.all(Array.from({ length: concurrency }, () => fetchOne(source, { root, adapterOverride: adapter })));

    const manifestStore = createManifestStore(root);
    const entries = await manifestStore.readAll(source.id);
    expect(entries).toHaveLength(concurrency);
    expect(entries.map((e) => e.attempt).sort((a, b) => a - b)).toEqual(Array.from({ length: concurrency }, (_, i) => i + 1));
    expect(await blobCount()).toBe(1);
  });
});

describe("verifyAll — tamper detection", () => {
  it("flags a stored blob whose bytes no longer match its manifest-recorded hash", async () => {
    const filePath = await writeFixtureFile("verifiable.txt", "content that should stay intact");
    const source = makeSource();
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });
    const { entry } = await fetchOne(source, { root, adapterOverride: adapter });

    const cleanResults = await verifyAll(root, source.id);
    expect(cleanResults).toHaveLength(1);
    expect(cleanResults[0]!.ok).toBe(true);

    const contentStore = createContentStore(root);
    await contentStore.read(entry.storageKey!); // sanity: blob is readable before tampering
    await writeFile(join(root, entry.storageKey!), "these bytes were tampered with after storage");

    const tamperedResults = await verifyAll(root, source.id);
    expect(tamperedResults).toHaveLength(1);
    expect(tamperedResults[0]!.ok).toBe(false);
    expect(tamperedResults[0]!.error).toMatch(/hash mismatch/i);
  });

  it("returns an empty result set for a source with no successful fetches", async () => {
    const source = makeSource();
    expect(await verifyAll(root, source.id)).toEqual([]);
  });
});

describe("listHandoff — publication/normalization contract", () => {
  it("surfaces one ready-for-normalization record per source pointing at the latest successful bytes", async () => {
    const filePath = await writeFixtureFile("handoff.txt", "handoff content");
    const source = makeSource({ id: "handoff-source" });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "text/plain" } });

    await fetchOne(source, { root, adapterOverride: adapter });
    const { entry: second } = await fetchOne(source, { root, adapterOverride: adapter }); // duplicate-skip

    const records = await listHandoff(root, source.id);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourceId: source.id,
      status: "ready-for-normalization",
      sha256: second.sha256,
      storageKey: second.storageKey,
    });
  });

  it("keeps surfacing the last known good record even if the most recent attempt afterward failed", async () => {
    const filePath = await writeFixtureFile("degrading.txt", "still-good content");
    const source = makeSource({ id: "degrading-source", format: "json", mediaTypeHint: "application/json" });

    const goodAdapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "application/json" } });
    await writeFile(filePath, "{}");
    const { entry: goodEntry } = await fetchOne(source, { root, adapterOverride: goodAdapter });
    expect(goodEntry.outcome).toBe("success");

    const brokenFile = await writeFixtureFile("degrading-broken.json", "not json at all");
    const brokenAdapter = createFixtureAdapter({ [source.id]: { filePath: brokenFile, mediaType: "application/json" } });
    const { entry: brokenEntry } = await fetchOne(source, { root, adapterOverride: brokenAdapter });
    expect(brokenEntry.outcome).toBe("validation-failed");

    const records = await listHandoff(root, source.id);
    expect(records).toHaveLength(1);
    expect(records[0]!.sha256).toBe(goodEntry.sha256);
  });

  it("returns nothing for a source that has never succeeded", async () => {
    const filePath = await writeFixtureFile("always-bad.json", "still not json");
    const source = makeSource({ id: "never-good", format: "json", mediaTypeHint: "application/json" });
    const adapter = createFixtureAdapter({ [source.id]: { filePath, mediaType: "application/json" } });

    await fetchOne(source, { root, adapterOverride: adapter });
    expect(await listHandoff(root, source.id)).toEqual([]);
  });
});

describe("fetchOne — network-error simulation via fixture adapter", () => {
  it("records a network-error outcome distinctly from a validation-failed one, and does not retry validation-failed", async () => {
    const source = makeSource();
    const adapter = createFixtureAdapter({
      [source.id]: { filePath: "/unused", mediaType: "text/plain", simulateNetworkError: "connection reset" },
    });

    const { entry, retryCount } = await fetchOne(source, { root, adapterOverride: adapter, maxRetries: 2, backoffMs: 5 });
    expect(entry.outcome).toBe("network-error");
    expect(retryCount).toBe(2);
    expect(entry.errorMessage).toMatch(/connection reset/);
  });
});