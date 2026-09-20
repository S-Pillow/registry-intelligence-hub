import type { Application } from "@/lib/registry-data";
import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";
import type { ClaimReadiness } from "./claim-readiness";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
  requireHubMetricEligibility,
  hubReadinessBlocksComparablePresentation,
} from "@/lib/hub-metric-eligibility";
import type { ResolvedMetricEligibility } from "./metric-eligibility";
import { getMetricEligibility } from "./metric-eligibility";
import type { MetricDisplayTier, MetricReadiness } from "./readiness";
import { isReadinessComparable } from "./readiness";

export const HISTORICAL_2012_UI_ADAPTER_VERSION = "historical-2012-ui-adapter/1.0.0";

export const APPROVED_2012_HISTORICAL_ROUND_ID = "2012-reveal-day";
export const REHEARSAL_2026_ROUND_ID = "2026-rehearsal";

export type HistoricalMetricFact = {
  metricId: string;
  value: number;
  roundId: typeof APPROVED_2012_HISTORICAL_ROUND_ID;
  effectiveDate: string;
  sourceClassification: "ICANN_PRIMARY_ARCHIVED_COPY";
  sourceSnapshotId: string;
  methodVersion: string;
  methodReadiness: MetricReadiness;
  claimReadiness: ClaimReadiness;
  comparisonAllowed: boolean;
  limitations: string[];
  label: string;
};

export type PresentedHistoricalMetric = {
  id: string;
  metricId: string;
  label: string;
  value: number;
  historicalFact?: HistoricalMetricFact;
  baseline2012: number | null;
  deltaLabel: string | null;
  methodReadiness: MetricReadiness;
  claimReadiness2012: ClaimReadiness;
  claimReadiness2026: ClaimReadiness;
  comparisonAllowed: boolean;
  displayTier: MetricDisplayTier;
  source: string;
  method: string;
  filter: string;
};

export type GlanceMetric = HistoricalMetricFact;

const APPROVED_UI_SWAP_METRIC_IDS = ["application-count", "unique-applied-strings", "idn-applications"] as const;

const HISTORICAL_LIMITATIONS = [
  "2026 round not published — cross-round comparison withheld.",
  "Rehearsal fixture values must not be presented as an official 2026 comparison.",
] as const;

function displayTierFor(methodReadiness: MetricReadiness, comparisonAllowed: boolean): MetricDisplayTier {
  if (methodReadiness === "COMPARABLE" && comparisonAllowed) return "production-ready";
  if (methodReadiness === "COMPARABLE" || methodReadiness === "PARTIAL") return "comparison-pending";
  if (methodReadiness === "BLOCKED_COVERAGE" || methodReadiness === "BLOCKED_METHOD") return "comparison-pending";
  return "unavailable";
}

function baselineValueForMetric(metricId: (typeof APPROVED_UI_SWAP_METRIC_IDS)[number]): number {
  if (metricId === "application-count") return APPROVED_2012_BASELINE.applications;
  if (metricId === "unique-applied-strings") return APPROVED_2012_BASELINE.uniqueStrings;
  return APPROVED_2012_BASELINE.idnApplications;
}

export function buildApproved2012HistoricalFact(
  metricId: (typeof APPROVED_UI_SWAP_METRIC_IDS)[number],
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): HistoricalMetricFact {
  const entry = requireHubMetricEligibility(metricId, claimActualityState);
  return {
    metricId,
    value: baselineValueForMetric(metricId),
    roundId: APPROVED_2012_HISTORICAL_ROUND_ID,
    effectiveDate: APPROVED_2012_BASELINE.baselineAt,
    sourceClassification: "ICANN_PRIMARY_ARCHIVED_COPY",
    sourceSnapshotId: "snap-2012-reveal-day-csv-v1",
    methodVersion: APPROVED_2012_BASELINE.parserVersion,
    methodReadiness: entry.methodReadiness,
    claimReadiness: entry.claimReadiness.round2012,
    comparisonAllowed: entry.comparisonAllowed,
    limitations: [...HISTORICAL_LIMITATIONS],
    label: entry.label,
  };
}

export function buildApproved2012HistoricalFacts(
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): HistoricalMetricFact[] {
  return APPROVED_UI_SWAP_METRIC_IDS.map((metricId) => buildApproved2012HistoricalFact(metricId, claimActualityState));
}

function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

function pulseMeta(entry: ResolvedMetricEligibility) {
  return {
    methodReadiness: entry.methodReadiness,
    claimReadiness2012: entry.claimReadiness.round2012,
    claimReadiness2026: entry.claimReadiness.round2026,
    comparisonAllowed: entry.comparisonAllowed,
    displayTier: displayTierFor(entry.methodReadiness, entry.comparisonAllowed),
    source: entry.source2012,
    method: entry.method,
  };
}

function historicalStatusLine(entry: ResolvedMetricEligibility): string {
  if (entry.comparisonAllowed) {
    return "Historical baseline — 2012 Reveal Day; cross-round comparison enabled for approved application counts.";
  }
  return "Historical baseline — 2012 Reveal Day (ICANN source, archived-copy preservation). 2026 comparison pending publication.";
}

function rehearsalDeltaBlocked(): string {
  return "Rehearsal fixture shown for UX only — not an approved 2026 comparison.";
}

/**
 * Incremental Command Center round pulse: approved 2012 historical facts for the three count metrics;
 * remaining cards stay on rehearsal fixture with explicit gates.
 */
export function buildCommandCenterRoundPulse(
  applications: Application[],
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): PresentedHistoricalMetric[] {
  const baseline = APPROVED_2012_BASELINE;
  const applicationEntry = requireHubMetricEligibility("application-count", claimActualityState);
  const stringsEntry = requireHubMetricEligibility("unique-applied-strings", claimActualityState);
  const orgEntry = requireHubMetricEligibility("organization-round-count", claimActualityState);
  const regionsEntry = requireHubMetricEligibility("distinct-regions", claimActualityState);
  const idnEntry = requireHubMetricEligibility("idn-applications", claimActualityState);
  const contentionEntry = requireHubMetricEligibility("contention-set-count", claimActualityState);

  const appFact = buildApproved2012HistoricalFact("application-count", claimActualityState);
  const stringsFact = buildApproved2012HistoricalFact("unique-applied-strings", claimActualityState);
  const idnFact = buildApproved2012HistoricalFact("idn-applications", claimActualityState);

  return [
    {
      id: "applications",
      metricId: "application-count",
      label: "Applications",
      value: appFact.value,
      historicalFact: appFact,
      baseline2012: baseline.applications,
      deltaLabel: historicalStatusLine(applicationEntry),
      ...pulseMeta(applicationEntry),
      filter: "all",
    },
    {
      id: "strings",
      metricId: "unique-applied-strings",
      label: "Unique strings",
      value: stringsFact.value,
      historicalFact: stringsFact,
      baseline2012: baseline.uniqueStrings,
      deltaLabel: historicalStatusLine(stringsEntry),
      ...pulseMeta(stringsEntry),
      filter: "strings",
    },
    {
      id: "organizations",
      metricId: "organization-round-count",
      label: "Organizations",
      value: uniqueCount(applications.map((item) => item.organization)),
      baseline2012: null,
      deltaLabel: "Round-wide organization comparison not approved",
      ...pulseMeta(orgEntry),
      filter: "organizations",
    },
    {
      id: "regions",
      metricId: "distinct-regions",
      label: "Regions",
      value: uniqueCount(applications.map((item) => item.region)),
      baseline2012: baseline.distinctRegions,
      deltaLabel: `${uniqueCount(applications.map((item) => item.country))} countries · 2012 had ${baseline.distinctCountries} countries · ${rehearsalDeltaBlocked()}`,
      ...pulseMeta(regionsEntry),
      filter: "regions",
    },
    {
      id: "idn",
      metricId: "idn-applications",
      label: "IDN applications",
      value: idnFact.value,
      historicalFact: idnFact,
      baseline2012: baseline.idnApplications,
      deltaLabel: historicalStatusLine(idnEntry),
      ...pulseMeta(idnEntry),
      filter: "idn",
    },
    {
      id: "contention",
      metricId: "contention-set-count",
      label: "Initial contention sets",
      value: uniqueCount(applications.flatMap((item) => (item.contentionSet ? [item.contentionSet] : []))),
      baseline2012: null,
      deltaLabel: "Set-entity count blocked — membership exposure only",
      ...pulseMeta(contentionEntry),
      filter: "contention",
    },
  ];
}

/** Approved 2012 facts for side-by-side glance — structured facts only, no rehearsal comparison. */
export function buildRevealDayGlanceMetrics(
  _applications: Application[],
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): GlanceMetric[] {
  return buildApproved2012HistoricalFacts(claimActualityState);
}

export function isMetricGatedForUi(metricId: string): boolean {
  const entry = getMetricEligibility(metricId);
  if (!entry) return true;
  return readinessBlocksComparablePresentation(entry.methodReadiness);
}

function readinessBlocksComparablePresentation(methodReadiness: MetricReadiness): boolean {
  return hubReadinessBlocksComparablePresentation(methodReadiness);
}

export function approved2012ContentionMembershipNote(): string {
  return `${APPROVED_2012_BASELINE.contentionMembershipApplications} applications in official PDF membership (2012); set-entity headline counts remain blocked.`;
}

export { isReadinessComparable };
