import type { EntityType } from "@/lib/registry-data";
import { getCompareDimensionEligibility, getMetricEligibility } from "./metric-eligibility";
import type { MetricReadiness } from "./readiness";
import { isReadinessComparable } from "./readiness";

export type CompareCellEligibility = {
  value: unknown;
  state?: "unavailable" | "not-comparable";
  readiness: MetricReadiness;
  source: string;
  method: string;
};

export type CompareRowEligibility = {
  label: string;
  metricId: string;
  readiness: MetricReadiness;
  cells: CompareCellEligibility[];
};

function eligibilityForMetric(metricId: string) {
  const entry = getMetricEligibility(metricId);
  if (!entry) {
    return {
      readiness: "BLOCKED_METHOD" as MetricReadiness,
      source: "unknown",
      method: "unknown",
    };
  }
  return {
    readiness: entry.readiness,
    source: entry.source2012,
    method: entry.method,
  };
}

export function participationStatusCellForOrganization(returningFlag: boolean): CompareCellEligibility {
  const entry = getCompareDimensionEligibility("participation-status-identity")
    ?? getMetricEligibility("returning-participant-identity");
  const meta = entry
    ? { readiness: entry.readiness, source: entry.source2012, method: entry.method }
    : eligibilityForMetric("returning-participant-identity");

  if (meta.readiness === "BLOCKED_SOURCE") {
    return {
      value: "Not available — post-Reveal source not ingested",
      state: "unavailable",
      ...meta,
    };
  }

  if (!isReadinessComparable(meta.readiness) && meta.readiness !== "PARTIAL") {
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
    readiness: meta.readiness,
    source: meta.source,
    method: "cross-round-identity/1.0.0",
  };
}

export function marketDemandCells(entityCount: number): CompareCellEligibility[] {
  const entry = getMetricEligibility("historical-market-demand")!;
  return Array.from({ length: entityCount }, () => ({
    value: "Not available — source not approved",
    state: "unavailable",
    readiness: entry.readiness,
    source: entry.source2012,
    method: entry.method,
  }));
}

export function assertCompareRowNotPresentingBlockedAsComparable(row: CompareRowEligibility): void {
  for (const cell of row.cells) {
    if (cell.state) continue;
    if (!isReadinessComparable(cell.readiness) && cell.readiness !== "PARTIAL") {
      throw new Error(`Compare row ${row.label} presents blocked metric ${row.metricId} as comparable`);
    }
  }
}

export function categoryMixRowBlocked(entityType: EntityType): boolean {
  if (entityType === "categories") return true;
  const entry = getMetricEligibility("category-mix");
  return entry ? !isReadinessComparable(entry.readiness) : true;
}
