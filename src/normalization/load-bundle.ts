import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, sha256Hex } from "./hashes";
import { requireBundle } from "./registry";
import type { FixtureBundleDefinition, OverrideOperation, RawSnapshotRef } from "./types";

export interface LoadedFixtureBundle {
  definition: FixtureBundleDefinition;
  workspaceRoot: string;
  rawSnapshots: RawSnapshotRef[];
  applicationLinesPrimary: { lineNumber: number; text: string; parsed: Record<string, unknown> }[];
  applicationLinesSecondary: { lineNumber: number; text: string; parsed: Record<string, unknown> }[];
  contentionSets: { sets: Array<Record<string, unknown>> };
  registryOperators: { operators: Array<Record<string, unknown>> };
  overrides: { registryVersion: string; operations: OverrideOperation[] };
  inputContentHash: string;
}

async function readJson<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}

async function readJsonl(path: string): Promise<{ lineNumber: number; text: string; parsed: Record<string, unknown> }[]> {
  const text = await readFile(path, "utf8");
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    text: line,
    parsed: JSON.parse(line) as Record<string, unknown>,
  }));
}

export async function loadFixtureBundle(bundleId: string, workspaceRoot: string): Promise<LoadedFixtureBundle> {
  const definition = requireBundle(bundleId);
  const base = join(workspaceRoot, definition.fixtureRoot);

  const rawSnapshotFile = await readJson<{ snapshots: RawSnapshotRef[] }>(join(base, "raw-snapshots.json"));
  const applicationsPrimary = await readJsonl(join(base, "applications.jsonl"));
  const applicationsSecondary = await readJsonl(join(base, "secondary-applications.jsonl"));
  const contentionSets = await readJson<{ sets: Array<Record<string, unknown>> }>(join(base, "contention-sets.json"));
  const registryOperators = await readJson<{ operators: Array<Record<string, unknown>> }>(join(base, "registry-operators.json"));
  const overrides = await readJson<{ registryVersion: string; operations: OverrideOperation[] }>(join(base, "overrides.json"));

  const appPrimaryBytes = await readFile(join(base, "applications.jsonl"));
  const appSecondaryBytes = await readFile(join(base, "secondary-applications.jsonl"));

  const rawSnapshots = rawSnapshotFile.snapshots.map((snap, index) => {
    const bytes = index === 0 ? appPrimaryBytes : appSecondaryBytes;
    return {
      ...snap,
      sha256: sha256Hex(bytes),
      byteCount: bytes.byteLength,
    };
  });

  const inputContentHash = contentHash({
    bundleId: definition.id,
    bundleVersion: definition.version,
    rawSnapshots,
    applicationsPrimary: applicationsPrimary.map((l) => l.parsed),
    applicationsSecondary: applicationsSecondary.map((l) => l.parsed),
    contentionSets,
    registryOperators,
    overrides: overrides.operations,
  });

  return {
    definition,
    workspaceRoot,
    rawSnapshots,
    applicationLinesPrimary: applicationsPrimary,
    applicationLinesSecondary: applicationsSecondary,
    contentionSets,
    registryOperators,
    overrides,
    inputContentHash,
  };
}
