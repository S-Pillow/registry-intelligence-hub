import { createHash } from "node:crypto";

/** Deterministic JSON serialization for content hashing (sorted object keys). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function buildIdFromInput(inputContentHash: string, versions: string[]): string {
  return sha256Hex(`${inputContentHash}:${versions.join(":")}`).slice(0, 32);
}
