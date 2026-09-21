import type { Application } from "@/lib/registry-data";

/** Desktop column headers for Explore ?dataset=2012-historical with Browse by Applications. */
export const HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS = [
  "Applied string",
  "Application ID",
  "Applicant",
  "Region",
  "Contention membership",
  "IDN",
  "Trust / source",
  "Actions",
] as const;

/** Desktop column headers for Explore ?dataset=2012-historical with Browse by Strings (D2.1). */
export const HISTORICAL_2012_STRING_EXPLORE_COLUMN_HEADERS = [
  "Applied string",
  "Applications",
  "Regions",
  "Contention",
  "IDN",
  "Trust / source",
  "Actions",
] as const;

/** Approved baseline unique string count — derived deterministically from the 1,930-application payload. */
export const HISTORICAL_2012_UNIQUE_STRING_COUNT = 1409;

export function isHistorical2012ApplicationBrowse(
  datasetIs2012Historical: boolean,
  browseEntity: string,
): boolean {
  return datasetIs2012Historical && browseEntity === "applications";
}

export function isHistorical2012StringBrowse(
  datasetIs2012Historical: boolean,
  browseEntity: string,
): boolean {
  return datasetIs2012Historical && browseEntity === "strings";
}

/** 2012 payload exposes `contentionSet` only — no post-Reveal lifecycle fields. */
export function historical2012ContentionMembershipLabel(
  contentionSet: Application["contentionSet"],
): string {
  return contentionSet ?? "Not in contention";
}

/**
 * String-level contention summary from member applications' official contention set ids.
 * Does not surface blocked aggregate set counts (232/234).
 */
export function historical2012StringContentionSummary(records: readonly Application[]): string {
  const sets = [...new Set(records.map((record) => record.contentionSet).filter(Boolean))] as string[];
  if (sets.length === 0) return "Not in contention";
  if (sets.length === 1) return sets[0]!;
  return `${sets.length} distinct contention memberships`;
}

/** IDN label for a string row — all members IDN, none, or mixed. */
export function historical2012StringIdnSummary(records: readonly Application[]): string {
  const idnCount = records.filter((record) => record.idn).length;
  if (idnCount === 0) return "Non-IDN";
  if (idnCount === records.length) return "IDN";
  return "Mixed IDN";
}

export function historical2012IdnLabel(idn: boolean): string {
  return idn ? "IDN" : "Non-IDN";
}

export function historical2012DistinctRegionsLabel(records: readonly Application[]): string {
  return [...new Set(records.map((record) => record.region))].sort().join(", ");
}

export type Historical2012StringRow = {
  /** Canonical payload `string` field (without leading dot). */
  stringKey: string;
  /** Display label with leading dot. */
  label: string;
  records: Application[];
};

/** Deterministic grouping by canonical applied string field from the browser payload. */
export function groupHistorical2012ApplicationsByString(
  applications: readonly Application[],
): Historical2012StringRow[] {
  const grouped = new Map<string, Application[]>();
  for (const application of applications) {
    const key = application.string;
    grouped.set(key, [...(grouped.get(key) ?? []), application]);
  }
  return [...grouped.entries()]
    .map(([stringKey, records]) => ({
      stringKey,
      label: `.${stringKey}`,
      records: records.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.stringKey.localeCompare(b.stringKey));
}

/** Validates full-corpus string derivation: one row per string, every app assigned exactly once. */
export function assertHistorical2012StringCorpusIntegrity(
  applications: readonly Application[],
  expectedUniqueStrings: number = HISTORICAL_2012_UNIQUE_STRING_COUNT,
): { uniqueStrings: number; assignedApplications: number } {
  const rows = groupHistorical2012ApplicationsByString(applications);
  const assigned = rows.reduce((sum, row) => sum + row.records.length, 0);
  if (rows.length !== expectedUniqueStrings) {
    throw new Error(`Expected ${expectedUniqueStrings} unique strings, got ${rows.length}`);
  }
  if (assigned !== applications.length) {
    throw new Error(`String grouping lost or duplicated apps: ${assigned} vs ${applications.length}`);
  }
  return { uniqueStrings: rows.length, assignedApplications: assigned };
}

/** Explore filter bar value when participation (new/returning) is not present on 2012 payload rows. */
export const HISTORICAL_2012_PARTICIPATION_FILTER_UNSUPPORTED = "unsupported" as const;

/** Category taxonomy is not exported in the 2012 browser payload (139/1930 offline). */
export const HISTORICAL_2012_CATEGORY_FILTER_UNSUPPORTED = "unsupported" as const;

/** Strip 2026-only or unsupported filters before querying the 2012 corpus. */
export function exploreFiltersFor2012Historical<T extends { status: string; category?: string }>(
  filters: T,
  options?: { browseEntity?: string },
): T {
  const category =
    options?.browseEntity === "strings" ? "all" : filters.category;
  return { ...filters, status: "all", category };
}
