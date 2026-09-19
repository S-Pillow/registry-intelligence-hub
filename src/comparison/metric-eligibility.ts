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

export function requireMetricEligibility(metricId: string): MetricEligibilityEntry {
  const entry = getMetricEligibility(metricId);
  if (!entry) throw new Error(`Unknown metric eligibility id: ${metricId}`);
  return entry;
}

export function assertMetricComparable(metricId: string): void {
  const entry = getMetricEligibility(metricId);
  if (!entry) throw new Error(`Unknown metric: ${metricId}`);
  if (!isReadinessComparable(entry.readiness)) {
    throw new Error(`Metric ${metricId} is not COMPARABLE (readiness=${entry.readiness})`);
  }
}

export function compareDimensionAllowsComparableValue(compareDimensionId: string): boolean {
  const entry = getCompareDimensionEligibility(compareDimensionId);
  if (!entry) return true;
  return isReadinessComparable(entry.readiness);
}

export function readinessBlocksComparablePresentation(readiness: MetricReadiness): boolean {
  return readiness !== "COMPARABLE" && readiness !== "PARTIAL";
}
