import { readFile } from "node:fs/promises";
import { MID_PANEL_TLDS, SuffixDemandCounterError, type PanelManifest } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA_RE = /^[a-f0-9]{64}$/;

export function assertPanelManifest(value: unknown): PanelManifest {
  if (!value || typeof value !== "object") {
    throw new SuffixDemandCounterError("Panel manifest must be a JSON object");
  }
  const raw = value as Record<string, unknown>;
  const manifestId = requireString(raw, "manifestId");
  const sourceName = requireString(raw, "sourceName");
  const sourceUrl = requireString(raw, "sourceUrl");
  const snapshotDate = requireString(raw, "snapshotDate");
  if (!DATE_RE.test(snapshotDate)) {
    throw new SuffixDemandCounterError(`snapshotDate must be YYYY-MM-DD, got ${snapshotDate}`);
  }
  if (!Array.isArray(raw.panel) || raw.panel.length === 0) {
    throw new SuffixDemandCounterError("manifest.panel must be a non-empty array");
  }

  const panel = raw.panel.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new SuffixDemandCounterError(`panel[${index}] must be an object`);
    }
    const row = entry as Record<string, unknown>;
    const tld = requireString(row, "tld").toLowerCase().replace(/^\./, "");
    const filename = requireString(row, "filename");
    const sha256 = requireString(row, "sha256").toLowerCase();
    const declaredDomains = row.declaredDomains;
    if (!SHA_RE.test(sha256)) {
      throw new SuffixDemandCounterError(`panel[${index}].sha256 must be 64 lowercase hex chars`);
    }
    if (typeof declaredDomains !== "number" || !Number.isInteger(declaredDomains) || declaredDomains < 0) {
      throw new SuffixDemandCounterError(`panel[${index}].declaredDomains must be a non-negative integer`);
    }
    return { tld, filename, sha256, declaredDomains };
  });

  const tlds = panel.map((p) => p.tld);
  const unique = new Set(tlds);
  if (unique.size !== tlds.length) {
    throw new SuffixDemandCounterError("manifest.panel contains duplicate TLD entries");
  }

  return {
    manifestId,
    sourceName,
    sourceUrl,
    snapshotDate,
    description: typeof raw.description === "string" ? raw.description : undefined,
    panel,
  };
}

/** Ensure the manifest covers exactly the approved mid-panel TLD set. */
export function assertMidPanelCoverage(manifest: PanelManifest): void {
  const have = [...new Set(manifest.panel.map((p) => p.tld))].sort();
  const want = [...MID_PANEL_TLDS].sort();
  if (have.length !== want.length || have.some((t, i) => t !== want[i])) {
    throw new SuffixDemandCounterError(
      "Manifest TLD coverage does not match the approved mid-panel set",
      [
        `expected: ${want.join(", ")}`,
        `actual: ${have.join(", ")}`,
      ],
    );
  }
}

export async function loadPanelManifest(path: string): Promise<PanelManifest> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    throw new SuffixDemandCounterError(`Unable to read panel manifest: ${path}`, [
      err instanceof Error ? err.message : String(err),
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SuffixDemandCounterError(`Invalid JSON in panel manifest: ${path}`, [
      err instanceof Error ? err.message : String(err),
    ]);
  }
  return assertPanelManifest(parsed);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new SuffixDemandCounterError(`Missing or empty string field: ${key}`);
  }
  return value.trim();
}
