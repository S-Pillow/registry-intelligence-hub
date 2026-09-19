import { METRIC_ELIGIBILITY_CATALOG } from "../comparison/metric-eligibility-catalog";
import type { ClaimActualityState } from "./claim-actuality";
import {
  APPLICATION_ACTUALITY_METRIC_IDS,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  resolveMetricEligibilityWithActuality,
} from "./claim-actuality";
import { CROSS_ROUND_IDENTITY_METHOD, ORGANIZATION_RESOLUTION_METHOD } from "./types";

export type MetricUnlockRow = {
  metricId: string;
  label: string;
  catalogRound2026: string;
  effectiveRound2026: string;
  methodReadiness: string;
  comparisonAllowed: boolean;
  unlockStatus: "newly-eligible" | "still-gated" | "unchanged-eligible";
  gateReason?: string;
};

export type ComparisonUnlockReport = {
  reportVersion: "comparison-unlock-report/1.0.0";
  generatedAt: string;
  round2026ApplicationActuality: ClaimActualityState["round2026ApplicationActuality"];
  applicationActualityMetricIds: readonly string[];
  organizationResolutionMethod: string;
  crossRoundIdentityMethod: string;
  strictRule:
    "Real 2026 application publication does not imply real 2026 organization intelligence";
  metrics: MetricUnlockRow[];
  summary: {
    newlyUnlockedComparisonCount: number;
    stillGatedCount: number;
  };
};

function gateReasonFor(metricId: string, state: ClaimActualityState): string | undefined {
  const entry = METRIC_ELIGIBILITY_CATALOG.find((e) => e.metricId === metricId);
  if (!entry) return "Unknown metric";
  const resolved = resolveMetricEligibilityWithActuality(metricId, state);
  if (!resolved) return "Unknown metric";

  if (resolved.comparisonAllowed) return undefined;

  if (resolved.methodReadiness !== "COMPARABLE") {
    return `Method ${resolved.methodReadiness}`;
  }
  if (resolved.claimReadiness.round2026 !== "REAL_SOURCE_READY") {
    if ((APPLICATION_ACTUALITY_METRIC_IDS as readonly string[]).includes(metricId)) {
      return "Awaiting 2026 application actuality promotion";
    }
    if (metricId.includes("organization") || metricId.includes("portfolio")) {
      return `Requires ${ORGANIZATION_RESOLUTION_METHOD} steward promotion — not auto-promoted`;
    }
    if (metricId === "returning-participant-identity") {
      return `Requires ${ORGANIZATION_RESOLUTION_METHOD} + ${CROSS_ROUND_IDENTITY_METHOD} steward links`;
    }
    return `2026 claim readiness ${resolved.claimReadiness.round2026}`;
  }
  return "2012 or method gate";
}

export function buildComparisonUnlockReport(
  state: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): ComparisonUnlockReport {
  const before = DEFAULT_CLAIM_ACTUALITY_STATE;
  const metrics: MetricUnlockRow[] = METRIC_ELIGIBILITY_CATALOG.map((entry) => {
    const beforeResolved = resolveMetricEligibilityWithActuality(entry.metricId, before)!;
    const afterResolved = resolveMetricEligibilityWithActuality(entry.metricId, state)!;
    let unlockStatus: MetricUnlockRow["unlockStatus"] = "still-gated";
    if (afterResolved.comparisonAllowed && !beforeResolved.comparisonAllowed) {
      unlockStatus = "newly-eligible";
    } else if (afterResolved.comparisonAllowed && beforeResolved.comparisonAllowed) {
      unlockStatus = "unchanged-eligible";
    }
    return {
      metricId: entry.metricId,
      label: entry.label,
      catalogRound2026: entry.claimReadiness.round2026,
      effectiveRound2026: afterResolved.claimReadiness.round2026,
      methodReadiness: entry.methodReadiness,
      comparisonAllowed: afterResolved.comparisonAllowed,
      unlockStatus,
      gateReason: afterResolved.comparisonAllowed ? undefined : gateReasonFor(entry.metricId, state),
    };
  });

  return {
    reportVersion: "comparison-unlock-report/1.0.0",
    generatedAt: new Date().toISOString(),
    round2026ApplicationActuality: state.round2026ApplicationActuality,
    applicationActualityMetricIds: APPLICATION_ACTUALITY_METRIC_IDS,
    organizationResolutionMethod: ORGANIZATION_RESOLUTION_METHOD,
    crossRoundIdentityMethod: CROSS_ROUND_IDENTITY_METHOD,
    strictRule:
      "Real 2026 application publication does not imply real 2026 organization intelligence",
    metrics,
    summary: {
      newlyUnlockedComparisonCount: metrics.filter((m) => m.unlockStatus === "newly-eligible").length,
      stillGatedCount: metrics.filter((m) => !m.comparisonAllowed).length,
    },
  };
}
