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

export function isHistorical2012ApplicationBrowse(
  datasetIs2012Historical: boolean,
  browseEntity: string,
): boolean {
  return datasetIs2012Historical && browseEntity === "applications";
}

/** 2012 payload exposes `contentionSet` only — no post-Reveal lifecycle fields. */
export function historical2012ContentionMembershipLabel(
  contentionSet: Application["contentionSet"],
): string {
  return contentionSet ?? "Not in contention";
}

export function historical2012IdnLabel(idn: boolean): string {
  return idn ? "IDN" : "Non-IDN";
}

/** Explore filter bar value when participation (new/returning) is not present on 2012 payload rows. */
export const HISTORICAL_2012_PARTICIPATION_FILTER_UNSUPPORTED = "unsupported" as const;

/** Strip 2026-only participation filters before querying the 2012 corpus. */
export function exploreFiltersFor2012Historical<T extends { status: string }>(filters: T): T {
  return { ...filters, status: "all" };
}
