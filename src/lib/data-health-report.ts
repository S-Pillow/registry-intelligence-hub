import { APPROVED_2012_BASELINE, APPROVED_2012_BASELINE_BUNDLE } from "@/comparison/approved-2012-baseline";
import {
  getMetricEligibility,
  METRIC_ELIGIBILITY_CATALOG_VERSION,
} from "@/comparison/metric-eligibility-catalog";
import type { ClaimReadiness } from "@/comparison/claim-readiness";
import type { MetricReadiness } from "@/comparison/readiness";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import type { HubRegistryDataResolution } from "@/lib/registry-application-payload-shared";
import { ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE } from "@/lib/registry-data";
import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import {
  APPLICATION_ACTUALITY_METRIC_IDS,
  DEFAULT_CLAIM_ACTUALITY_STATE,
} from "@/reveal-day-2026/claim-actuality";
import { buildComparisonUnlockReport } from "@/reveal-day-2026/comparison-unlock";
import { ORGANIZATION_RESOLUTION_METHOD } from "@/reveal-day-2026/types";

/** Offline organization promotion counts verified in `organization-promotion.test.ts`. */
export const OFFLINE_2012_ORG_PROMOTED_APPLICATIONS = 501;
export const OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS =
  APPROVED_2012_BASELINE.applications - OFFLINE_2012_ORG_PROMOTED_APPLICATIONS;

/** Taxonomy fixture coverage (Ticket B audit — `application-taxonomy.json`). */
export const OFFLINE_2012_TAXONOMY_CLASSIFIED = 139;
export const OFFLINE_2012_TAXONOMY_UNCLASSIFIED =
  APPROVED_2012_BASELINE.applications - OFFLINE_2012_TAXONOMY_CLASSIFIED;

export type SourceClassification =
  | "Historical"
  | "Rehearsal"
  | "Unpublished"
  | "Offline only"
  | "Browser payload";

export type SourceReadinessLabel =
  | "Ready"
  | "Partial"
  | "Rehearsal"
  | "Historical only"
  | "Not published"
  | "Browser not loaded"
  | "Blocked by method"
  | "Blocked by coverage"
  | "Blocked by source";

export type SourceHealthRow = {
  id: string;
  name: string;
  classification: SourceClassification;
  snapshotOrVersion?: string;
  coverage?: string;
  readiness: SourceReadinessLabel;
  limitation: string;
};

export type IntelligenceReadinessRow = {
  metricId: string;
  label: string;
  methodReadiness: MetricReadiness;
  round2012: ClaimReadiness;
  round2026: ClaimReadiness;
  comparisonAllowed: boolean;
  explanation: string;
};

export type DataHealthSnapshot = {
  catalogVersion: string;
  sourceHealth: SourceHealthRow[];
  intelligenceReadiness: IntelligenceReadinessRow[];
  browserDataState: {
    approved2012Aggregates: { applications: number; uniqueStrings: number; idnApplications: number };
    entityLevel2012InBrowser: false;
    entityLevel2012Message: string;
    offlineNormalizedCorpus: string;
    browserEntityDataset: string;
    real2026Publication: string;
    rehearsalEntityWarning: string;
  };
  coverageLimitations: string[];
  publicationReadiness: {
    round2026ApplicationActuality: ClaimActualityState["round2026ApplicationActuality"];
    claimActualityPromotedAt: string | null;
    browserPayloadMode: HubRegistryDataResolution["mode"];
    browserPayloadSelectionReason: HubRegistryDataResolution["selectionReason"];
    comparableMetricsUnlocked: number;
    comparableMetricsTotal: number;
    unlockSummary: string;
    prerequisites: string[];
  };
};

function methodReadinessLabel(method: MetricReadiness): SourceReadinessLabel {
  if (method === "COMPARABLE") return "Ready";
  if (method === "PARTIAL") return "Partial";
  if (method === "BLOCKED_METHOD") return "Blocked by method";
  if (method === "BLOCKED_COVERAGE") return "Blocked by coverage";
  if (method === "BLOCKED_SOURCE") return "Blocked by source";
  return "Partial";
}

function intelligenceExplanation(
  metricId: string,
  method: MetricReadiness,
  comparisonAllowed: boolean,
  gateReason: string | undefined,
  notes: string | undefined,
): string {
  if (comparisonAllowed) {
    return "Cross-round comparison allowed when 2026 application actuality is REAL_SOURCE_READY (application-count family only until org resolution).";
  }
  if (gateReason) return gateReason;
  if (notes) return notes;
  return `Method readiness ${method}; comparison gated.`;
}

export function buildSourceHealthRows(
  resolution: HubRegistryDataResolution,
  claimActuality: ClaimActualityState,
): SourceHealthRow[] {
  const baseline = APPROVED_2012_BASELINE;
  const doc = resolution.document;

  return [
    {
      id: "2012-reveal-csv",
      name: "2012 Reveal Day application source",
      classification: "Historical",
      snapshotOrVersion: `${APPROVED_2012_BASELINE_BUNDLE} · ${baseline.parserVersion}`,
      coverage: `${baseline.applications} applications (offline CSV)`,
      readiness: "Ready",
      limitation: "Browser shows approved aggregate counts only — not entity rows.",
    },
    {
      id: "2012-contention-pdf",
      name: "2012 contention source",
      classification: "Historical",
      snapshotOrVersion: "icann2012-contention-pdf/1.0.0",
      coverage: `${baseline.contentionMembershipApplications} applications in PDF membership`,
      readiness: "Partial",
      limitation: `Set-entity headline blocked (${baseline.extractedContentionSetEntities} extracted vs ${baseline.icannCitedContentionSetEntities} ICANN-cited).`,
    },
    {
      id: "2012-normalized-corpus",
      name: "2012 normalized application corpus",
      classification: "Offline only",
      snapshotOrVersion: baseline.bundleId,
      coverage: `${baseline.applications} observations (CLI normalize + verify)`,
      readiness: "Browser not loaded",
      limitation: "Full-round entity payload not wired to Explore (Ticket D not started).",
    },
    {
      id: "2012-org-promotion",
      name: "2012 organization promotion / resolution",
      classification: "Historical",
      snapshotOrVersion: ORGANIZATION_RESOLUTION_METHOD,
      coverage: `${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} promoted · ${OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS} unresolved`,
      readiness: "Partial",
      limitation: "Round-wide organization counts and portfolio concentration remain blocked.",
    },
    {
      id: "2012-taxonomy",
      name: "2012 taxonomy / classification",
      classification: "Historical",
      snapshotOrVersion: "registry-market-taxonomy/1.0",
      coverage: `${OFFLINE_2012_TAXONOMY_CLASSIFIED}/${baseline.applications} classified`,
      readiness: "Blocked by coverage",
      limitation: "Category / sector mix comparisons are not published.",
    },
    {
      id: "2026-application-source",
      name: "2026 application source / claim actuality",
      classification: claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY" ? "Historical" : "Unpublished",
      snapshotOrVersion: claimActuality.snapshotId ?? "none",
      coverage:
        claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY"
          ? "Promoted immutable publication"
          : "NOT_PUBLISHED",
      readiness: claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY" ? "Ready" : "Not published",
      limitation: "Real 2026 identity requires steward promote-actuality — not inferred from rehearsal.",
    },
    {
      id: "browser-application-payload",
      name: "Current browser application payload",
      classification: resolution.mode === "promoted-2026" ? "Browser payload" : "Rehearsal",
      snapshotOrVersion: `${doc.fixtureId ?? "promoted"} · ${doc.snapshotId}`,
      coverage: `${doc.applications.length} entity records in browser`,
      readiness: resolution.mode === "promoted-2026" ? "Ready" : "Rehearsal",
      limitation:
        resolution.mode === "rehearsal"
          ? "Atlas Digital, Kizuna Registry, and other rehearsal names are not historical 2012 facts."
          : "Payload must match promoted snapshot id and content hash.",
    },
  ];
}

export function buildIntelligenceReadinessRows(
  claimActuality: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): IntelligenceReadinessRow[] {
  const unlock = buildComparisonUnlockReport(claimActuality);

  return unlock.metrics.map((row) => {
    const resolved = resolveHubMetricEligibility(row.metricId, claimActuality)!;
    const catalogNotes = getMetricEligibility(row.metricId)?.notes;
    return {
      metricId: row.metricId,
      label: row.label,
      methodReadiness: row.methodReadiness as MetricReadiness,
      round2012: resolved.claimReadiness.round2012,
      round2026: resolved.claimReadiness.round2026,
      comparisonAllowed: row.comparisonAllowed,
      explanation: intelligenceExplanation(
        row.metricId,
        row.methodReadiness as MetricReadiness,
        row.comparisonAllowed,
        row.gateReason,
        catalogNotes,
      ),
    };
  });
}

export function buildDataHealthSnapshot(
  claimActuality: ClaimActualityState,
  resolution: HubRegistryDataResolution,
): DataHealthSnapshot {
  const unlock = buildComparisonUnlockReport(claimActuality);
  const comparableTotal = unlock.metrics.filter((m) => m.methodReadiness === "COMPARABLE").length;
  const comparableUnlocked = unlock.metrics.filter((m) => m.comparisonAllowed).length;

  const prerequisites: string[] = [
    "Immutable 2026 publication validated and promoted via reveal-2026 promote-actuality (application actuality only).",
    "Hash-matched browser application payload configured for the promoted snapshot.",
    `${ORGANIZATION_RESOLUTION_METHOD} steward promotion before organization or portfolio cross-round metrics unlock.`,
    "Entity-level 2012 browser payload generation (Ticket D) before full-round Explore rows.",
  ];

  if (claimActuality.round2026ApplicationActuality === "NOT_PUBLISHED") {
    prerequisites.unshift("2026 round remains NOT_PUBLISHED — cross-round COMPARABLE metrics stay gated.");
  }

  return {
    catalogVersion: METRIC_ELIGIBILITY_CATALOG_VERSION,
    sourceHealth: buildSourceHealthRows(resolution, claimActuality),
    intelligenceReadiness: buildIntelligenceReadinessRows(claimActuality),
    browserDataState: {
      approved2012Aggregates: {
        applications: APPROVED_2012_BASELINE.applications,
        uniqueStrings: APPROVED_2012_BASELINE.uniqueStrings,
        idnApplications: APPROVED_2012_BASELINE.idnApplications,
      },
      entityLevel2012InBrowser: false,
      entityLevel2012Message: ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE,
      offlineNormalizedCorpus: `Available offline (${APPROVED_2012_BASELINE_BUNDLE}); not loaded in browser entity tables.`,
      browserEntityDataset: `${resolution.document.applications.length}-record ${resolution.mode === "rehearsal" ? "2026 rehearsal" : "promoted 2026"} fixture (${resolution.document.fixtureId ?? resolution.document.snapshotId})`,
      real2026Publication:
        claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY"
          ? "REAL_SOURCE_READY"
          : "Not published / not promoted",
      rehearsalEntityWarning:
        "Rehearsal entities (Atlas Digital, Kizuna, Northstar Group, Harbor Brands, Future MENA, etc.) are curated 2026 drill names — not 2012 Reveal Day applicants.",
    },
    coverageLimitations: [
      `${APPROVED_2012_BASELINE.applications} applications in approved 2012 baseline (aggregate-only in browser).`,
      `Taxonomy ${OFFLINE_2012_TAXONOMY_CLASSIFIED}/${APPROVED_2012_BASELINE.applications} classified — category-mix remains BLOCKED_COVERAGE.`,
      `${APPROVED_2012_BASELINE.contentionMembershipApplications} contention PDF memberships; set count blocked (${APPROVED_2012_BASELINE.extractedContentionSetEntities} vs ${APPROVED_2012_BASELINE.icannCitedContentionSetEntities}).`,
      `Organization resolution partial — ${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} promoted applications (~${Math.round((OFFLINE_2012_ORG_PROMOTED_APPLICATIONS / APPROVED_2012_BASELINE.applications) * 100)}%); no round-wide org rankings.`,
      "Portfolio concentration and round-wide organization metrics stay gated per eligibility catalog.",
    ],
    publicationReadiness: {
      round2026ApplicationActuality: claimActuality.round2026ApplicationActuality,
      claimActualityPromotedAt: claimActuality.promotedAt,
      browserPayloadMode: resolution.mode,
      browserPayloadSelectionReason: resolution.selectionReason,
      comparableMetricsUnlocked: comparableUnlocked,
      comparableMetricsTotal: comparableTotal,
      unlockSummary: `${comparableUnlocked} of ${comparableTotal} COMPARABLE metrics allow cross-round comparison at current actuality.`,
      prerequisites,
    },
  };
}

/** Metrics whose 2026 claim advances with application publication only (re-export for UI). */
export { APPLICATION_ACTUALITY_METRIC_IDS };

export function methodReadinessBadgeVariant(readiness: MetricReadiness | SourceReadinessLabel | string): string {
  const label =
    readiness === "COMPARABLE" ||
    readiness === "PARTIAL" ||
    readiness === "BLOCKED_METHOD" ||
    readiness === "BLOCKED_COVERAGE" ||
    readiness === "BLOCKED_SOURCE" ||
    readiness === "NOT_APPLICABLE"
      ? methodReadinessLabel(readiness)
      : readiness;
  if (label === "Ready" || label === "COMPARABLE") return "ready";
  if (label === "Partial" || label === "PARTIAL") return "partial";
  if (label === "Rehearsal" || label === "Historical only") return "context";
  if (label.startsWith("Blocked")) return "blocked";
  if (label === "Not published" || label === "Browser not loaded") return "muted";
  return "muted";
}
