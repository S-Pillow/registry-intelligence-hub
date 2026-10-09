import type { RoundClaimReadiness } from "./claim-readiness";
import type { MetricReadiness } from "./readiness";

export const METRIC_ELIGIBILITY_CATALOG_VERSION = "metric-eligibility-catalog/2.0.0";

/** Where the metric value is sourced from (orthogonal to publication actuality). */
export type MetricSourceChannel =
  | "OFFICIAL_AGGREGATE"
  | "ROW_DERIVED"
  | "OFFICIAL_CONTENTION"
  | "DERIVED_REVIEWED"
  | "CALCULATED_EXACT_STRING"
  | "NOT_AVAILABLE";

/** Coverage contract required before a complete/headline claim is honest. */
export type MetricCoverageRequirement =
  | "OFFICIAL_AGGREGATE_SUFFICIENT"
  | "COMPLETE_ROW_COVERAGE_REQUIRED"
  | "MEMBER_UNIVERSE_COMPLETE"
  | "PARTIAL_OK_WITH_DISCLOSURE"
  | "NOT_APPLICABLE";

/** Cross-round comparison status (orthogonal to single-round claim readiness). */
export type CrossRoundEligibilityStatus =
  | "READY"
  | "READY_WITH_LIMITATION"
  | "BLOCKED_COVERAGE"
  | "BLOCKED_SEMANTICS"
  | "BLOCKED_METHOD"
  | "BLOCKED_SOURCE"
  | "NOT_APPLICABLE";

export type MetricEligibilityEntry = {
  metricId: string;
  label: string;
  methodReadiness: MetricReadiness;
  claimReadiness: RoundClaimReadiness;
  /** Never assert real 2026 publication identity from rehearsal or partial gates. */
  claimsReal2026Identity: false;
  source2012: string;
  source2026: string;
  method: string;
  notes?: string;
  compareDimensionId?: string;
  /** Grain of the metric value. */
  grain?: string;
  sourceChannel?: MetricSourceChannel;
  coverageRequirement?: MetricCoverageRequirement;
  crossRoundStatus?: CrossRoundEligibilityStatus;
  /**
   * Machine-readable disclosure keys for later browser binding.
   * Presentation layer owns user-facing copy.
   */
  disclosureKeys?: readonly string[];
  /**
   * When true, Application publication actuality REAL_SOURCE_READY may advance
   * claimReadiness.round2026 to REAL_SOURCE_READY. Unique-string / complete-coverage
   * metrics must remain false.
   */
  advancesWithApplicationActuality?: boolean;
  /**
   * When true, Contention sidecar actuality REAL_SOURCE_READY may advance
   * claimReadiness.round2026. Application actuality alone is never sufficient.
   */
  advancesWithContentionActuality?: boolean;
};

/**
 * Single source of truth for comparison gates. UI surfaces must not invent local gates.
 * Runtime value binding (officialAggregates → UI numbers) is left to the promotion/browser ticket.
 */
export const METRIC_ELIGIBILITY_CATALOG: MetricEligibilityEntry[] = [
  {
    metricId: "application-count",
    label: "Application count",
    methodReadiness: "COMPARABLE",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV",
    source2026: "registry-2026-publication/2.0.0 officialAggregates.officialApplicationCount",
    method: "official-aggregate(application-count)",
    grain: "Statistics application (official)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "READY_WITH_LIMITATION",
    disclosureKeys: ["official-aggregate", "reveal-day-as-of", "not-applications-length"],
    advancesWithApplicationActuality: true,
    notes: "Headline 2026 count is official 1615 — never applications.length / 1614.",
  },
  {
    metricId: "observed-application-records",
    label: "Observed normalized application records",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "registry-2026-publication/2.0.0 coverage.normalizedApplicationRecordsObserved",
    method: "count(normalized-applications)",
    grain: "logical Application (observed)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "NOT_APPLICABLE",
    disclosureKeys: ["partial-coverage", "not-round-total", "known-excluded-wdo"],
    advancesWithApplicationActuality: true,
    notes: "Coverage metric only (1614). Never the round total.",
  },
  {
    metricId: "applicant-count",
    label: "Official applicant count",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a (2012 uses organization/applicant semantics carefully)",
    source2026: "registry-2026-publication/2.0.0 officialAggregates.officialApplicantCount",
    method: "official-aggregate(applicant-count)",
    grain: "APS Statistics applicant",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["official-aggregate", "applicant-not-organization"],
    advancesWithApplicationActuality: true,
    notes: "Official 481. Distinct from 480 observed legal names. Applicant ≠ Organization.",
  },
  {
    metricId: "observed-applicant-legal-names",
    label: "Observed distinct applicant legal names",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "registry-2026-publication/2.0.0 applications[].applicant (distinct)",
    method: "count(distinct applicant legal name)",
    grain: "Applicant Name (observed)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_COVERAGE",
    disclosureKeys: ["partial-coverage", "applicant-not-organization", "not-official-481"],
    advancesWithApplicationActuality: true,
    notes: "480 under partial Application coverage — not official applicant total.",
  },
  {
    metricId: "unique-applied-strings",
    label: "Unique applied strings",
    methodReadiness: "BLOCKED_COVERAGE",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV",
    source2026: "row-derived from normalized Applications (partial 1614/1615); no complete APS unique-string aggregate yet",
    method: "count(distinct appliedString.label)",
    grain: "exact applied-for string",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "COMPLETE_ROW_COVERAGE_REQUIRED",
    crossRoundStatus: "BLOCKED_COVERAGE",
    disclosureKeys: ["blocked-coverage", "research-partial-only"],
    advancesWithApplicationActuality: false,
    notes: "Publication actuality MUST NOT elevate to REAL_SOURCE_READY while coverage is partial.",
  },
  {
    metricId: "idn-applications",
    label: "IDN applications",
    methodReadiness: "COMPARABLE",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "icann2012-reveal-day-v1 / Reveal Day CSV (IDN? = Yes)",
    source2026: "Reveal Day official/announcement designation aggregate (21); CSV flags corroborate only",
    method: "official-aggregate(idn-designation-count)",
    grain: "application designation (IDN)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "READY_WITH_LIMITATION",
    disclosureKeys: ["official-aggregate", "designation-count", "row-equality-not-coverage-proof"],
    advancesWithApplicationActuality: true,
    notes: "Official 21. Row equality with CSV is corroboration, not coverage proof.",
  },
  {
    metricId: "brand-applications",
    label: "Brand applications",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "no approved 2012 Brand metric",
    source2026: "Reveal Day official/announcement Brand designation (333)",
    method: "official-aggregate(brand-designation-count)",
    grain: "application designation (Brand)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "NOT_APPLICABLE",
    disclosureKeys: ["official-aggregate", "designation-not-sector"],
    advancesWithApplicationActuality: true,
    notes: "2026 orientation only — no 2012 Brand comparison.",
  },
  {
    metricId: "community-applications",
    label: "Community applications (2026 designation)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "see community-designation-count (CSV flag method)",
    source2026: "Reveal Day official/announcement Community designation (16)",
    method: "official-aggregate(community-designation-count)",
    grain: "application designation (Community)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["official-aggregate", "designation-not-sector", "cross-round-blocked-semantics"],
    advancesWithApplicationActuality: true,
    notes: "2026 orientation with limitation; cross-round vs 2012 Community blocked on semantics.",
  },
  {
    metricId: "geographic-applications",
    label: "Geographic applications (self-identified)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "see geographic-designation-count (CSV flag method)",
    source2026: "Reveal Day official/announcement self-identified Geographic (15)",
    method: "official-aggregate(geographic-self-identified-count)",
    grain: "application designation (Geographic, self-identified)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["official-aggregate", "self-identified-geographic", "cross-round-blocked-semantics"],
    advancesWithApplicationActuality: true,
    notes: "Mandatory self-identified semantics; cross-round blocked.",
  },
  {
    metricId: "variant-applications",
    label: "Variant applications",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "Reveal Day official/announcement variant applications (9)",
    method: "official-aggregate(variant-application-count)",
    grain: "application type (variants)",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "NOT_APPLICABLE",
    disclosureKeys: ["official-aggregate", "later-milestones-may-refine"],
    advancesWithApplicationActuality: true,
  },
  {
    metricId: "replacement-relationships",
    label: "Replacement string relationships",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "registry-2026-publication/2.0.0 ReplacementString relationships",
    method: "count(applications with replacementString)",
    grain: "replacement relationship (not extra applications)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "NOT_APPLICABLE",
    disclosureKeys: ["relationship-grain", "not-extra-applications", "observed-reveal-day"],
    advancesWithApplicationActuality: true,
    notes: "1169 relationships among observed Applications — not additional applications.",
  },
  {
    metricId: "applicant-by-region",
    label: "Applicants by region (official)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "APS Statistics applicants-by-region",
    method: "official-aggregate(applicant-by-region)",
    grain: "applicant × region",
    sourceChannel: "OFFICIAL_AGGREGATE",
    coverageRequirement: "OFFICIAL_AGGREGATE_SUFFICIENT",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["official-aggregate", "applicant-region-grain", "do-not-mix-with-application-region"],
    advancesWithApplicationActuality: true,
  },
  {
    metricId: "application-by-region-observed",
    label: "Applications by region (observed rows)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "registry-2026-publication/2.0.0 applications[].region",
    method: "count(applications by region)",
    grain: "application × region (observed)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["partial-coverage", "application-region-grain", "not-statistics-applicant-region"],
    advancesWithApplicationActuality: true,
  },
  {
    metricId: "initial-contention-sets",
    label: "Initial Reveal Day official contention sets",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "see contention-set-count (2012 PDF entity count — BLOCKED_METHOD)",
    source2026: "registry-2026-contention-membership/1.0.0 officialContentionSetCount",
    method: "count(official contention sets)",
    grain: "official contention set (#)",
    sourceChannel: "OFFICIAL_CONTENTION",
    coverageRequirement: "MEMBER_UNIVERSE_COMPLETE",
    crossRoundStatus: "BLOCKED_METHOD",
    disclosureKeys: ["initial-reveal-day-contention", "may-change-later", "not-exact-string"],
    advancesWithApplicationActuality: false,
    advancesWithContentionActuality: true,
    notes: "Requires approved contention sidecar pin — Application actuality alone is insufficient.",
  },
  {
    metricId: "initial-contention-memberships",
    label: "Initial Reveal Day official contention memberships",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "icann2012-contention-pdf/1.0.0 membership",
    source2026: "registry-2026-contention-membership/1.0.0 joinedMemberCount",
    method: "count(official contention memberships)",
    grain: "contention-set membership",
    sourceChannel: "OFFICIAL_CONTENTION",
    coverageRequirement: "MEMBER_UNIVERSE_COMPLETE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    disclosureKeys: ["initial-reveal-day-contention", "may-change-later", "not-exact-string"],
    advancesWithApplicationActuality: false,
    advancesWithContentionActuality: true,
  },
  {
    metricId: "contention-member-analysis",
    label: "Official contention member-based analysis",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "NOT_PUBLISHED", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "n/a",
    source2026: "registry-2026-contention-membership/1.0.0 memberships (+ optional Application join)",
    method: "contention-member-analysis/1.0.0",
    grain: "contention membership (member universe)",
    sourceChannel: "OFFICIAL_CONTENTION",
    coverageRequirement: "MEMBER_UNIVERSE_COMPLETE",
    crossRoundStatus: "NOT_APPLICABLE",
    disclosureKeys: [
      "initial-reveal-day-contention",
      "applicant-not-organization",
      "portfolio-share-uses-partial-application-coverage",
    ],
    advancesWithApplicationActuality: false,
    advancesWithContentionActuality: true,
    notes: "Member/set analyses complete for 891 joined members; portfolio shares using 1614 apps remain partial.",
  },
  {
    metricId: "exact-applied-string-competition",
    label: "Exact applied-string competition (RIH calculated)",
    methodReadiness: "BLOCKED_COVERAGE",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "exact-applied-string-grouping/1.0.0",
    source2026: "exact-applied-string-grouping/1.0.0 on normalized Applications (partial)",
    method: "exact-applied-string-grouping/1.0.0",
    grain: "exact applied-for string group",
    sourceChannel: "CALCULATED_EXACT_STRING",
    coverageRequirement: "COMPLETE_ROW_COVERAGE_REQUIRED",
    crossRoundStatus: "BLOCKED_COVERAGE",
    disclosureKeys: ["not-official-contention", "blocked-coverage", "research-partial-only"],
    advancesWithApplicationActuality: false,
    notes: "Never equate with official contention membership.",
  },
  {
    metricId: "distinct-countries",
    label: "Distinct applicant countries",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "icann2012-reveal-day-v1 / CSV Location",
    source2026: "registry-applications.json country / publication.country",
    method: "count(distinct jurisdiction)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    advancesWithApplicationActuality: false,
    notes: "2012 jurisdiction preserved on normalized payload; 2026 rehearsal/partial until bound.",
  },
  {
    metricId: "distinct-regions",
    label: "Distinct ICANN regions",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "icann2012-reveal-day-v1 / CSV Region",
    source2026: "see applicant-by-region / application-by-region-observed",
    method: "count(distinct region)",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    advancesWithApplicationActuality: false,
    notes: "Prefer grain-specific region metrics; do not mix applicant vs application region.",
  },
  {
    metricId: "community-designation-count",
    label: "Community designation (CSV flag)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "reveal-day-community-flag/1.0",
    source2026: "see community-applications (official designation aggregate)",
    method: "taxonomy community assignment / CSV flag",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    advancesWithApplicationActuality: false,
    notes: "2012 CSV-flag method retained. Cross-round vs 2026 official Community blocked on semantics.",
  },
  {
    metricId: "geographic-designation-count",
    label: "Geographic designation (CSV flag)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "reveal-day-geographic-flag/1.0",
    source2026: "see geographic-applications (self-identified official aggregate)",
    method: "taxonomy geographic assignment / CSV flag",
    sourceChannel: "ROW_DERIVED",
    coverageRequirement: "PARTIAL_OK_WITH_DISCLOSURE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    advancesWithApplicationActuality: false,
    notes: "2012 CSV-flag method retained. Cross-round vs 2026 self-identified Geographic blocked.",
  },
  {
    metricId: "contention-membership-exposure",
    label: "Contention set membership (per application)",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "icann2012-contention-pdf/1.0.0 membership",
    source2026: "see initial-contention-memberships / contention-member-analysis",
    method: "count(applications with set membership)",
    sourceChannel: "OFFICIAL_CONTENTION",
    coverageRequirement: "MEMBER_UNIVERSE_COMPLETE",
    crossRoundStatus: "BLOCKED_SEMANTICS",
    advancesWithApplicationActuality: false,
    advancesWithContentionActuality: false,
    notes: "Legacy per-application exposure id. Prefer initial-contention-* for Reveal Day official counts.",
  },
  {
    metricId: "contention-set-count",
    label: "Contention set entity count",
    methodReadiness: "BLOCKED_METHOD",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "REHEARSAL_ONLY" },
    claimsReal2026Identity: false,
    source2012: "icann2012-contention-pdf/1.0.0",
    source2026: "see initial-contention-sets (Reveal Day official sidecar)",
    method: "count(distinct setId)",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_METHOD",
    advancesWithApplicationActuality: false,
    advancesWithContentionActuality: false,
    notes: "2012: 234 extracted vs 232 ICANN-cited — headline set count blocked. Use initial-contention-sets for 2026.",
  },
  {
    metricId: "category-mix",
    label: "Category / sector mix",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "registry-market-taxonomy/1.0 (mostly unclassified)",
    source2026: "no defensible sector taxonomy",
    method: "registry-market-taxonomy/1.0",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
    notes: "Do not confuse Brand/Community/Geographic designations with sector taxonomy.",
  },
  {
    metricId: "organization-round-count",
    label: "Distinct organizations (round-wide)",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "organization-promotion/1.0.0 (26% promoted)",
    source2026: "organization-resolution-2026/1.0.0 (confirmed-only; first-pass may be 0)",
    method: "count(distinct organization)",
    sourceChannel: "DERIVED_REVIEWED",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
    notes:
      "Sidecar exists; product still blocked until steward-confirmed mappings. Do not use Applicant Name or contention Org Name as RIH Organization.",
  },
  {
    metricId: "portfolio-concentration-round-wide",
    label: "Round-wide portfolio concentration",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "organization-promotion/1.0.0",
    source2026: "organization-resolution-2026/1.0.0 confirmed coverage required",
    method: "portfolio-ranking/1.0.0",
    sourceChannel: "DERIVED_REVIEWED",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
  },
  {
    metricId: "confirmed-portfolio-facts",
    label: "Promoted organization portfolio facts",
    methodReadiness: "PARTIAL",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "organization-promotion/1.0.0 (steward ops)",
    source2026: "organization-resolution-2026/1.0.0 confirmed-only (first-pass 0)",
    method: "organization-promotion/1.0.0",
    sourceChannel: "DERIVED_REVIEWED",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
    notes: "Offline promoted keys only; UI round-wide charts remain gated.",
  },
  {
    metricId: "returning-participant-identity",
    label: "Returning participant / prior applicant (identity)",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "REAL_SOURCE_READY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "organization-promotion/1.0.0 + cross-round-identity/1.0.0",
    source2026: "requires CROSS-ROUND-ID-1 after confirmed 2026 Organizations",
    method: "cross-round-identity/1.0.0",
    sourceChannel: "DERIVED_REVIEWED",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
    notes: "Requires cross-round identity — not real for 2026 yet.",
    compareDimensionId: "participation-status-identity",
  },
  {
    metricId: "returning-delegated-operator",
    label: "Returning delegated operator",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "post-Reveal delegation (not ingested)",
    source2026: "post-Reveal lifecycle (not ingested)",
    method: "n/a",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
    notes: "Requires post-Reveal outcome/lifecycle ingest.",
  },
  {
    metricId: "returning-successful-applicant",
    label: "Returning successful applicant",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "post-Reveal outcomes (not ingested)",
    source2026: "post-Reveal outcomes (not ingested)",
    method: "n/a",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
  },
  {
    metricId: "historical-operator-track-record",
    label: "Historical operator track record",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "post-Reveal delegation & operations (not ingested)",
    source2026: "post-Reveal lifecycle (not ingested)",
    method: "n/a",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
  },
  {
    metricId: "historical-market-demand",
    label: "Historical / comparable market demand",
    methodReadiness: "BLOCKED_SOURCE",
    claimReadiness: { round2012: "HISTORICAL_ONLY", round2026: "NOT_PUBLISHED" },
    claimsReal2026Identity: false,
    source2012: "no approved licensed source",
    source2026: "no approved licensed source",
    method: "n/a",
    sourceChannel: "NOT_AVAILABLE",
    coverageRequirement: "NOT_APPLICABLE",
    crossRoundStatus: "BLOCKED_SOURCE",
    advancesWithApplicationActuality: false,
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

/** Metrics that may advance with Application publication actuality alone. */
export function applicationActualityAdvanceMetricIds(): readonly string[] {
  return METRIC_ELIGIBILITY_CATALOG.filter((e) => e.advancesWithApplicationActuality === true).map((e) => e.metricId);
}

/** Metrics that require Contention sidecar actuality (never Application alone). */
export function contentionActualityAdvanceMetricIds(): readonly string[] {
  return METRIC_ELIGIBILITY_CATALOG.filter((e) => e.advancesWithContentionActuality === true).map((e) => e.metricId);
}
