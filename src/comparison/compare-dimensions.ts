import type { EntityType } from "@/lib/registry-data";
import type { ClaimReadiness } from "./claim-readiness";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
  resolveHubMetricEligibility,
} from "@/lib/hub-metric-eligibility";
import { getCompareDimensionEligibility, getMetricEligibility } from "./metric-eligibility";
import type { MetricReadiness } from "./readiness";
import { isReadinessComparable } from "./readiness";

export type CompareCellEligibility = {
  value: unknown;
  state?: "unavailable" | "not-comparable";
  methodReadiness: MetricReadiness;
  claimReadiness2012: ClaimReadiness;
  claimReadiness2026: ClaimReadiness;
  comparisonAllowed: boolean;
  source: string;
  method: string;
};

export type CompareRowEligibility = {
  label: string;
  metricId: string;
  methodReadiness: MetricReadiness;
  cells: CompareCellEligibility[];
};

function eligibilityForMetric(metricId: string, claimActualityState: ClaimActualityState) {
  const entry = resolveHubMetricEligibility(metricId, claimActualityState);
  if (!entry) {
    return {
      methodReadiness: "BLOCKED_METHOD" as MetricReadiness,
      claimReadiness2012: "HISTORICAL_ONLY" as ClaimReadiness,
      claimReadiness2026: "NOT_PUBLISHED" as ClaimReadiness,
      comparisonAllowed: false,
      source: "unknown",
      method: "unknown",
    };
  }
  return {
    methodReadiness: entry.methodReadiness,
    claimReadiness2012: entry.claimReadiness.round2012,
    claimReadiness2026: entry.claimReadiness.round2026,
    comparisonAllowed: entry.comparisonAllowed,
    source: entry.source2012,
    method: entry.method,
  };
}

export function participationStatusCellForApplication(
  returningFlag: boolean,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): CompareCellEligibility {
  const meta = eligibilityForMetric("returning-participant-identity", claimActualityState);
  return {
    value: returningFlag
      ? "Fixture flags returning (outcome not verified)"
      : "New (fixture)",
    state: "not-comparable",
    ...meta,
    method: "cross-round-identity/1.0.0",
  };
}

export function participationStatusCellForOrganization(
  returningFlag: boolean,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): CompareCellEligibility {
  const entry = getCompareDimensionEligibility("participation-status-identity")
    ?? getMetricEligibility("returning-participant-identity");
  const resolved = entry ? resolveHubMetricEligibility(entry.metricId, claimActualityState) : undefined;
  const meta = resolved
    ? {
        methodReadiness: resolved.methodReadiness,
        claimReadiness2012: resolved.claimReadiness.round2012,
        claimReadiness2026: resolved.claimReadiness.round2026,
        comparisonAllowed: resolved.comparisonAllowed,
        source: resolved.source2012,
        method: resolved.method,
      }
    : eligibilityForMetric("returning-participant-identity", claimActualityState);

  if (meta.methodReadiness === "BLOCKED_SOURCE") {
    return {
      value: "Not available — post-Reveal source not ingested",
      state: "unavailable",
      ...meta,
    };
  }

  if (!isReadinessComparable(meta.methodReadiness) && meta.methodReadiness !== "PARTIAL") {
    return {
      value: "Not comparable — comparison gate",
      state: "not-comparable",
      ...meta,
    };
  }

  /** Fixture `returning` implies outcome — show as not-comparable under identity-only policy. */
  return {
    value: returningFlag ? "Fixture flags returning (outcome not verified)" : "New (fixture)",
    state: "not-comparable",
    methodReadiness: meta.methodReadiness,
    claimReadiness2012: meta.claimReadiness2012,
    claimReadiness2026: meta.claimReadiness2026,
    comparisonAllowed: meta.comparisonAllowed,
    source: meta.source,
    method: "cross-round-identity/1.0.0",
  };
}

export function marketDemandCells(
  entityCount: number,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): CompareCellEligibility[] {
  const entry = resolveHubMetricEligibility("historical-market-demand", claimActualityState)!;
  return Array.from({ length: entityCount }, () => ({
    value: "Not available — source not approved",
    state: "unavailable",
    methodReadiness: entry.methodReadiness,
    claimReadiness2012: entry.claimReadiness.round2012,
    claimReadiness2026: entry.claimReadiness.round2026,
    comparisonAllowed: entry.comparisonAllowed,
    source: entry.source2012,
    method: entry.method,
  }));
}

export function assertCompareRowNotPresentingBlockedAsComparable(row: CompareRowEligibility): void {
  for (const cell of row.cells) {
    if (cell.state) continue;
    if (!isReadinessComparable(cell.methodReadiness) && cell.methodReadiness !== "PARTIAL") {
      throw new Error(`Compare row ${row.label} presents blocked metric ${row.metricId} as comparable`);
    }
  }
}

export function categoryMixRowBlocked(entityType: EntityType): boolean {
  if (entityType === "categories") return true;
  const entry = getMetricEligibility("category-mix");
  return entry ? !isReadinessComparable(entry.methodReadiness) : true;
}
