import type { FetchAdapter, FetchOptions, RawFetchResult, SourceDefinition } from "../types";
import { FetchAdapterError } from "../types";
import { validateStructural } from "./validate-response";

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/**
 * Live network adapter. Streams the response body and aborts as soon as the
 * source's byte bound is exceeded, rather than buffering an unbounded
 * response and checking afterward — a slow/huge/misbehaving endpoint can
 * never force this adapter to hold more than `maxBytes` in memory. Never
 * writes anything to disk itself; the pipeline only persists bytes this
 * function successfully returns in full, which is what makes "no partial
 * blob ever reaches storage" true by construction rather than by cleanup.
 */
export function createHttpAdapter(schemaVersion = "http-adapter/1.0.0"): FetchAdapter {
  return {
    id: "http",
    schemaVersion,
    async fetchRaw(source: SourceDefinition, options: FetchOptions): Promise<RawFetchResult> {
      const maxBytes = options.maxBytesOverride ?? source.maxBytes;

      let response: Response;
      try {
        response = await fetch(source.url, {
          signal: options.signal,
          headers: { "user-agent": "registry-intelligence-hub-source-pipeline/1.0 (research prototype)" },
        });
      } catch (error) {
        throw new FetchAdapterError(`Network request failed: ${(error as Error).message}`, "network-error");
      }

      const responseHeaders = headersToRecord(response.headers);
      const mediaType = response.headers.get("content-type");

      const declaredLength = response.headers.get("content-length");
      if (declaredLength && Number(declaredLength) > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new FetchAdapterError(
          `Declared Content-Length ${declaredLength} exceeds ${maxBytes}-byte bound for ${source.id}`,
          "validation-failed",
        );
      }

      const bytes = await readBoundedBody(response, maxBytes, source.id);
      validateStructural(source, { httpStatus: response.status, mediaType, bytes });

      return { bytes, httpStatus: response.status, responseHeaders, mediaType };
    },
  };
}

async function readBoundedBody(response: Response, maxBytes: number, sourceId: string): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel(`exceeded ${maxBytes}-byte bound`).catch(() => undefined);
      throw new FetchAdapterError(`Payload for ${sourceId} exceeded ${maxBytes}-byte bound while streaming`, "validation-failed");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}
