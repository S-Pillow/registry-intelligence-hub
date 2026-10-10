import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import type { CanonicalReconciliationStats } from "./types";

export const ROUND_WIDE_APPLICATION_COUNT = 1930 as const;

export function revealDayCsvPath(workspaceRoot: string): string {
  return join(
    workspaceRoot,
    "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
  );
}

export async function loadRevealDayApplicationIds(workspaceRoot: string): Promise<string[]> {
  const csv = await readFile(revealDayCsvPath(workspaceRoot), "utf8");
  const rows = parseRevealDayCsvText(csv);
  return rows.map((r) => r.applicationId);
}

export function reconcileCanonicalMapping(
  expectedApplicationIds: readonly string[],
  mapping: ReadonlyMap<string, number>,
): CanonicalReconciliationStats {
  const expectedSet = new Set(expectedApplicationIds);
  const mappedApps = [...mapping.keys()];

  const missingApplicationIds = expectedApplicationIds.filter((id) => !mapping.has(id));
  const extraApplicationIds = mappedApps.filter((id) => !expectedSet.has(id)).sort();

  const duplicateApplicationIds: string[] = [];
  const acToApps = new Map<number, string[]>();
  for (const [applicationId, acId] of mapping.entries()) {
    const list = acToApps.get(acId) ?? [];
    list.push(applicationId);
    acToApps.set(acId, list);
  }

  const duplicateGtldresultAcIds: Array<{ gtldresultAcId: number; applicationIds: string[] }> = [];
  for (const [acId, apps] of acToApps.entries()) {
    if (apps.length > 1) {
      duplicateGtldresultAcIds.push({ gtldresultAcId: acId, applicationIds: [...apps].sort() });
    }
  }

  const exact =
    missingApplicationIds.length === 0 &&
    extraApplicationIds.length === 0 &&
    duplicateApplicationIds.length === 0 &&
    duplicateGtldresultAcIds.length === 0 &&
    mapping.size === expectedApplicationIds.length;

  return {
    expectedCount: expectedApplicationIds.length,
    mappedCount: mapping.size,
    missingApplicationIds,
    extraApplicationIds,
    duplicateApplicationIds,
    duplicateGtldresultAcIds,
    exact,
  };
}
