import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AcquisitionRunManifest,
  NormalizedTransactionsEnvelope,
  NormalizedTransactionsSnapshot,
  ReportingPeriod,
} from "./types";

export const MRR_ROOT_RELATIVE = ".data/market-baseline/mrr";

export function mrrRoot(cwd = process.cwd()): string {
  return join(cwd, MRR_ROOT_RELATIVE);
}

export function rawCsvPath(
  tld: string,
  period: ReportingPeriod,
  rawSha256: string,
  cwd = process.cwd(),
): string {
  return join(mrrRoot(cwd), "raw", tld, period, `${rawSha256}.csv`);
}

export function normalizedJsonPath(
  tld: string,
  period: ReportingPeriod,
  normalizedSha256: string,
  cwd = process.cwd(),
): string {
  return join(mrrRoot(cwd), "normalized", tld, period, `${normalizedSha256}.json`);
}

export function manifestPath(runId: string, cwd = process.cwd()): string {
  return join(mrrRoot(cwd), "manifests", `${runId}.json`);
}

export function indexPath(cwd = process.cwd()): string {
  return join(mrrRoot(cwd), "indexes", "current.json");
}

export function discoveryCachePath(cwd = process.cwd()): string {
  return join(mrrRoot(cwd), "indexes", "discovery-cache.json");
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function writeRawImmutable(
  tld: string,
  period: ReportingPeriod,
  rawSha256: string,
  bytes: Uint8Array,
  cwd = process.cwd(),
): Promise<{ path: string; wrote: boolean }> {
  const path = rawCsvPath(tld, period, rawSha256, cwd);
  try {
    await stat(path);
    return { path, wrote: false };
  } catch {
    // missing — write
  }
  await ensureParent(path);
  await writeFile(path, bytes);
  return { path, wrote: true };
}

/** List existing raw hashes for TLD/period (for revision detection). */
export async function listRawHashes(
  tld: string,
  period: ReportingPeriod,
  cwd = process.cwd(),
): Promise<string[]> {
  const dir = join(mrrRoot(cwd), "raw", tld, period);
  try {
    const names = await readdir(dir);
    return names.filter((n) => n.endsWith(".csv")).map((n) => n.replace(/\.csv$/, "")).sort();
  } catch {
    return [];
  }
}

export async function writeNormalizedEnvelope(
  envelope: NormalizedTransactionsEnvelope,
  cwd = process.cwd(),
): Promise<string> {
  const snap = envelope.snapshot;
  const path = normalizedJsonPath(snap.tldAsciiLabel, snap.reportingPeriod, snap.normalizedContentSha256, cwd);
  try {
    await stat(path);
    return path;
  } catch {
    // write
  }
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  return path;
}

export async function readNormalizedForPeriod(
  tld: string,
  period: ReportingPeriod,
  cwd = process.cwd(),
): Promise<NormalizedTransactionsSnapshot | null> {
  const dir = join(mrrRoot(cwd), "normalized", tld, period);
  try {
    const names = await readdir(dir);
    const jsons = names.filter((n) => n.endsWith(".json")).sort();
    if (jsons.length === 0) return null;
    // Prefer latest file name order; content is content-addressed
    const raw = await readFile(join(dir, jsons[jsons.length - 1]!), "utf8");
    const env = JSON.parse(raw) as NormalizedTransactionsEnvelope;
    return env.snapshot;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: AcquisitionRunManifest, cwd = process.cwd()): Promise<string> {
  const path = manifestPath(manifest.runId, cwd);
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

export async function writeCurrentIndex(
  payload: unknown,
  cwd = process.cwd(),
): Promise<string> {
  const path = indexPath(cwd);
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}
