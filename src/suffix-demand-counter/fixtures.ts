import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { MID_PANEL_TLDS, type PanelFileSpec, type PanelManifest } from "./types";

export type SyntheticTldFile = {
  tld: string;
  domains: string[];
  generated?: string;
  /** Override header Domains value (for mismatch tests). */
  headerDomains?: number;
};

/** Build ActiveDNS-like plaintext for one TLD list. */
export function buildActiveDnsListText(options: {
  tld: string;
  domains: string[];
  generated: string;
  headerDomains?: number;
}): string {
  const { tld, domains, generated } = options;
  const headerDomains = options.headerDomains ?? domains.length;
  const lines = [
    "# ActiveDNS monthly snapshot",
    "# Source: https://activedns.net/",
    `# TLD: .${tld}`,
    `# Generated: ${generated}`,
    `# Domains: ${headerDomains}`,
    "# Method: registrable domains observed by ActiveDNS",
    ...domains,
  ];
  return `${lines.join("\n")}\n`;
}

export function gzipList(text: string): Buffer {
  return gzipSync(Buffer.from(text, "utf8"));
}

export function sha256HexBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Write a complete mid-panel synthetic fixture set and matching manifest.
 * Returns paths + manifest object (with real digests).
 */
export async function writeSyntheticMidPanel(options: {
  dir: string;
  snapshotDate: string;
  manifestId?: string;
  files: SyntheticTldFile[];
}): Promise<{
  inputDir: string;
  manifestPath: string;
  manifest: PanelManifest;
  written: Array<{ filename: string; sha256: string; bytes: number }>;
}> {
  const inputDir = path.resolve(options.dir, "lists");
  await mkdir(inputDir, { recursive: true });

  const byTld = new Map(options.files.map((f) => [f.tld, f]));
  const panel: PanelFileSpec[] = [];
  const written: Array<{ filename: string; sha256: string; bytes: number }> = [];

  for (const tld of MID_PANEL_TLDS) {
    const file = byTld.get(tld);
    if (!file) {
      throw new Error(`Synthetic panel missing TLD .${tld}`);
    }
    const generated = file.generated ?? options.snapshotDate;
    const text = buildActiveDnsListText({
      tld,
      domains: file.domains,
      generated,
      headerDomains: file.headerDomains,
    });
    const gz = gzipList(text);
    const sha256 = sha256HexBuffer(gz);
    const filename = `synthetic_activedns_domainlist_dot-${tld}.txt.gz`;
    await writeFile(path.join(inputDir, filename), gz);
    panel.push({
      tld,
      filename,
      sha256,
      declaredDomains: file.headerDomains ?? file.domains.length,
    });
    written.push({ filename, sha256, bytes: gz.length });
  }

  const manifest: PanelManifest = {
    manifestId: options.manifestId ?? "synthetic-mid-panel",
    sourceName: "ActiveDNS",
    sourceUrl: "https://activedns.net/",
    snapshotDate: options.snapshotDate,
    description: "Synthetic mid-panel fixture for RIH-FCAST-03 tests (not production data).",
    panel,
  };

  const manifestPath = path.resolve(options.dir, "panel-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { inputDir, manifestPath, manifest, written };
}
