import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, sha256Hex } from "./hashes";
import { parseRevealDayCsvText } from "./parse-reveal-csv";
import { requireBundle } from "./registry";
import type {
  ApplicationFixtureFormat,
  FixtureBundleDefinition,
  OrganizationPromotionRegistry,
  OverrideOperation,
  RawSnapshotRef,
} from "./types";
import { ORGANIZATION_PROMOTION_METHOD_VERSION, ORGANIZATION_PROMOTION_REGISTRY_VERSION } from "./types";

export interface LoadedFixtureBundle {
  definition: FixtureBundleDefinition;
  workspaceRoot: string;
  applicationFormat: ApplicationFixtureFormat;
  rawSnapshots: RawSnapshotRef[];
  applicationLinesPrimary: { lineNumber: number; text: string; parsed: Record<string, unknown> }[];
  applicationLinesSecondary: { lineNumber: number; text: string; parsed: Record<string, unknown> }[];
  contentionSets: { sets: Array<Record<string, unknown>> };
  /** Official contention membership from ICANN publication — never inferred from identical strings. */
  contentionMembershipByApplicationId: Map<string, string>;
  registryOperators: { operators: Array<Record<string, unknown>> };
  overrides: { registryVersion: string; operations: OverrideOperation[] };
  organizationPromotions: OrganizationPromotionRegistry;
  inputContentHash: string;
  roundAccounting?: {
    applicationRowCount: number;
    contentionSetCount: number;
    contentionMembershipCount: number;
    contentionUniqueApplicationIds: number;
  };
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

function buildContentionMembership(
  contentionFile: { sets: Array<Record<string, unknown>> },
): Map<string, string> {
  const map = new Map<string, string>();
  for (const set of contentionFile.sets) {
    const setId = String(set.setId);
    const applicationIds = (set.applicationIds as string[]) ?? [];
    for (const appId of applicationIds) {
      if (map.has(appId) && map.get(appId) !== setId) {
        throw new Error(`Application ${appId} appears in multiple official contention sets`);
      }
      map.set(appId, setId);
    }
  }
  return map;
}

export async function loadFixtureBundle(bundleId: string, workspaceRoot: string): Promise<LoadedFixtureBundle> {
  const definition = requireBundle(bundleId);
  const base = join(workspaceRoot, definition.fixtureRoot);
  const applicationFormat = definition.applicationFormat ?? "jsonl-dual-source";

  const rawSnapshotFile = await readJson<{ snapshots: RawSnapshotRef[] }>(join(base, "raw-snapshots.json"));
  const contentionPayload = await readJson<{
    sets: Array<Record<string, unknown>>;
    uniqueApplicationIds?: number;
    applicationMembershipCount?: number;
  }>(join(base, "contention-sets.json"));
  const registryOperators = await readJson<{ operators: Array<Record<string, unknown>> }>(
    join(base, "registry-operators.json"),
  );
  const overrides = await readJson<{ registryVersion: string; operations: OverrideOperation[] }>(join(base, "overrides.json"));
  const organizationPromotions = await readJson<OrganizationPromotionRegistry>(
    join(base, "organization-promotions.json"),
  );
  if (organizationPromotions.registryVersion !== ORGANIZATION_PROMOTION_REGISTRY_VERSION) {
    throw new Error(`Unexpected organization promotion registry version for ${bundleId}`);
  }
  if (organizationPromotions.methodVersion !== ORGANIZATION_PROMOTION_METHOD_VERSION) {
    throw new Error(`Unexpected organization promotion method version for ${bundleId}`);
  }

  let applicationsPrimary: LoadedFixtureBundle["applicationLinesPrimary"] = [];
  let applicationsSecondary: LoadedFixtureBundle["applicationLinesSecondary"] = [];
  const snapshotByteInputs: Uint8Array[] = [];

  if (applicationFormat === "reveal-day-csv") {
    const csvPath = join(base, "sources", "strings-1200utc-13jun12-en.csv");
    const csvBytes = await readFile(csvPath);
    snapshotByteInputs.push(csvBytes);
    const pdfBytes = await readFile(join(base, "sources", "similarity-contention-26feb13-en.pdf"));
    snapshotByteInputs.push(pdfBytes);

    const rows = parseRevealDayCsvText(csvBytes.toString("utf8"));
    applicationsPrimary = rows.map((row, index) => ({
      lineNumber: index + 2,
      text: JSON.stringify(row),
      parsed: row as unknown as Record<string, unknown>,
    }));
  } else {
    const appPrimaryBytes = await readFile(join(base, "applications.jsonl"));
    const appSecondaryBytes = await readFile(join(base, "secondary-applications.jsonl"));
    snapshotByteInputs.push(appPrimaryBytes, appSecondaryBytes);
    applicationsPrimary = await readJsonl(join(base, "applications.jsonl"));
    applicationsSecondary = await readJsonl(join(base, "secondary-applications.jsonl"));
  }

  const rawSnapshots = rawSnapshotFile.snapshots.map((snap, index) => {
    const bytes = snapshotByteInputs[index] ?? snapshotByteInputs[0];
    const sha256 = sha256Hex(bytes);
    return {
      ...snap,
      sha256,
      byteCount: bytes.byteLength,
      provenance: snap.provenance
        ? { ...snap.provenance, contentSha256: sha256 }
        : snap.provenance,
    };
  });

  const contentionSets = { sets: contentionPayload.sets };
  const contentionMembershipByApplicationId = buildContentionMembership(contentionSets);

  const inputContentHash = contentHash({
    bundleId: definition.id,
    bundleVersion: definition.version,
    rawSnapshots,
    applicationsPrimary: applicationsPrimary.map((l) => l.parsed),
    applicationsSecondary: applicationsSecondary.map((l) => l.parsed),
    contentionSets,
    registryOperators,
    overrides: overrides.operations,
    organizationPromotions: organizationPromotions.operations,
  });

  const roundAccounting =
    applicationFormat === "reveal-day-csv"
      ? {
          applicationRowCount: applicationsPrimary.length,
          contentionSetCount: contentionSets.sets.length,
          contentionMembershipCount: contentionPayload.applicationMembershipCount ?? 0,
          contentionUniqueApplicationIds: contentionPayload.uniqueApplicationIds ?? contentionMembershipByApplicationId.size,
        }
      : undefined;

  return {
    definition,
    workspaceRoot,
    applicationFormat,
    rawSnapshots,
    applicationLinesPrimary: applicationsPrimary,
    applicationLinesSecondary: applicationsSecondary,
    contentionSets,
    contentionMembershipByApplicationId,
    registryOperators,
    overrides,
    organizationPromotions,
    inputContentHash,
    roundAccounting,
  };
}
