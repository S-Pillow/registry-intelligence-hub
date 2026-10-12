/**
 * HIST-COHORT-1 / 2A / 2B — 2012 Applicant portfolio structure, exact-string
 * competition exposure, and regional Applicant structure (2012-only).
 *
 * Grain: exact Applicant legal name on the committed Reveal Day fixture.
 * Competition unit: exact repeated applied-for string (not official contention).
 * Region: source-provided Reveal Day `Region` code (not Geographic designation).
 * No Organization merge, no affiliate inference, no cross-round deltas.
 */

import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD,
  buildApplicantLegalNameConcentration,
  buildExactAppliedStringCompetition,
  EXACT_APPLIED_STRING_COMPETITION_GRAIN,
  EXACT_APPLIED_STRING_COMPETITION_METHOD,
  exactAppliedForStringKey,
  exploreHistorical2012RegionHref,
  exploreHistorical2012StringsHref,
  type Application,
} from "@/lib/registry-data";
import { hubPath } from "@/lib/hub-paths";

export const HISTORICAL_COHORT_METHOD = "applicant-legal-name-portfolio-cohorts/1.0.0";
export const HISTORICAL_COHORT_GRAIN = "applicant-legal-name" as const;
export const HISTORICAL_COHORT_TITLE = "2012 Applicant portfolio structure";
export const HISTORICAL_COHORT_SUBTITLE =
  "How Applications were distributed across Applicant legal names in the 2012 round";
export const HISTORICAL_COHORT_PRODUCT_QUESTION =
  "Was the 2012 round dominated by one-off Applicants or portfolio players, and how concentrated were Applications among the largest Applicant legal names?";

/** Accepted portfolio-size bands (inclusive). */
export const HISTORICAL_COHORT_PORTFOLIO_BANDS = [
  { id: "1", label: "1 Application", min: 1, max: 1 },
  { id: "2-4", label: "2–4 Applications", min: 2, max: 4 },
  { id: "5-9", label: "5–9 Applications", min: 5, max: 9 },
  { id: "10-24", label: "10–24 Applications", min: 10, max: 24 },
  { id: "25+", label: "25+ Applications", min: 25, max: Number.POSITIVE_INFINITY },
] as const;

export type HistoricalCohortBandId = (typeof HISTORICAL_COHORT_PORTFOLIO_BANDS)[number]["id"];

export const HISTORICAL_COHORT_CONCENTRATION_TOP_NS = [5, 10, 25, 50] as const;

/** Enough ranked rows to surface the tied 26-Application legal names. */
export const HISTORICAL_COHORT_LARGEST_LIMIT = 12;

/** Bounded exact-string competition ranking (exposed Applications desc). */
export const HISTORICAL_COHORT_EXACT_STRING_EXPOSURE_LIMIT = 25;

/** Canonical Reveal Day Region presentation order (not a performance ranking). */
export const HISTORICAL_COHORT_REGION_CODES = ["NA", "EUR", "AP", "LAC", "AF"] as const;

export type HistoricalCohortRegionCode = (typeof HISTORICAL_COHORT_REGION_CODES)[number];

const ACCEPTED_REGION_CODES = new Set<string>(HISTORICAL_COHORT_REGION_CODES);

export type HistoricalCohortPortfolioBand = {
  id: HistoricalCohortBandId;
  label: string;
  min: number;
  max: number | null;
  applicantCount: number;
  applicationCount: number;
  applicantShare: number;
  applicationShare: number;
};

export type HistoricalCohortOneOffVsMulti = {
  oneOffApplicants: number;
  multiApplicants: number;
  oneOffApplications: number;
  multiApplications: number;
  oneOffApplicantShare: number;
  multiApplicantShare: number;
  oneOffApplicationShare: number;
  multiApplicationShare: number;
};

export type HistoricalCohortConcentrationRow = {
  topN: number;
  applicationCount: number;
  share: number;
};

export type HistoricalCohortLargestApplicant = {
  rank: number;
  applicantLegalName: string;
  applicationCount: number;
  share: number;
  exploreHref: string;
};

export type HistoricalCohortExactStringExposureRow = {
  rank: number;
  applicantLegalName: string;
  portfolioApplicationCount: number;
  applicationsInExactStringCompetition: number;
  distinctRepeatedStrings: number;
  portfolioExposureShare: number;
  exploreHref: string;
};

export type HistoricalCohortExactStringCompetition = {
  label: "Exact-string competition";
  productQuestion: string;
  method: typeof EXACT_APPLIED_STRING_COMPETITION_METHOD;
  grain: typeof EXACT_APPLIED_STRING_COMPETITION_GRAIN;
  applicantsExposed: number;
  applicationsExposed: number;
  repeatedStringCount: number;
  applicantShare: number;
  applicationShare: number;
  /** Applications in exact repeats that also carry preliminary contention membership. */
  exactRepeatApplicationsAlsoInPreliminaryContention: number;
  ranked: HistoricalCohortExactStringExposureRow[];
  limitations: string[];
};

export type HistoricalCohortRegionalRow = {
  regionCode: HistoricalCohortRegionCode;
  applicantCount: number;
  applicantShare: number;
  applicationCount: number;
  applicationShare: number;
  exploreHref: string;
};

export type HistoricalCohortRegionalStructure = {
  label: "2012 Applicant regional structure";
  productQuestion: string;
  regionField: "Region";
  regionCodes: readonly HistoricalCohortRegionCode[];
  applicationDenominator: number;
  applicantDenominator: number;
  rows: HistoricalCohortRegionalRow[];
  limitations: string[];
};

export type HistoricalApplicantPortfolioCohortIntelligence = {
  roundProgramYear: 2012;
  observation: "2012-reveal-day";
  method: typeof HISTORICAL_COHORT_METHOD;
  concentrationMethod: typeof APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD;
  grain: typeof HISTORICAL_COHORT_GRAIN;
  title: typeof HISTORICAL_COHORT_TITLE;
  subtitle: typeof HISTORICAL_COHORT_SUBTITLE;
  productQuestion: typeof HISTORICAL_COHORT_PRODUCT_QUESTION;
  applicationDenominator: number;
  applicantLegalNameDenominator: number;
  bands: HistoricalCohortPortfolioBand[];
  oneOffVsMulti: HistoricalCohortOneOffVsMulti;
  concentration: HistoricalCohortConcentrationRow[];
  largest: HistoricalCohortLargestApplicant[];
  exactStringCompetition: HistoricalCohortExactStringCompetition;
  regionalStructure: HistoricalCohortRegionalStructure;
  provenance: {
    sourceLabel: string;
    grainLabel: string;
    applicationDenominatorLabel: string;
    applicantDenominatorLabel: string;
    limitations: string[];
  };
  exclusions: string[];
  hrefs: {
    commandCenter: string;
    crossRound: string;
    exploreHistorical: string;
    exploreHistoricalStrings: string;
    dataHealth: string;
    exactStringSectionAnchor: string;
    regionalSectionAnchor: string;
  };
};

export function historicalCohortsHref(): string {
  return hubPath("/historical-cohorts");
}

/** Explore historical Applications filtered/searching an exact Applicant legal name. */
export function exploreHistorical2012ApplicantLegalNameHref(applicantLegalName: string): string {
  const params = new URLSearchParams();
  params.set("dataset", "2012-historical");
  params.set("entity", "applications");
  const trimmed = applicantLegalName.trim();
  if (trimmed) params.set("q", trimmed);
  return `${hubPath("/explore")}?${params}`;
}

function share(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function bandForCount(count: number): (typeof HISTORICAL_COHORT_PORTFOLIO_BANDS)[number] {
  const found = HISTORICAL_COHORT_PORTFOLIO_BANDS.find(
    (band) => count >= band.min && count <= band.max,
  );
  if (!found) {
    throw new Error(`No portfolio band for Application count ${count}`);
  }
  return found;
}

/**
 * Server-side cohort aggregates from committed 2012 Applications.
 * Returns aggregates and top-N only — never the full Application corpus.
 */
export function buildHistoricalApplicantPortfolioCohorts(
  applications: readonly Application[],
): HistoricalApplicantPortfolioCohortIntelligence {
  const concentration = buildApplicantLegalNameConcentration([...applications]);
  const applicationDenominator = concentration.eligibleApplicationCount;
  const applicantLegalNameDenominator = concentration.distinctApplicantLegalNames;
  const ranked = concentration.ranked;

  const bandAccum = new Map<
    HistoricalCohortBandId,
    { applicantCount: number; applicationCount: number }
  >();
  for (const band of HISTORICAL_COHORT_PORTFOLIO_BANDS) {
    bandAccum.set(band.id, { applicantCount: 0, applicationCount: 0 });
  }
  for (const row of ranked) {
    const band = bandForCount(row.count);
    const slot = bandAccum.get(band.id)!;
    slot.applicantCount += 1;
    slot.applicationCount += row.count;
  }

  const bands: HistoricalCohortPortfolioBand[] = HISTORICAL_COHORT_PORTFOLIO_BANDS.map((band) => {
    const slot = bandAccum.get(band.id)!;
    return {
      id: band.id,
      label: band.label,
      min: band.min,
      max: Number.isFinite(band.max) ? band.max : null,
      applicantCount: slot.applicantCount,
      applicationCount: slot.applicationCount,
      applicantShare: share(slot.applicantCount, applicantLegalNameDenominator),
      applicationShare: share(slot.applicationCount, applicationDenominator),
    };
  });

  const oneOffBand = bands.find((band) => band.id === "1")!;
  const oneOffApplicants = oneOffBand.applicantCount;
  const oneOffApplications = oneOffBand.applicationCount;
  const multiApplicants = applicantLegalNameDenominator - oneOffApplicants;
  const multiApplications = applicationDenominator - oneOffApplications;

  const concentrationRows: HistoricalCohortConcentrationRow[] =
    HISTORICAL_COHORT_CONCENTRATION_TOP_NS.map((topN) => {
      const applicationCount = ranked
        .slice(0, topN)
        .reduce((sum, row) => sum + row.count, 0);
      return {
        topN,
        applicationCount,
        share: share(applicationCount, applicationDenominator),
      };
    });

  const largest: HistoricalCohortLargestApplicant[] = ranked
    .slice(0, HISTORICAL_COHORT_LARGEST_LIMIT)
    .map((row, index) => ({
      rank: index + 1,
      applicantLegalName: row.applicantLegalName,
      applicationCount: row.count,
      share: share(row.count, applicationDenominator),
      exploreHref: exploreHistorical2012ApplicantLegalNameHref(row.applicantLegalName),
    }));

  const exactStringCompetition = buildExactStringCompetitionExposure({
    applications,
    portfolioByLegalName: new Map(ranked.map((row) => [row.applicantLegalName, row.count])),
    applicantLegalNameDenominator,
    applicationDenominator,
  });

  const regionalStructure = buildRegionalApplicantStructure({
    applications,
    applicantLegalNameDenominator,
    applicationDenominator,
  });

  return {
    roundProgramYear: 2012,
    observation: "2012-reveal-day",
    method: HISTORICAL_COHORT_METHOD,
    concentrationMethod: APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD,
    grain: HISTORICAL_COHORT_GRAIN,
    title: HISTORICAL_COHORT_TITLE,
    subtitle: HISTORICAL_COHORT_SUBTITLE,
    productQuestion: HISTORICAL_COHORT_PRODUCT_QUESTION,
    applicationDenominator,
    applicantLegalNameDenominator,
    bands,
    oneOffVsMulti: {
      oneOffApplicants,
      multiApplicants,
      oneOffApplications,
      multiApplications,
      oneOffApplicantShare: share(oneOffApplicants, applicantLegalNameDenominator),
      multiApplicantShare: share(multiApplicants, applicantLegalNameDenominator),
      oneOffApplicationShare: share(oneOffApplications, applicationDenominator),
      multiApplicationShare: share(multiApplications, applicationDenominator),
    },
    concentration: concentrationRows,
    largest,
    exactStringCompetition,
    regionalStructure,
    provenance: {
      sourceLabel: APPROVED_2012_BASELINE.sourceLabel,
      grainLabel: "Exact Applicant legal name on each 2012 Reveal Day Application",
      applicationDenominatorLabel: `${applicationDenominator} Applications`,
      applicantDenominatorLabel: `${applicantLegalNameDenominator} Applicant legal names`,
      limitations: [
        "2012-only view — not a 2012 vs 2026 comparison.",
        "Counts group by Applicant legal name, not resolved Organization.",
        "Affiliates and parent companies are not merged.",
        "Application concentration by Applicant legal name is not economic market share.",
        "Exact-string competition counts Applications for the same exact applied-for string — not official contention sets or memberships.",
        "Preliminary contention remains a separate historical concept and is not ranked as a peer leaderboard here.",
        "Applicant Region is the published 2012 Reveal Day Region code — not the Geographic Application designation, not a market, and not compared to 2026.",
      ],
    },
    exclusions: [
      "Community / Geographic leaderboards",
      "Preliminary contention leaderboard",
      "Historical Organization cohort as round coverage",
      "Cross-round Applicant concentration delta",
      "Cross-round exact-string / contention comparison",
      "Cross-round regional Applicant or Application deltas",
      "IDN as a primary workflow",
    ],
    hrefs: {
      commandCenter: hubPath("/"),
      crossRound: hubPath("/cross-round"),
      exploreHistorical: `${hubPath("/explore")}?dataset=2012-historical&entity=applications`,
      exploreHistoricalStrings: exploreHistorical2012StringsHref(),
      dataHealth: hubPath("/data-health"),
      exactStringSectionAnchor: `${hubPath("/historical-cohorts")}#exact-string-competition`,
      regionalSectionAnchor: `${hubPath("/historical-cohorts")}#regional-applicant-structure`,
    },
  };
}

/**
 * HIST-COHORT-2B — Applicant legal-name × Reveal Day Region aggregates.
 * Fail-closed on missing/unexpected region codes or multi-region legal names.
 * Groups by `application.applicant` + `application.region` only (never Organization).
 */
function buildRegionalApplicantStructure(args: {
  applications: readonly Application[];
  applicantLegalNameDenominator: number;
  applicationDenominator: number;
}): HistoricalCohortRegionalStructure {
  const applicationCounts = new Map<HistoricalCohortRegionCode, number>();
  const applicantRegions = new Map<string, Set<string>>();

  for (const code of HISTORICAL_COHORT_REGION_CODES) {
    applicationCounts.set(code, 0);
  }

  for (const application of args.applications) {
    const regionCode = application.region?.trim() ?? "";
    if (!regionCode || regionCode === "Unknown region") {
      throw new Error("HIST-COHORT-2B fail-closed: Application missing Region code");
    }
    if (!ACCEPTED_REGION_CODES.has(regionCode)) {
      throw new Error(
        `HIST-COHORT-2B fail-closed: unexpected Region code "${regionCode}"`,
      );
    }
    const code = regionCode as HistoricalCohortRegionCode;
    applicationCounts.set(code, (applicationCounts.get(code) ?? 0) + 1);

    const applicantLegalName = application.applicant.trim();
    if (!applicantLegalName) {
      throw new Error("HIST-COHORT-2B fail-closed: Application missing Applicant legal name");
    }
    const regions = applicantRegions.get(applicantLegalName) ?? new Set<string>();
    regions.add(code);
    applicantRegions.set(applicantLegalName, regions);
  }

  if (applicantRegions.size !== args.applicantLegalNameDenominator) {
    throw new Error(
      `HIST-COHORT-2B fail-closed: Applicant legal-name count ${applicantRegions.size} ≠ denominator ${args.applicantLegalNameDenominator}`,
    );
  }

  const applicantCounts = new Map<HistoricalCohortRegionCode, number>();
  for (const code of HISTORICAL_COHORT_REGION_CODES) {
    applicantCounts.set(code, 0);
  }

  for (const [applicantLegalName, regions] of applicantRegions) {
    if (regions.size !== 1) {
      throw new Error(
        `HIST-COHORT-2B fail-closed: Applicant legal name spans multiple regions: ${applicantLegalName} → ${[...regions].sort().join(",")}`,
      );
    }
    const code = [...regions][0] as HistoricalCohortRegionCode;
    applicantCounts.set(code, (applicantCounts.get(code) ?? 0) + 1);
  }

  const rows: HistoricalCohortRegionalRow[] = HISTORICAL_COHORT_REGION_CODES.map((regionCode) => {
    const applicantCount = applicantCounts.get(regionCode) ?? 0;
    const applicationCount = applicationCounts.get(regionCode) ?? 0;
    return {
      regionCode,
      applicantCount,
      applicantShare: share(applicantCount, args.applicantLegalNameDenominator),
      applicationCount,
      applicationShare: share(applicationCount, args.applicationDenominator),
      exploreHref: exploreHistorical2012RegionHref(regionCode),
    };
  });

  const applicantTotal = rows.reduce((sum, row) => sum + row.applicantCount, 0);
  const applicationTotal = rows.reduce((sum, row) => sum + row.applicationCount, 0);
  if (applicantTotal !== args.applicantLegalNameDenominator) {
    throw new Error(
      `HIST-COHORT-2B fail-closed: regional Applicant sum ${applicantTotal} ≠ ${args.applicantLegalNameDenominator}`,
    );
  }
  if (applicationTotal !== args.applicationDenominator) {
    throw new Error(
      `HIST-COHORT-2B fail-closed: regional Application sum ${applicationTotal} ≠ ${args.applicationDenominator}`,
    );
  }

  return {
    label: "2012 Applicant regional structure",
    productQuestion:
      "How were 2012 Applicant legal names and Applications distributed across Applicant regions?",
    regionField: "Region",
    regionCodes: HISTORICAL_COHORT_REGION_CODES,
    applicationDenominator: args.applicationDenominator,
    applicantDenominator: args.applicantLegalNameDenominator,
    rows,
    limitations: [
      "Region is the published ICANN 2012 Reveal Day Region code on each Application.",
      "Applicant Region is not the Geographic Application designation.",
      "2012-only — not a regional comparison to 2026.",
      "Counts use exact Applicant legal names; Organizations and affiliates are not merged.",
    ],
  };
}

function buildExactStringCompetitionExposure(args: {
  applications: readonly Application[];
  portfolioByLegalName: Map<string, number>;
  applicantLegalNameDenominator: number;
  applicationDenominator: number;
}): HistoricalCohortExactStringCompetition {
  const exact = buildExactAppliedStringCompetition(args.applications);
  const repeatedStringKeys = new Set(
    exact.competingGroups.map((group) => group.appliedForString),
  );

  type Acc = {
    exposed: number;
    strings: Set<string>;
  };
  const byApplicant = new Map<string, Acc>();
  let exactRepeatApplicationsAlsoInPreliminaryContention = 0;

  for (const application of args.applications) {
    const appliedForString = exactAppliedForStringKey(application);
    if (appliedForString === null || !repeatedStringKeys.has(appliedForString)) continue;
    const applicantLegalName = application.applicant.trim();
    if (!applicantLegalName) continue;
    const slot = byApplicant.get(applicantLegalName) ?? { exposed: 0, strings: new Set<string>() };
    slot.exposed += 1;
    slot.strings.add(appliedForString);
    byApplicant.set(applicantLegalName, slot);
    if (application.contentionSet) {
      exactRepeatApplicationsAlsoInPreliminaryContention += 1;
    }
  }

  const ranked = [...byApplicant.entries()]
    .map(([applicantLegalName, slot]) => {
      const portfolioApplicationCount = args.portfolioByLegalName.get(applicantLegalName) ?? 0;
      return {
        applicantLegalName,
        portfolioApplicationCount,
        applicationsInExactStringCompetition: slot.exposed,
        distinctRepeatedStrings: slot.strings.size,
        portfolioExposureShare: share(slot.exposed, portfolioApplicationCount),
        exploreHref: exploreHistorical2012ApplicantLegalNameHref(applicantLegalName),
      };
    })
    .sort(
      (a, b) =>
        b.applicationsInExactStringCompetition - a.applicationsInExactStringCompetition ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    )
    .slice(0, HISTORICAL_COHORT_EXACT_STRING_EXPOSURE_LIMIT)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    label: "Exact-string competition",
    productQuestion: "How exposed were 2012 Applicant portfolios to exact-string competition?",
    method: EXACT_APPLIED_STRING_COMPETITION_METHOD,
    grain: EXACT_APPLIED_STRING_COMPETITION_GRAIN,
    applicantsExposed: byApplicant.size,
    applicationsExposed: exact.applicationsInCompetingGroups,
    repeatedStringCount: exact.competingGroupCount,
    applicantShare: share(byApplicant.size, args.applicantLegalNameDenominator),
    applicationShare: share(exact.applicationsInCompetingGroups, args.applicationDenominator),
    exactRepeatApplicationsAlsoInPreliminaryContention,
    ranked,
    limitations: [
      "Exact-string competition means Applications for the same exact applied-for string.",
      "These groups are not official contention sets, and Applications in them are not official contention memberships.",
      "Most exact-repeat Applications also appeared in preliminary contention data, but RIH keeps the two historical concepts separate.",
      "2012-only — not compared to 2026 official initial contention.",
    ],
  };
}

/** Format a 0–1 share for UI (two decimal places, e.g. 83.54%). */
export function formatCohortSharePercent(shareValue: number): string {
  return `${(shareValue * 100).toFixed(2)}%`;
}
