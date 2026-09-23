import { sha256Hex } from "@/normalization/hashes";

/** Self-digest: SHA-256(UTF-8(JSON.stringify(manifest \\ { manifestSha256 }, indent=2) + "\\n")). */
export function sanitizedLiveFixtureManifestSelfDigest(
  manifestWithoutSelf: Record<string, unknown>,
): string {
  const serialized = `${JSON.stringify(manifestWithoutSelf, null, 2)}\n`;
  return sha256Hex(Buffer.from(serialized, "utf8"));
}

export function manifestRecordWithoutSelfDigest(
  manifest: Record<string, unknown>,
): Record<string, unknown> {
  const { manifestSha256: _omit, ...rest } = manifest;
  return rest;
}
