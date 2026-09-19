import { METRIC_ELIGIBILITY_CATALOG_VERSION, resolveMetricEligibility } from "./metric-eligibility";

/** Hard consumption path — Explore must not invent comparison gates locally. */
export const EXPLORE_ELIGIBILITY_CATALOG_VERSION = METRIC_ELIGIBILITY_CATALOG_VERSION;

export type ExploreHistoricalIntelligencePolicy = {
  catalogVersion: string;
  /** Metrics that may surface 2012 historical context in Explore (still subject to UI gates). */
  historicalMetricIds: string[];
  /** True when every catalog entry denies real 2026 identity claims. */
  allMetricsDenyReal2026Identity: boolean;
};

const EXPLORE_HISTORICAL_METRIC_IDS = [
  "returning-participant-identity",
  "application-count",
  "unique-applied-strings",
  "idn-applications",
] as const;

export function getExploreHistoricalIntelligencePolicy(): ExploreHistoricalIntelligencePolicy {
  const resolved = EXPLORE_HISTORICAL_METRIC_IDS.map((id) => resolveMetricEligibility(id)!);
  return {
    catalogVersion: EXPLORE_ELIGIBILITY_CATALOG_VERSION,
    historicalMetricIds: [...EXPLORE_HISTORICAL_METRIC_IDS],
    allMetricsDenyReal2026Identity: resolved.every((entry) => entry.claimsReal2026Identity === false),
  };
}

export function exploreCrossRoundComparisonAllowed(metricId: string): boolean {
  return resolveMetricEligibility(metricId)?.comparisonAllowed ?? false;
}

/** User-facing disclosure for Explore when rehearsal browsing is allowed but cross-round compare is gated. */
export function exploreHistoricalComparisonDisclosure(): string {
  const policy = getExploreHistoricalIntelligencePolicy();
  const identity = resolveMetricEligibility("returning-participant-identity");
  return `Historical intelligence follows ${policy.catalogVersion}. Rehearsal entity browsing only; cross-round comparison withheld while 2026 remains ${identity?.claimReadiness.round2026 ?? "NOT_PUBLISHED"}.`;
}
