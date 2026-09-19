/** Machine-readable comparison readiness — consumed by Command Center, Compare, and Briefings. */
export type MetricReadiness =
  | "COMPARABLE"
  | "PARTIAL"
  | "BLOCKED_METHOD"
  | "BLOCKED_COVERAGE"
  | "BLOCKED_SOURCE"
  | "NOT_APPLICABLE";

export type MetricDisplayTier =
  | "production-ready"
  | "comparison-pending"
  | "fixture"
  | "unavailable";

export function isReadinessComparable(readiness: MetricReadiness): boolean {
  return readiness === "COMPARABLE";
}

export function isReadinessShowable(readiness: MetricReadiness): boolean {
  return readiness !== "NOT_APPLICABLE";
}
