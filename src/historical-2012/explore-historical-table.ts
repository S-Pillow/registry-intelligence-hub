import type { Application, ExploreFilterState } from "@/lib/registry-data";

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

/** Results summary for Explore ?dataset=2012-historical with Browse by Applications (one row per application). */
export function formatHistorical2012ApplicationResultsSummary(applicationCount: number): string {
  return applicationCount === 1
    ? "1 application result"
    : `${applicationCount} application results`;
}

/** String aggregate summary when filters match string rows (not application-grain contention counts). */
export function formatHistorical2012StringAggregateResultsSummary(
  stringRowCount: number,
  totalApplicationsInMatchedStrings: number,
): string {
  const stringsPart =
    stringRowCount === 1 ? "1 string result" : `${stringRowCount} strings results`;
  const appsPart =
    totalApplicationsInMatchedStrings === 1
      ? "1 total application in matched strings"
      : `${totalApplicationsInMatchedStrings} total applications in matched strings`;
  return `${stringsPart} · ${appsPart}`;
}

/** Trust badge copy for CSV-backed application row fields (not contention membership). */
export const HISTORICAL_2012_TRUST_REVEAL_DAY_CSV = "2012 CSV" as const;

/** Trust badge when the browse grain is derived unique strings from the same payload. */
export const HISTORICAL_2012_TRUST_STRING_DERIVED = "2012 CSV · string derived" as const;

/** Contention membership is joined from the official PDF pipeline — never the Reveal Day CSV. */
export const HISTORICAL_2012_CONTENTION_FIELD_PROVENANCE =
  "Official string-similarity contention publication (26 Feb 2013 PDF), offline extraction — not Reveal Day CSV." as const;

export const HISTORICAL_2012_INTERNAL_CONTENTION_SET_ID_NOTE =
  "Internal deterministic Hub set id (evidence metadata only — not an ICANN-published set identifier).";

/** User-facing contention label — never raw `ICS-2012-*` ids in table cells. */
export function historical2012ContentionMembershipLabel(
  contentionSet: Application["contentionSet"],
): string {
  return contentionSet ? "Application contention membership" : "Not in contention";
}

/** Internal set id for drawer / evidence metadata when membership is present. */
export function historical2012ContentionMembershipEvidenceId(
  contentionSet: Application["contentionSet"],
): string | null {
  return contentionSet ?? null;
}

/**
 * String-level contention summary from member applications' contention memberships.
 * Does not surface blocked aggregate set counts (232/234) or internal set ids.
 */
export function historical2012StringContentionSummary(records: readonly Application[]): string {
  const inContention = records.filter((record) => record.contentionSet).length;
  if (inContention === 0) return "Not in contention";
  const setCount = new Set(records.map((record) => record.contentionSet).filter(Boolean)).size;
  if (setCount === 1 && inContention === records.length) return "Application contention membership";
  if (setCount === 1) return `Mixed membership (${inContention}/${records.length} in contention)`;
  return `${setCount} distinct contention memberships`;
}

export function historical2012ExploreSearchPlaceholder(browseEntity: string, is2012Historical: boolean): string {
  if (is2012Historical && browseEntity === "strings") {
    return "Search applied strings, application IDs, applicants, regions…";
  }
  if (is2012Historical) {
    return "Search applied strings, application IDs, applicants, regions…";
  }
  return "Search applications, organizations, strings, categories, regions…";
}

export function historical2012ExploreDatasetBadge(
  browseEntity: string,
  applicationCount: number,
  uniqueStringCount: number = HISTORICAL_2012_UNIQUE_STRING_COUNT,
): string {
  if (browseEntity === "strings") {
    return `2012 Reveal Day historical · ${uniqueStringCount} strings`;
  }
  return `2012 Reveal Day historical · ${applicationCount} applications`;
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

/** Normalize applied-string search tokens (`.APP`, `APP`, case) for aggregate predicates. */
export function normalizeHistorical2012ExploreStringQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^\.+/, "");
}

/** Whether one application row matches Explore search (including normalized applied string). */
export function historical2012ApplicationMatchesExploreQuery(
  item: Application,
  query: string,
): boolean {
  const needle = query.toLowerCase();
  const normalizedNeedle = normalizeHistorical2012ExploreStringQuery(query);
  if (normalizedNeedle && normalizeHistorical2012ExploreStringQuery(item.string) === normalizedNeedle) {
    return true;
  }
  return [item.id, item.applicant, item.organization, item.category, item.region, item.country].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

/**
 * Aggregate-match predicate for historical string browse: filters decide which strings qualify;
 * qualifying rows always retain the full member set from the complete payload grouping.
 */
export function historical2012StringAggregateMatchesExploreFilters(
  records: readonly Application[],
  stringKey: string,
  filters: ExploreFilterState,
  options?: { knownStringKeys?: ReadonlySet<string> },
): boolean {
  const selectedIds = new Set(filters.ids.split(",").filter(Boolean));
  if (selectedIds.size && !records.some((item) => selectedIds.has(item.id))) return false;
  if (filters.category !== "all" && !records.some((item) => item.category === filters.category)) {
    return false;
  }
  if (filters.region !== "all" && !records.some((item) => item.region === filters.region)) {
    return false;
  }
  if (filters.status !== "all") {
    const wantReturning = filters.status === "returning";
    if (!records.some((item) => (wantReturning ? item.returning : !item.returning))) return false;
  }
  if (filters.contention !== "all") {
    const wantInContention = filters.contention === "in";
    if (!records.some((item) => (wantInContention ? Boolean(item.contentionSet) : !item.contentionSet))) {
      return false;
    }
  }
  if (filters.idn !== "all") {
    const wantIdn = filters.idn === "idn";
    if (!records.some((item) => (wantIdn ? item.idn : !item.idn))) return false;
  }
  if (filters.q.trim()) {
    const normalizedQuery = normalizeHistorical2012ExploreStringQuery(filters.q);
    const knownStringKeys = options?.knownStringKeys;
    if (normalizedQuery && knownStringKeys?.has(normalizedQuery)) {
      return stringKey.toLowerCase() === normalizedQuery;
    }
    if (normalizedQuery && stringKey.toLowerCase() === normalizedQuery) return true;
    return records.some((item) => historical2012ApplicationMatchesExploreQuery(item, filters.q));
  }
  return true;
}

/** Build complete string aggregates from the full corpus, then apply aggregate-match filters. */
export function filterHistorical2012StringAggregates(
  applications: readonly Application[],
  filters: ExploreFilterState,
): Historical2012StringRow[] {
  const knownStringKeys = new Set(
    applications.map((application) => application.string.toLowerCase()),
  );
  return groupHistorical2012ApplicationsByString(applications).filter((row) =>
    historical2012StringAggregateMatchesExploreFilters(row.records, row.stringKey, filters, {
      knownStringKeys,
    }),
  );
}

export function underlyingApplicationsInHistorical2012StringAggregates(
  rows: readonly Historical2012StringRow[],
): number {
  return rows.reduce((sum, row) => sum + row.records.length, 0);
}
