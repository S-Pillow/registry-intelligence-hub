import { randomUUID } from "node:crypto";
import { createContentStore, sweepStaleTempFiles } from "./content-store";
import { createManifestStore } from "./manifest-store";
import { createFixtureAdapter } from "./adapters/fixture-adapter";
import { createHttpAdapter } from "./adapters/http-adapter";
import { DEFAULT_FIXTURES } from "./fixture-registry";
import { requireSourceDefinition, SOURCE_REGISTRY } from "./registry";
import { FetchAdapterError } from "./types";
import type { FetchAdapter, ManifestEntry, PublicationHandoffRecord, SourceDefinition } from "./types";

export type PipelineMode = "fixture" | "live";

export interface PipelineOptions {
  /** Storage root for blobs + manifests. Must be outside git for a `mode: "live"` run. */
  root: string;
  mode?: PipelineMode;
  /** Max network retries for network-error outcomes (not counted for validation failures, which never retry). */
  maxRetries?: number;
  backoffMs?: number;
  /** Override the adapter used regardless of mode — tests use this to inject adapters that simulate specific failures. */
  adapterOverride?: FetchAdapter;
}

function pickAdapter(options: PipelineOptions): FetchAdapter {
  if (options.adapterOverride) return options.adapterOverride;
  return options.mode === "live" ? createHttpAdapter() : createFixtureAdapter(DEFAULT_FIXTURES);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractEffectiveAt(headers: Record<string, string> | null): string | null {
  if (!headers) return null;
  const lastModified = headers["last-modified"];
  if (!lastModified) return null;
  const parsed = new Date(lastModified);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface FetchOneResult {
  entry: ManifestEntry;
  retryCount: number;
}

/**
 * Performs exactly one logical fetch attempt for a source: runs the adapter
 * (retrying network errors with exponential backoff, never retrying
 * validation failures), stores successful bytes immutably and
 * content-addressed, classifies the result against the source's fetch
 * history, and appends exactly one append-only manifest entry recording
 * what happened. Never throws for adapter-classified failures — those are
 * recorded as manifest outcomes, not exceptions; only truly unexpected
 * errors (a bug, not a fetch failure) propagate.
 *
 * Accepts either a registered source id (resolved via the shared registry —
 * what the CLI always does) or a `SourceDefinition` object directly, which
 * is how tests exercise the pipeline against synthetic sources without
 * mutating the real global registry.
 */
export async function fetchOne(sourceOrId: string | SourceDefinition, options: PipelineOptions): Promise<FetchOneResult> {
  const source = typeof sourceOrId === "string" ? requireSourceDefinition(sourceOrId) : sourceOrId;
  const adapter = pickAdapter(options);
  const maxRetries = options.maxRetries ?? 3;
  const backoffMs = options.backoffMs ?? 50;
  const contentStore = createContentStore(options.root);
  const manifestStore = createManifestStore(options.root);

  await sweepStaleTempFiles(options.root, 60_000);

  const attemptedAt = new Date().toISOString();
  let lastError: FetchAdapterError | null = null;
  let retryCount = 0;
  let bytes: Uint8Array | null = null;
  let httpStatus: number | null = null;
  let responseHeaders: Record<string, string> | null = null;
  let mediaType: string | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await adapter.fetchRaw(source, {});
      bytes = result.bytes;
      httpStatus = result.httpStatus;
      responseHeaders = result.responseHeaders;
      mediaType = result.mediaType;
      lastError = null;
      break;
    } catch (error) {
      if (!(error instanceof FetchAdapterError)) throw error;
      lastError = error;
      httpStatus = null;
      if (error.kind !== "network-error" || i === maxRetries) break;
      retryCount++;
      await delay(backoffMs * 2 ** i);
    }
  }

  const baseEntry = {
    manifestEntryVersion: "1.0.0" as const,
    sourceId: source.id,
    sourceVersion: source.version,
    format: source.format,
    adapterId: adapter.id,
    adapterSchemaVersion: adapter.schemaVersion,
    attemptId: randomUUID(),
    url: source.url,
    attemptedAt,
  };

  if (!bytes) {
    const entry = await manifestStore.appendNextAttempt(source.id, (attempt) => ({
      ...baseEntry,
      attempt,
      retrievedAt: null,
      effectiveAt: null,
      httpStatus,
      responseHeaders,
      mediaType,
      byteCount: null,
      sha256: null,
      storageKey: null,
      outcome: lastError!.kind,
      errorMessage: retryCount > 0 ? `${lastError!.message} (after ${retryCount} retr${retryCount === 1 ? "y" : "ies"})` : lastError!.message,
    }));
    return { entry, retryCount };
  }

  const { storageKey, sha256 } = await contentStore.put(bytes);
  const priorEntries = await manifestStore.readAll(source.id);
  const lastSuccessful = [...priorEntries].reverse().find((entry) => entry.outcome === "success" || entry.outcome === "duplicate-skip");
  const outcome = lastSuccessful?.sha256 === sha256 ? "duplicate-skip" : "success";
  const retrievedAt = new Date().toISOString();

  const entry = await manifestStore.appendNextAttempt(source.id, (attempt) => ({
    ...baseEntry,
    attempt,
    retrievedAt,
    effectiveAt: extractEffectiveAt(responseHeaders),
    httpStatus,
    responseHeaders,
    mediaType,
    byteCount: bytes!.byteLength,
    sha256,
    storageKey,
    outcome,
    errorMessage: null,
  }));
  return { entry, retryCount };
}

export async function fetchAll(options: PipelineOptions): Promise<FetchOneResult[]> {
  const results: FetchOneResult[] = [];
  for (const source of SOURCE_REGISTRY) {
    results.push(await fetchOne(source.id, options));
  }
  return results;
}

export async function listSnapshots(root: string, sourceId?: string): Promise<Record<string, ManifestEntry[]>> {
  const manifestStore = createManifestStore(root);
  if (sourceId) {
    return { [sourceId]: await manifestStore.readAll(sourceId) };
  }
  return manifestStore.readAllSources();
}

export async function inspect(root: string, sourceId: string, attemptIdOrHash: string): Promise<ManifestEntry | null> {
  const manifestStore = createManifestStore(root);
  const entries = await manifestStore.readAll(sourceId);
  return entries.find((entry) => entry.attemptId === attemptIdOrHash || entry.sha256 === attemptIdOrHash) ?? null;
}

export interface VerifyResult {
  sourceId: string;
  attemptId: string;
  sha256: string;
  ok: boolean;
  error?: string;
}

/** Recomputes hashes for every successfully-stored blob and flags mismatches (tampering) or missing files. */
export async function verifyAll(root: string, sourceId?: string): Promise<VerifyResult[]> {
  const contentStore = createContentStore(root);
  const manifestStore = createManifestStore(root);
  const bySource = sourceId ? { [sourceId]: await manifestStore.readAll(sourceId) } : await manifestStore.readAllSources();

  const results: VerifyResult[] = [];
  for (const [id, entries] of Object.entries(bySource)) {
    for (const entry of entries) {
      if (entry.outcome !== "success" && entry.outcome !== "duplicate-skip") continue;
      if (!entry.storageKey || !entry.sha256) continue;
      const verification = await contentStore.verify(entry.storageKey, entry.sha256);
      results.push({
        sourceId: id,
        attemptId: entry.attemptId,
        sha256: entry.sha256,
        ok: verification.ok,
        error: verification.error ?? (verification.ok ? undefined : `hash mismatch: manifest says ${entry.sha256}, blob is actually ${verification.actualSha256}`),
      });
    }
  }
  return results;
}

/**
 * The stable publication/normalization handoff: the *only* thing a future
 * normalizer should read from this pipeline. Returns one record per source
 * for its most recent successful (or duplicate-skip, i.e. "still current")
 * fetch — never a failed attempt, since there's nothing to normalize from
 * one of those.
 */
export async function listHandoff(root: string, sourceId?: string): Promise<PublicationHandoffRecord[]> {
  const manifestStore = createManifestStore(root);
  const bySource = sourceId ? { [sourceId]: await manifestStore.readAll(sourceId) } : await manifestStore.readAllSources();

  const records: PublicationHandoffRecord[] = [];
  for (const [id, entries] of Object.entries(bySource)) {
    const latest = [...entries].reverse().find((entry) => entry.outcome === "success" || entry.outcome === "duplicate-skip");
    if (!latest || !latest.storageKey || !latest.sha256 || !latest.retrievedAt || latest.byteCount === null) continue;
    records.push({
      sourceId: id,
      sourceVersion: latest.sourceVersion,
      adapterId: latest.adapterId,
      adapterSchemaVersion: latest.adapterSchemaVersion,
      format: latest.format,
      storageKey: latest.storageKey,
      sha256: latest.sha256,
      byteCount: latest.byteCount,
      mediaType: latest.mediaType,
      retrievedAt: latest.retrievedAt,
      effectiveAt: latest.effectiveAt,
      status: "ready-for-normalization",
    });
  }
  return records;
}

export { createContentStore, sha256Hex, sweepStaleTempFiles } from "./content-store";
export { createManifestStore } from "./manifest-store";
