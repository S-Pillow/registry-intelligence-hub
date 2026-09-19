import type { SourceDefinition } from "../types";
import { FetchAdapterError } from "../types";

/**
 * Structural validation shared by every adapter (HTTP and fixture alike) so
 * "validates response status/content" means the same thing everywhere,
 * rather than each adapter re-implementing its own notion of "valid".
 * Byte-bound enforcement during streaming is adapter-specific (see
 * http-adapter.ts); this is the final content check once bytes are in hand.
 */
export function validateStructural(
  source: SourceDefinition,
  input: { httpStatus: number; mediaType: string | null; bytes: Uint8Array },
): void {
  if (input.httpStatus >= 500) {
    throw new FetchAdapterError(`Server error ${input.httpStatus} fetching ${source.url}`, "network-error");
  }
  if (input.httpStatus < 200 || input.httpStatus >= 300) {
    throw new FetchAdapterError(`Unexpected status ${input.httpStatus} fetching ${source.url}`, "validation-failed");
  }

  const actualMain = input.mediaType?.split(";")[0]?.trim().toLowerCase() ?? null;
  if (actualMain !== source.mediaTypeHint.toLowerCase()) {
    throw new FetchAdapterError(
      `Expected media type "${source.mediaTypeHint}" for ${source.id} but received "${input.mediaType ?? "(none)"}"`,
      "validation-failed",
    );
  }

  if (input.bytes.byteLength === 0) {
    throw new FetchAdapterError(`Payload for ${source.id} was empty`, "validation-failed");
  }

  if (source.format === "json") {
    try {
      JSON.parse(Buffer.from(input.bytes).toString("utf8"));
    } catch (error) {
      throw new FetchAdapterError(
        `Payload for ${source.id} declared as JSON but failed to parse: ${(error as Error).message}`,
        "validation-failed",
      );
    }
  }
}
