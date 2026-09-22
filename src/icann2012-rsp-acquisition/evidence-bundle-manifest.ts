import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import { stagingEvidenceBundleManifestPath } from "./bundle-paths";

export const EVIDENCE_BUNDLE_MANIFEST_VERSION =
  "registry-hub-rsp-mapping-evidence-bundle/1.0.0" as const;

const FORBIDDEN_PATH_SUBSTRINGS = [
  "cookie",
  "csrf",
  "jsessionid",
  "set-cookie",
  "authorization",
] as const;

export interface EvidenceBundleFileEntry {
  relativePath: string;
  byteLength: number;
  sha256: string;
}

export interface EvidenceBundleManifest {
  manifestVersion: typeof EVIDENCE_BUNDLE_MANIFEST_VERSION;
  runId: string;
  stagingRoot: string;
  commitSha?: string;
  corpusContentHash: string;
  generatedAt: string;
  files: EvidenceBundleFileEntry[];
  manifestSha256?: string;
}

async function listFilesRecursive(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(root, full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function isForbiddenEvidencePath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return FORBIDDEN_PATH_SUBSTRINGS.some((s) => lower.includes(s));
}

export async function buildEvidenceBundleManifest(input: {
  stagingRoot: string;
  runId: string;
  corpusContentHash: string;
  commitSha?: string;
}): Promise<EvidenceBundleManifest> {
  const filesOnDisk = await listFilesRecursive(input.stagingRoot, input.stagingRoot);
  const files: EvidenceBundleFileEntry[] = [];

  for (const absolute of filesOnDisk.sort()) {
    const rel = relative(input.stagingRoot, absolute).replace(/\\/g, "/");
    if (isForbiddenEvidencePath(rel)) {
      throw new Error(`Refusing to include forbidden evidence path in manifest: ${rel}`);
    }
    const bytes = await readFile(absolute);
    const st = await stat(absolute);
    files.push({
      relativePath: rel,
      byteLength: st.size,
      sha256: sha256Hex(bytes),
    });
  }

  const manifestWithoutSelf: EvidenceBundleManifest = {
    manifestVersion: EVIDENCE_BUNDLE_MANIFEST_VERSION,
    runId: input.runId,
    stagingRoot: input.stagingRoot,
    commitSha: input.commitSha,
    corpusContentHash: input.corpusContentHash,
    generatedAt: new Date().toISOString(),
    files,
  };

  const manifestSha256 = sha256Hex(Buffer.from(JSON.stringify(manifestWithoutSelf), "utf8"));
  return { ...manifestWithoutSelf, manifestSha256 };
}

export async function writeEvidenceBundleManifest(
  manifest: EvidenceBundleManifest,
): Promise<string> {
  const path = stagingEvidenceBundleManifestPath(manifest.stagingRoot, manifest.runId);
  const { manifestSha256: _omit, ...persisted } = manifest;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ ...persisted, manifestSha256: manifest.manifestSha256 }, null, 2)}\n`);
  return path;
}
