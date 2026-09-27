import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";
import { omitHistoricalApplicationsForSharedLayout } from "@/historical-2012/payload-shared";
import {
  APPLICANT_LEGAL_NAME_CONCENTRATION_LIMIT,
  APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD,
  buildApplicantLegalNameConcentration,
  buildExactAppliedStringCompetition,
  EXACT_APPLIED_STRING_COMPETITION_GRAIN,
  EXACT_APPLIED_STRING_COMPETITION_LIMIT,
  EXACT_APPLIED_STRING_COMPETITION_METHOD,
  type Application,
} from "@/lib/registry-data";

/**
 * Server-side 2012 Reveal Day structure for Command Center.
 * The client receives this summary only. Competing-group cardinality is omitted
 * so the page cannot present an authoritative contention-set total.
 */
export type Historical2012LegalNameRank = {
  applicantLegalName: string;
  count: number;
  shareDenominator: number;
};

export type Historical2012RegionCount = {
  regionCode: string;
  applicationCount: number;
};

export type Historical2012RepeatedString = {
  appliedForString: string;
  applicationCount: number;
};

export type Historical2012StructuralSummary = {
  roundProgramYear: 2012;
  observation: "2012-reveal-day";
  applicationCount: number;
  legalNames: {
    method: typeof APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD;
    grain: "applicant-legal-name";
    distinctApplicantLegalNames: number;
    eligibleApplicationCount: number;
    shareDenominator: number;
    tieBreak: "application-count-desc-then-legal-name-ascending";
    ranked: Historical2012LegalNameRank[];
  };
  geography: {
    locationField: "Location";
    regionField: "Region";
    distinctLocations: number;
    regionCount: number;
    regions: Historical2012RegionCount[];
    applicationCount: number;
  };
  exactStrings: {
    method: typeof EXACT_APPLIED_STRING_COMPETITION_METHOD;
    grain: typeof EXACT_APPLIED_STRING_COMPETITION_GRAIN;
    tieBreak: "application-count-desc-then-applied-for-string-ascending";
    largestGroup: Historical2012RepeatedString | null;
    repeated: Historical2012RepeatedString[];
  };
};

export function buildHistorical2012StructuralSummary(
  applications: readonly Application[],
): Historical2012StructuralSummary {
  const legalNames = buildApplicantLegalNameConcentration([...applications]);
  const locationCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  for (const application of applications) {
    locationCounts.set(application.country, (locationCounts.get(application.country) ?? 0) + 1);
    regionCounts.set(application.region, (regionCounts.get(application.region) ?? 0) + 1);
  }
  const regions = [...regionCounts.entries()]
    .map(([regionCode, applicationCount]) => ({ regionCode, applicationCount }))
    .sort((a, b) => b.applicationCount - a.applicationCount || a.regionCode.localeCompare(b.regionCode));
  const exactStrings = buildExactAppliedStringCompetition(applications);
  const repeated = exactStrings.competingGroups
    .slice(0, EXACT_APPLIED_STRING_COMPETITION_LIMIT)
    .map((group) => ({
      appliedForString: group.appliedForString,
      applicationCount: group.applicationCount,
    }));
  const largest = exactStrings.competingGroups[0];
  return {
    roundProgramYear: 2012,
    observation: "2012-reveal-day",
    applicationCount: applications.length,
    legalNames: {
      method: legalNames.method,
      grain: "applicant-legal-name",
      distinctApplicantLegalNames: legalNames.distinctApplicantLegalNames,
      eligibleApplicationCount: legalNames.eligibleApplicationCount,
      shareDenominator: legalNames.eligibleApplicationCount,
      tieBreak: "application-count-desc-then-legal-name-ascending",
      ranked: legalNames.ranked.slice(0, APPLICANT_LEGAL_NAME_CONCENTRATION_LIMIT),
    },
    geography: {
      locationField: "Location",
      regionField: "Region",
      distinctLocations: locationCounts.size,
      regionCount: regions.length,
      regions,
      applicationCount: regions.reduce((sum, region) => sum + region.applicationCount, 0),
    },
    exactStrings: {
      method: exactStrings.method,
      grain: exactStrings.grain,
      tieBreak: "application-count-desc-then-applied-for-string-ascending",
      largestGroup: largest
        ? { appliedForString: largest.appliedForString, applicationCount: largest.applicationCount }
        : null,
      repeated,
    },
  };
}

/** Command Center transfer: summary from the full corpus, application rows omitted. */
export function prepareHistorical2012SharedLayout(resolution: Historical2012PayloadResolution): {
  applicationPayload: Historical2012PayloadResolution;
  structuralSummary: Historical2012StructuralSummary | null;
} {
  if (resolution.status !== "loaded") {
    return { applicationPayload: resolution, structuralSummary: null };
  }
  return {
    structuralSummary: buildHistorical2012StructuralSummary(resolution.document.applications),
    applicationPayload: omitHistoricalApplicationsForSharedLayout(resolution),
  };
}
