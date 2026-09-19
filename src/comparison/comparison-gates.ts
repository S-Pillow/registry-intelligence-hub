import type { ClaimReadiness } from "./claim-readiness";
import type { MetricReadiness } from "./readiness";

/** Cross-round delta allowed only when method is COMPARABLE and both rounds are REAL_SOURCE_READY. */
export function isCrossRoundComparisonAllowed(
  methodReadiness: MetricReadiness,
  claim2012: ClaimReadiness,
  claim2026: ClaimReadiness,
): boolean {
  return (
    methodReadiness === "COMPARABLE"
    && claim2012 === "REAL_SOURCE_READY"
    && claim2026 === "REAL_SOURCE_READY"
  );
}
