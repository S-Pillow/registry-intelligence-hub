import { isCrossRoundComparisonAllowed } from "./comparison-gates";
import {
  getCompareDimensionEligibility,
  getMetricEligibility,
  METRIC_ELIGIBILITY_CATALOG,
  METRIC_ELIGIBILITY_CATALOG_VERSION,
  type MetricEligibilityEntry,
} from "./metric-eligibility-catalog";
import { isReadinessComparable, type MetricReadiness } from "./readiness";

export {
  METRIC_ELIGIBILITY_CATALOG,
  METRIC_ELIGIBILITY_CATALOG_VERSION,
  getMetricEligibility,
  getCompareDimensionEligibility,
  type MetricEligibilityEntry,
};

export type ResolvedMetricEligibility = MetricEligibilityEntry & { comparisonAllowed: boolean };

export function resolveMetricEligibility(metricId: string): ResolvedMetricEligibility | undefined {
  const entry = getMetricEligibility(metricId);
  if (!entry) return undefined;
  return {
    ...entry,
    comparisonAllowed: isCrossRoundComparisonAllowed(
      entry.methodReadiness,
      entry.claimReadiness.round2012,
      entry.claimReadiness.round2026,
    ),
  };
}

export function requireMetricEligibility(metricId: string): ResolvedMetricEligibility {
  const entry = resolveMetricEligibility(metricId);
  if (!entry) throw new Error(`Unknown metric eligibility id: ${metricId}`);
  return entry;
}

export function assertMetricComparable(metricId: string): void {
  const entry = requireMetricEligibility(metricId);
  if (!isReadinessComparable(entry.methodReadiness)) {
    throw new Error(`Metric ${metricId} is not COMPARABLE (methodReadiness=${entry.methodReadiness})`);
  }
}

export function assertCrossRoundDeltaAllowed(metricId: string): void {
  const entry = requireMetricEligibility(metricId);
  if (!entry.comparisonAllowed) {
    throw new Error(
      `Cross-round delta blocked for ${metricId} (method=${entry.methodReadiness}, 2012=${entry.claimReadiness.round2012}, 2026=${entry.claimReadiness.round2026})`,
    );
  }
}

export function compareDimensionAllowsComparableValue(compareDimensionId: string): boolean {
  const dimension = getCompareDimensionEligibility(compareDimensionId);
  if (!dimension) return true;
  return resolveMetricEligibility(dimension.metricId)?.comparisonAllowed ?? false;
}

export function readinessBlocksComparablePresentation(methodReadiness: MetricReadiness): boolean {
  return methodReadiness !== "COMPARABLE" && methodReadiness !== "PARTIAL";
}
