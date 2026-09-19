import { readFile } from "node:fs/promises";
import type { FetchAdapter, FetchOptions, RawFetchResult, SourceDefinition } from "../types";
import { FetchAdapterError } from "../types";
import { validateStructural } from "./validate-response";

export interface FixtureEntry {
  /** Path to representative fixture bytes on disk — never real fetched production payloads. */
  filePath: string;
  mediaType: string;
  httpStatus?: number;
  /** When set, fetchRaw throws a network-error instead of reading the file — simulates a transient outage. */
  simulateNetworkError?: string;
}

/**
 * Offline adapter used by the default local pipeline (and every test): reads
 * bytes from a small hand-authored representative fixture on disk instead of
 * making a network call, then runs the exact same structural validation an
 * HTTP fetch would. This is what makes `npm run pipeline -- fetch --all`
 * safe to run in CI or a fresh clone with no network access at all.
 */
export function createFixtureAdapter(entries: Record<string, FixtureEntry>, schemaVersion = "fixture-adapter/1.0.0"): FetchAdapter {
  return {
    id: "fixture",
    schemaVersion,
    async fetchRaw(source: SourceDefinition, options: FetchOptions): Promise<RawFetchResult> {
      const entry = entries[source.id];
      if (!entry) {
        throw new FetchAdapterError(`No fixture registered for source "${source.id}"`, "validation-failed");
      }
      if (entry.simulateNetworkError) {
        throw new FetchAdapterError(entry.simulateNetworkError, "network-error");
      }

      const maxBytes = options.maxBytesOverride ?? source.maxBytes;
      const bytes = new Uint8Array(await readFile(entry.filePath));
      if (bytes.byteLength > maxBytes) {
        throw new FetchAdapterError(`Fixture payload for ${source.id} exceeded ${maxBytes}-byte bound`, "validation-failed");
      }

      const httpStatus = entry.httpStatus ?? 200;
      validateStructural(source, { httpStatus, mediaType: entry.mediaType, bytes });

      return {
        bytes,
        httpStatus,
        responseHeaders: { "content-type": entry.mediaType, "x-fixture-source": entry.filePath },
        mediaType: entry.mediaType,
      };
    },
  };
}
