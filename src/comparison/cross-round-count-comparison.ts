import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
  resolveHubMetricEligibility,
} from "@/lib/hub-metric-eligibility";

/**
 * Cross-round count presentation for the three metrics the eligibility contract
 * can unlock (`application-count`, `unique-applied-strings`, `idn-applications`).
 *
 * Grain, matching the approved 2012 Reveal Day baseline and 2026 normalize:
 * - application count is a publication row count, not a later withdrawn or proceeding subset
 * - unique strings are distinct `string` / `stringUlabel` values, including empty string, with no trim or case fold
 * - IDN is an application-flag count, not a distinct-string count
 * Replacement, aLabel, contention-set id, and applicant are not keys.
 *
 * A numeric difference is emitted only when comparison is allowed and the active
 * payload mode is the promoted snapshot. A missing field is unavailable, not zero.
 * No percentage: the count strip has no percentage pattern.
 */
export const CROSS_ROUND_COUNT_METRIC_IDS = [
  "application-count",
  "unique-applied-strings",
  "idn-applications",
] as const;

export type CrossRoundCountMetricId = (typeof CROSS_ROUND_COUNT_METRIC_IDS)[number];

export type CrossRoundPayloadMode = "rehearsal" | "promoted-2026";

export type CountableApplicationRow = {
  string?: unknown;
  idn?: unknown;
};

export type CrossRoundCountPresentation = {
  metricId: CrossRoundCountMetricId;
  numericDelta: boolean;
  baseline2012: number;
  active2026: number | null;
  difference: number | null;
  statement: string;
  provenanceLine: string;
};

const HISTORICAL_REVEAL_SNAPSHOT = "snap-2012-reveal-day-csv-v1";

export function baseline2012ForCountMetric(metricId: CrossRoundCountMetricId): number {
  if (metricId === "application-count") return APPROVED_2012_BASELINE.applications;
  if (metricId === "unique-applied-strings") return APPROVED_2012_BASELINE.uniqueStrings;
  return APPROVED_2012_BASELINE.idnApplications;
}

/** Publication row count. A missing list is unavailable. An empty list is zero. */
export function countActiveApplications(applications: readonly CountableApplicationRow[] | null | undefined): number | null {
  if (!Array.isArray(applications)) return null;
  return applications.length;
}

/**
 * Distinct applied-for strings. Same grain as 2012 `groupHistorical2012ApplicationsByString`:
 * exact `string` equality, empty string included, no trim, no case fold, no aLabel, no replacement.
 * Any row without a string field makes the count unavailable.
 */
export function countDistinctAppliedForStrings(applications: readonly CountableApplicationRow[] | null | undefined): number | null {
  if (!Array.isArray(applications)) return null;
  const keys = new Set<string>();
  for (const row of applications) {
    if (typeof row?.string !== "string") return null;
    keys.add(row.string);
  }
  return keys.size;
}

/** Application-level IDN flag. A non-boolean `idn` makes the count unavailable. */
export function countIdnApplications(applications: readonly CountableApplicationRow[] | null | undefined): number | null {
  if (!Array.isArray(applications)) return null;
  let count = 0;
  for (const row of applications) {
    if (typeof row?.idn !== "boolean") return null;
    if (row.idn) count += 1;
  }
  return count;
}

export function countActiveForMetric(
  metricId: CrossRoundCountMetricId,
  applications: readonly CountableApplicationRow[] | null | undefined,
): number | null {
  if (metricId === "application-count") return countActiveApplications(applications);
  if (metricId === "unique-applied-strings") return countDistinctAppliedForStrings(applications);
  return countIdnApplications(applications);
}

export function formatCrossRoundCountStatement(baseline2012: number, active2026: number): string {
  const difference = active2026 - baseline2012;
  return `2012 baseline ${baseline2012}. Loaded snapshot ${active2026}. Difference ${difference}.`;
}

export function presentPromotedCrossRoundCount(
  metricId: CrossRoundCountMetricId,
  applications: readonly CountableApplicationRow[] | null | undefined,
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  payload: { payloadMode?: CrossRoundPayloadMode; snapshotId?: string | null } = {},
): CrossRoundCountPresentation | null {
  const entry = resolveHubMetricEligibility(metricId, claimActualityState);
  if (!entry?.comparisonAllowed) return null;
  if (payload.payloadMode !== "promoted-2026") return null;

  const baseline2012 = baseline2012ForCountMetric(metricId);
  const provenanceLine = `Method ${entry.method}. Historical source ${entry.source2012} · ${HISTORICAL_REVEAL_SNAPSHOT}. Active snapshot ${payload.snapshotId ?? "unavailable"}.`;
  const active2026 = countActiveForMetric(metricId, applications);
  if (active2026 === null) {
    return {
      metricId,
      numericDelta: false,
      baseline2012,
      active2026: null,
      difference: null,
      statement: "2026 value unavailable. No difference is shown.",
      provenanceLine,
    };
  }
  return {
    metricId,
    numericDelta: true,
    baseline2012,
    active2026,
    difference: active2026 - baseline2012,
    statement: formatCrossRoundCountStatement(baseline2012, active2026),
    provenanceLine,
  };
}
