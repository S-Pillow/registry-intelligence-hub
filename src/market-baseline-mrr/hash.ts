import { createHash } from "node:crypto";

export function sha256Hex(bytes: Uint8Array | string): string {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  return createHash("sha256").update(buf).digest("hex");
}

/** Deterministic JSON for content hashing (stable key order via JSON.stringify insertion order). */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function hashNormalizedContent(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
