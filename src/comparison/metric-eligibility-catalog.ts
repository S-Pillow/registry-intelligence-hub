import type { MetricReadiness } from "./readiness";

export const METRIC_ELIGIBILITY_CATALOG_VERSION = "metric-eligibility-catalog/1.0.0";

export type MetricEligibilityEntry = {
  metricId: string;
  label: string;
  readiness: MetricReadiness;
  source2012: string;
  source2026: string;
  method: string;
  notes?: string;
  compareDimensionId?: string;
};

/**
 * Single source of truth for comparison gates. UI surfaces must not invent local gates.
 */
export const METRIC_ELIGIBILITY_CATALOG: MetricEligibilityEntry[] = [
  {
    metricId: "application-count",
    label: "Application count",
    readiness: "COMPARABLE",
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV",
    source2026: "registry-applications.json (rehearsal fixture)",
    method: "count(application)",
  },
  {
    metricId: "unique-applied-strings",
    label: "Unique applied strings",
    readiness: "COMPARABLE",
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV",
    source2026: "registry-applications.json (rehearsal fixture)",
    method: "count(distinct stringUlabel)",
  },
  {
    metricId: "idn-applications",
    label: "IDN applications",
    readiness: "COMPARABLE",
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV (IDN? = Yes)",
    source2026: "registry-applications.json (rehearsal fixture)",
    method: "count(isIdn)",
  },
  {
    metricId: "distinct-countries",
    label: "Distinct applicant countries",
    readiness: "PARTIAL",
    source2012: "icann2012-reveal-day-v1 / CSV Location",
    source2026: "registry-applications.json country",
    method: "count(distinct jurisdiction)",
    notes: "2012 jurisdiction preserved on normalized payload; 2026 rehearsal only.",
  },
  {
    metricId: "distinct-regions",
    label: "Distinct ICANN regions",
    readiness: "PARTIAL",
    source2012: "icann2012-reveal-day-v1 / CSV Region",
    source2026: "registry-applications.json region",
    method: "count(distinct region)",
  },
  {
    metricId: "community-designation-count",
    label: "Community designation (CSV flag)",
    readiness: "PARTIAL",
    source2012: "reveal-day-community-flag/1.0",
    source2026: "registry-market-taxonomy/1.0 on rehearsal type",
    method: "taxonomy community assignment",
    notes: "Not comparable to 2026 commercial-sector categories.",
  },
  {
    metricId: "geographic-designation-count",
    label: "Geographic designation (CSV flag)",
    readiness: "PARTIAL",
    source2012: "reveal-day-geographic-flag/1.0",
    source2026: "registry-market-taxonomy/1.0 on rehearsal type",
    method: "taxonomy geographic assignment",
  },
  {
    metricId: "contention-membership-exposure",
    label: "Contention set membership (per application)",
    readiness: "PARTIAL",
    source2012: "icann2012-contention-pdf/1.0.0 membership",
    source2026: "registry-applications.json contentionSet",
    method: "count(applications with set membership)",
  },
  {
    metricId: "contention-set-count",
    label: "Contention set entity count",
    readiness: "BLOCKED_METHOD",
    source2012: "icann2012-contention-pdf/1.0.0",
    source2026: "registry-applications.json distinct sets",
    method: "count(distinct setId)",
    notes: "234 extracted vs 232 ICANN-cited — headline set count blocked.",
  },
  {
    metricId: "category-mix",
    label: "Category / sector mix",
    readiness: "BLOCKED_COVERAGE",
    source2012: "registry-market-taxonomy/1.0 (mostly unclassified)",
    source2026: "registry-applications.json rehearsal categories",
    method: "registry-market-taxonomy/1.0",
    notes: "Do not publish invented commercial-sector comparisons.",
  },
  {
    metricId: "organization-round-count",
    label: "Distinct organizations (round-wide)",
    readiness: "BLOCKED_COVERAGE",
    source2012: "organization-promotion/1.0.0 (26% promoted)",
    source2026: "registry-applications.json organization (illustrative)",
    method: "count(distinct organization)",
    notes: "No silent merge; denominator policy not explicit for round-wide concentration.",
  },
  {
    metricId: "portfolio-concentration-round-wide",
    label: "Round-wide portfolio concentration",
    readiness: "BLOCKED_COVERAGE",
    source2012: "organization-promotion/1.0.0",
    source2026: "registry-applications.json",
    method: "portfolio-ranking/1.0.0",
    notes: "Narrow confirmed-portfolio facts may be PARTIAL offline only.",
  },
  {
    metricId: "confirmed-portfolio-facts",
    label: "Promoted organization portfolio facts",
    readiness: "PARTIAL",
    source2012: "organization-promotion/1.0.0 (steward ops)",
    source2026: "not applicable until 2026 org resolution",
    method: "organization-promotion/1.0.0",
    notes: "Offline promoted keys only; UI round-wide charts remain gated.",
  },
  {
    metricId: "returning-participant-identity",
    label: "Returning participant / prior applicant (identity)",
    readiness: "PARTIAL",
    source2012: "organization-promotion/1.0.0 + cross-round-identity/1.0.0",
    source2026: "2026 organization resolution (pre-publication)",
    method: "cross-round-identity/1.0.0",
    notes: "2012↔2026 organization identity match only — no outcome implied.",
    compareDimensionId: "participation-status-identity",
  },
  {
    metricId: "returning-delegated-operator",
    label: "Returning delegated operator",
    readiness: "BLOCKED_SOURCE",
    source2012: "post-Reveal delegation (not ingested)",
    source2026: "post-Reveal lifecycle (not ingested)",
    method: "n/a",
    notes: "Requires post-Reveal outcome/lifecycle ingest.",
  },
  {
    metricId: "returning-successful-applicant",
    label: "Returning successful applicant",
    readiness: "BLOCKED_SOURCE",
    source2012: "post-Reveal outcomes (not ingested)",
    source2026: "post-Reveal outcomes (not ingested)",
    method: "n/a",
  },
  {
    metricId: "historical-operator-track-record",
    label: "Historical operator track record",
    readiness: "BLOCKED_SOURCE",
    source2012: "post-Reveal delegation & operations (not ingested)",
    source2026: "post-Reveal lifecycle (not ingested)",
    method: "n/a",
  },
  {
    metricId: "historical-market-demand",
    label: "Historical / comparable market demand",
    readiness: "BLOCKED_SOURCE",
    source2012: "no approved licensed source",
    source2026: "no approved licensed source",
    method: "n/a",
    compareDimensionId: "market-demand",
  },
];

const catalogById = new Map(METRIC_ELIGIBILITY_CATALOG.map((entry) => [entry.metricId, entry]));
const catalogByDimension = new Map(
  METRIC_ELIGIBILITY_CATALOG.filter((e) => e.compareDimensionId).map((e) => [e.compareDimensionId!, e]),
);

export function getMetricEligibility(metricId: string): MetricEligibilityEntry | undefined {
  return catalogById.get(metricId);
}

export function getCompareDimensionEligibility(compareDimensionId: string): MetricEligibilityEntry | undefined {
  return catalogByDimension.get(compareDimensionId);
}

