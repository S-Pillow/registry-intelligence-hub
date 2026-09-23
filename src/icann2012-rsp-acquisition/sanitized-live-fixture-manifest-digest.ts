import { sha256Hex } from "@/normalization/hashes";

/** Matches Python json.dumps(..., indent=2, ensure_ascii=True) for operator-export manifests. */
function jsonStringifyEnsureAscii(value: unknown, indent: number): string {
  return JSON.stringify(value, null, indent).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** Self-digest: SHA-256(UTF-8(JSON.stringify(manifest \\ { manifestSha256 }, indent=2, ensure_ascii=True) + "\\n")). */
export function sanitizedLiveFixtureManifestSelfDigest(
  manifestWithoutSelf: Record<string, unknown>,
): string {
  const serialized = `${jsonStringifyEnsureAscii(manifestWithoutSelf, 2)}\n`;
  return sha256Hex(Buffer.from(serialized, "utf8"));
}

export function manifestRecordWithoutSelfDigest(
  manifest: Record<string, unknown>,
): Record<string, unknown> {
  const { manifestSha256: _omit, ...rest } = manifest;
  return rest;
}
