/**
 * HIST-COHORT-1 — 2012 Applicant portfolio structure (2012-only).
 *
 * Grain: exact Applicant legal name on the committed Reveal Day fixture.
 * No Organization merge, no affiliate inference, no cross-round deltas.
 */

import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  APPLICANT_LEGAL_NAME_CONCENTRATION_METHOD,
  buildApplicantLegalNameConcentration,
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
    dataHealth: string;
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
        "Exact-string competition and preliminary contention cohorts are deferred.",
      ],
    },
    exclusions: [
      "Community / Geographic leaderboards",
      "Exact-repeat competition leaderboard",
      "Preliminary contention leaderboard",
      "Historical Organization cohort as round coverage",
      "Cross-round Applicant concentration delta",
      "IDN as a primary workflow",
    ],
    hrefs: {
      commandCenter: hubPath("/"),
      crossRound: hubPath("/cross-round"),
      exploreHistorical: `${hubPath("/explore")}?dataset=2012-historical&entity=applications`,
      dataHealth: hubPath("/data-health"),
    },
  };
}

/** Format a 0–1 share for UI (two decimal places, e.g. 83.54%). */
export function formatCohortSharePercent(shareValue: number): string {
  return `${(shareValue * 100).toFixed(2)}%`;
}
