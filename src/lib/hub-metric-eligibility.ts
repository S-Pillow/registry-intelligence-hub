import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  resolveMetricEligibilityWithActuality,
  type ClaimActualityState,
  type ContentionActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { isReadinessComparable } from "@/comparison/readiness";
import { getCompareDimensionEligibility } from "@/comparison/metric-eligibility-catalog";

export type { ClaimActualityState, ContentionActualityState };

export { DEFAULT_CLAIM_ACTUALITY_STATE, DEFAULT_CONTENTION_ACTUALITY_STATE };

/** Browser-facing choke point: catalog eligibility resolved with deployment claim actuality. */
export function resolveHubMetricEligibility(
  metricId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActualityState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
) {
  return resolveMetricEligibilityWithActuality(metricId, claimActualityState, contentionActualityState);
}

export function requireHubMetricEligibility(
  metricId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActualityState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
) {
  const entry = resolveHubMetricEligibility(metricId, claimActualityState, contentionActualityState);
  if (!entry) throw new Error(`Unknown metric eligibility id: ${metricId}`);
  return entry;
}

export function hubCrossRoundComparisonAllowed(
  metricId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActualityState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
): boolean {
  return resolveHubMetricEligibility(metricId, claimActualityState, contentionActualityState)?.comparisonAllowed
    ?? false;
}

export function assertHubCrossRoundDeltaAllowed(
  metricId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActualityState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
): void {
  const entry = requireHubMetricEligibility(metricId, claimActualityState, contentionActualityState);
  if (!entry.comparisonAllowed) {
    throw new Error(
      `Cross-round delta blocked for ${metricId} (method=${entry.methodReadiness}, 2012=${entry.claimReadiness.round2012}, 2026=${entry.claimReadiness.round2026})`,
    );
  }
}

export function hubCompareDimensionAllowsComparableValue(
  compareDimensionId: string,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActualityState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
): boolean {
  const dimension = getCompareDimensionEligibility(compareDimensionId);
  if (!dimension) return true;
  return resolveHubMetricEligibility(dimension.metricId, claimActualityState, contentionActualityState)
    ?.comparisonAllowed ?? false;
}

export function hubReadinessBlocksComparablePresentation(methodReadiness: string): boolean {
  return methodReadiness !== "COMPARABLE" && methodReadiness !== "PARTIAL";
}

export { isReadinessComparable };
