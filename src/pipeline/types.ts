/**
 * Shared typed contract for the source registry + immutable snapshot pipeline.
 *
 * See /docs/source-inventory.md (Project Agent Store) for the human-readable
 * research behind every `SourceDefinition` registered in `registry.ts`, and
 * README.md's "Source pipeline" section for how to run this locally.
 */

export type SourceFormat = "html" | "json" | "csv" | "pdf" | "text";

/**
 * How a source's content relates to time. This is distinct from the
 * pipeline's own `retrievedAt` (when *we* fetched it) — see ManifestEntry.
 */
export type EffectiveTimeSemantics =
  | "point-in-time-publication" // published once, frozen forever (e.g. a dated PDF)
  | "live-current-status" // mutates continuously; source does not preserve history
  | "periodic-snapshot"; // republished on a cadence, each publication is its own point-in-time artifact

export type RightsStatus =
  | "public-reference-unapproved" // publicly viewable, no bulk/automation approval on file
  | "approved"; // explicit data-steward/legal approval on file (none yet in this registry)

/**
 * A registered, fetchable data source. One entry per concretely-fetchable
 * resource (a single URL returning one document) — not every source in
 * docs/source-inventory.md has one of these; several are "documented only"
 * (methodology references, dynamic HTML tools with no adapter yet, sources
 * whose reachability from a production host is unconfirmed).
 */
export interface SourceDefinition {
  /** Stable slug. Never reuse an id for a semantically different source. */
  id: string;
  /** Bump when this registry entry's fetch semantics change materially (URL, format, bounds). */
  version: number;
  name: string;
  owner: string;
  url: string;
  format: SourceFormat;
  /** Expected Content-Type prefix, used for validation (not exact-match, since servers vary charset params). */
  mediaTypeHint: string;
  cadence: string;
  coverage: string;
  effectiveTimeSemantics: EffectiveTimeSemantics;
  rights: RightsStatus;
  rightsNote: string;
  /** Which adapter implementation (by id) knows how to fetch + validate this source. */
  adapterId: string;
  /** Adapter/schema version this registry entry was authored against — recorded on every manifest entry. */
  schemaVersion: string;
  /** Hard cap on bytes accepted for this source; exceeding it aborts the fetch as a validation failure. */
  maxBytes: number;
  notes?: string;
}

export interface FetchOptions {
  /** Overrides SourceDefinition.maxBytes for a single call (tests use this to force truncation). */
  maxBytesOverride?: number;
  signal?: AbortSignal;
}

export interface RawFetchResult {
  bytes: Uint8Array;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  mediaType: string | null;
}

/** Thrown by an adapter for both network failures (retryable) and validation failures (not retryable). */
export class FetchAdapterError extends Error {
  constructor(
    message: string,
    public readonly kind: "network-error" | "validation-failed",
    public readonly partialBytesWritten = 0,
  ) {
    super(message);
    this.name = "FetchAdapterError";
  }
}

/**
 * The adapter contract every source-fetching implementation must satisfy.
 * `fetchRaw` is responsible for the network call and structural validation
 * (status code, media type, byte bound, and — for `json` sources — parse
 * validity). It must throw FetchAdapterError rather than returning invalid
 * bytes; the pipeline treats a thrown error as the source of truth for
 * classifying a manifest entry's outcome.
 */
export interface FetchAdapter {
  id: string;
  schemaVersion: string;
  fetchRaw(source: SourceDefinition, options: FetchOptions): Promise<RawFetchResult>;
}

export type FetchOutcome =
  | "success"
  | "duplicate-skip"
  | "validation-failed"
  | "network-error";

/**
 * One line of a source's append-only manifest — one attempt, successful or
 * not. Never mutated or removed once written; corrections happen by
 * appending a new entry, never by editing history.
 */
export interface ManifestEntry {
  manifestEntryVersion: "1.0.0";
  sourceId: string;
  sourceVersion: number;
  /** Denormalized from SourceDefinition.format at fetch time, so a handoff record never depends on the source still being registered later. */
  format: SourceFormat;
  adapterId: string;
  adapterSchemaVersion: string;
  /** Monotonic per-source attempt counter, 1-based. */
  attempt: number;
  /** Opaque id for this attempt, used by `inspect`. */
  attemptId: string;
  url: string;
  /** When the pipeline began this attempt. */
  attemptedAt: string;
  /** When the pipeline finished successfully storing bytes; null if the attempt did not succeed. */
  retrievedAt: string | null;
  /**
   * The source's own claimed "as-of" time, when it publishes one (e.g. an
   * HTTP Last-Modified header, or a generated-at field embedded in the
   * payload). Deliberately kept separate from retrievedAt: a source can be
   * fetched today but describe data as-of a different, earlier moment.
   */
  effectiveAt: string | null;
  httpStatus: number | null;
  responseHeaders: Record<string, string> | null;
  mediaType: string | null;
  byteCount: number | null;
  sha256: string | null;
  /** Path to the immutable content-addressed blob, relative to the storage root; null unless outcome is success or duplicate-skip. */
  storageKey: string | null;
  outcome: FetchOutcome;
  errorMessage: string | null;
}

/**
 * The stable contract a future normalization/publication stage can rely on
 * without needing to know anything about how bytes were fetched or stored.
 * `listHandoff()` in pipeline.ts is the only supported way to read this —
 * normalizers should never read manifests or blobs directly.
 */
export interface PublicationHandoffRecord {
  sourceId: string;
  sourceVersion: number;
  adapterId: string;
  adapterSchemaVersion: string;
  format: SourceFormat;
  storageKey: string;
  sha256: string;
  byteCount: number;
  mediaType: string | null;
  retrievedAt: string;
  effectiveAt: string | null;
  status: "ready-for-normalization";
}
