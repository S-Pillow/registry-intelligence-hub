import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
  resolveHubMetricEligibility,
} from "@/lib/hub-metric-eligibility";
import { METRIC_ELIGIBILITY_CATALOG_VERSION } from "./metric-eligibility";

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

export function getExploreHistoricalIntelligencePolicy(
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): ExploreHistoricalIntelligencePolicy {
  const resolved = EXPLORE_HISTORICAL_METRIC_IDS.map((id) => resolveHubMetricEligibility(id, claimActualityState)!);
  return {
    catalogVersion: EXPLORE_ELIGIBILITY_CATALOG_VERSION,
    historicalMetricIds: [...EXPLORE_HISTORICAL_METRIC_IDS],
    allMetricsDenyReal2026Identity: resolved.every((entry) => entry.claimsReal2026Identity === false),
  };
}

export function exploreCrossRoundComparisonAllowed(
  metricId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): boolean {
  return resolveHubMetricEligibility(metricId, claimActualityState)?.comparisonAllowed ?? false;
}

/** User-facing disclosure for Explore when rehearsal browsing is allowed but cross-round compare is gated. */
export function exploreHistoricalComparisonDisclosure(
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): string {
  const policy = getExploreHistoricalIntelligencePolicy(claimActualityState);
  const identity = resolveHubMetricEligibility("returning-participant-identity", claimActualityState);
  return `Historical intelligence follows ${policy.catalogVersion}. Rehearsal entity browsing only; cross-round comparison withheld while 2026 remains ${identity?.claimReadiness.round2026 ?? "NOT_PUBLISHED"}.`;
}
