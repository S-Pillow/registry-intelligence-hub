import type { Application } from "@/lib/registry-data";
import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";
import { getMetricEligibility, requireMetricEligibility, readinessBlocksComparablePresentation } from "./metric-eligibility";
import type { MetricDisplayTier, MetricReadiness } from "./readiness";
import { isReadinessComparable } from "./readiness";

export const HISTORICAL_2012_UI_ADAPTER_VERSION = "historical-2012-ui-adapter/1.0.0";

export type PresentedHistoricalMetric = {
  /** Stable Command Center filter id (legacy round-pulse keys). */
  id: string;
  metricId: string;
  label: string;
  value: number;
  baseline2012: number | null;
  deltaLabel: string | null;
  readiness: MetricReadiness;
  displayTier: MetricDisplayTier;
  source: string;
  method: string;
  filter: string;
};

function displayTierFor(readiness: MetricReadiness): MetricDisplayTier {
  if (readiness === "COMPARABLE") return "production-ready";
  if (readiness === "PARTIAL") return "comparison-pending";
  if (readiness === "BLOCKED_COVERAGE" || readiness === "BLOCKED_METHOD") return "comparison-pending";
  return "unavailable";
}

function formatDelta(current: number, baseline: number): string {
  const diff = current - baseline;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff} vs 2012 Reveal Day (${baseline})`;
}

function entryFor(metricId: string) {
  return requireMetricEligibility(metricId);
}

function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

/**
 * Incremental Command Center round pulse: rehearsal 2026 values with approved 2012 baselines where gated COMPARABLE/PARTIAL.
 */
export function buildCommandCenterRoundPulse(applications: Application[]): PresentedHistoricalMetric[] {
  const baseline = APPROVED_2012_BASELINE;

  const metrics: PresentedHistoricalMetric[] = [
    {
      id: "applications",
      metricId: "application-count",
      label: "Applications",
      value: applications.length,
      baseline2012: baseline.applications,
      deltaLabel: formatDelta(applications.length, baseline.applications),
      readiness: entryFor("application-count").readiness,
      displayTier: displayTierFor(entryFor("application-count").readiness),
      source: entryFor("application-count").source2012,
      method: entryFor("application-count").method,
      filter: "all",
    },
    {
      id: "strings",
      metricId: "unique-applied-strings",
      label: "Unique strings",
      value: uniqueCount(applications.map((item) => item.string)),
      baseline2012: baseline.uniqueStrings,
      deltaLabel: formatDelta(uniqueCount(applications.map((item) => item.string)), baseline.uniqueStrings),
      readiness: entryFor("unique-applied-strings").readiness,
      displayTier: displayTierFor(entryFor("unique-applied-strings").readiness),
      source: entryFor("unique-applied-strings").source2012,
      method: entryFor("unique-applied-strings").method,
      filter: "strings",
    },
    {
      id: "organizations",
      metricId: "organization-round-count",
      label: "Organizations",
      value: uniqueCount(applications.map((item) => item.organization)),
      baseline2012: null,
      deltaLabel: "Round-wide organization comparison not approved",
      readiness: entryFor("organization-round-count").readiness,
      displayTier: displayTierFor(entryFor("organization-round-count").readiness),
      source: entryFor("organization-round-count").source2012,
      method: entryFor("organization-round-count").method,
      filter: "organizations",
    },
    {
      id: "regions",
      metricId: "distinct-regions",
      label: "Regions",
      value: uniqueCount(applications.map((item) => item.region)),
      baseline2012: baseline.distinctRegions,
      deltaLabel: `${uniqueCount(applications.map((item) => item.country))} countries · 2012 had ${baseline.distinctCountries} countries`,
      readiness: entryFor("distinct-regions").readiness,
      displayTier: displayTierFor(entryFor("distinct-regions").readiness),
      source: entryFor("distinct-regions").source2012,
      method: entryFor("distinct-regions").method,
      filter: "regions",
    },
    {
      id: "idn",
      metricId: "idn-applications",
      label: "IDN applications",
      value: applications.filter((item) => item.idn).length,
      baseline2012: baseline.idnApplications,
      deltaLabel: formatDelta(applications.filter((item) => item.idn).length, baseline.idnApplications),
      readiness: entryFor("idn-applications").readiness,
      displayTier: displayTierFor(entryFor("idn-applications").readiness),
      source: entryFor("idn-applications").source2012,
      method: entryFor("idn-applications").method,
      filter: "idn",
    },
    {
      id: "contention",
      metricId: "contention-set-count",
      label: "Initial contention sets",
      value: uniqueCount(applications.flatMap((item) => (item.contentionSet ? [item.contentionSet] : []))),
      baseline2012: null,
      deltaLabel: "Set-entity count blocked — membership exposure only",
      readiness: entryFor("contention-set-count").readiness,
      displayTier: displayTierFor(entryFor("contention-set-count").readiness),
      source: entryFor("contention-set-count").source2012,
      method: entryFor("contention-set-count").method,
      filter: "contention",
    },
  ];

  return metrics;
}

export type GlanceMetric = {
  metricId: string;
  label: string;
  rehearsalValue: number;
  baseline2012: number | null;
  readiness: MetricReadiness;
  displayTier: MetricDisplayTier;
  source: string;
  method: string;
};

/** Approved 2012 facts for side-by-side glance (excludes gated organization round count). */
export function buildRevealDayGlanceMetrics(applications: Application[]): GlanceMetric[] {
  const baseline = APPROVED_2012_BASELINE;
  const ids = ["application-count", "unique-applied-strings", "idn-applications"] as const;

  return ids.map((metricId) => {
    const entry = entryFor(metricId);
    let rehearsalValue = 0;
    if (metricId === "application-count") rehearsalValue = applications.length;
    if (metricId === "unique-applied-strings") rehearsalValue = uniqueCount(applications.map((a) => a.string));
    if (metricId === "idn-applications") rehearsalValue = applications.filter((a) => a.idn).length;

    const baseline2012 =
      metricId === "application-count"
        ? baseline.applications
        : metricId === "unique-applied-strings"
          ? baseline.uniqueStrings
          : baseline.idnApplications;

    return {
      metricId,
      label: entry.label,
      rehearsalValue,
      baseline2012,
      readiness: entry.readiness,
      displayTier: displayTierFor(entry.readiness),
      source: entry.source2012,
      method: entry.method,
    };
  });
}

export function isMetricGatedForUi(metricId: string): boolean {
  const entry = getMetricEligibility(metricId);
  if (!entry) return true;
  return readinessBlocksComparablePresentation(entry.readiness);
}

export function approved2012ContentionMembershipNote(): string {
  return `${APPROVED_2012_BASELINE.contentionMembershipApplications} applications in official PDF membership (2012); set-entity headline counts remain blocked.`;
}

export { isReadinessComparable };
