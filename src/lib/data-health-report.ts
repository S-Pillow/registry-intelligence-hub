import { APPROVED_2012_BASELINE, APPROVED_2012_BASELINE_BUNDLE } from "@/comparison/approved-2012-baseline";
import {
  getMetricEligibility,
  METRIC_ELIGIBILITY_CATALOG_VERSION,
} from "@/comparison/metric-eligibility-catalog";
import type { ClaimReadiness } from "@/comparison/claim-readiness";
import type { MetricReadiness } from "@/comparison/readiness";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  OFFLINE_2012_ORG_AMBIGUOUS_APPLICATIONS,
  OFFLINE_2012_ORG_AMBIGUOUS_ORGANIZATIONS,
  OFFLINE_2012_ORG_CANDIDATE_APPLICATIONS,
  OFFLINE_2012_ORG_CANDIDATE_ORGANIZATIONS,
} from "@/historical-2012/confirmed-portfolios-constants";
import type { ConfirmedPortfoliosSidecarResolution } from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";
import {
  claimActualityAssertedForBrowser,
  type HubRegistryDataResolution,
} from "@/lib/registry-application-payload-shared";
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

export type CurrentStateSummaryRow = {
  id: string;
  title: string;
  primary: string;
  secondary?: string;
  tone: "ready" | "partial" | "blocked" | "muted" | "context";
  /** Operator-facing status chip; overrides tone-derived default in the UI. */
  badgeLabel?: string;
};

export type PublicationChecklistItem = {
  id: string;
  label: string;
  status: "complete" | "pending" | "blocked" | "warning";
  detail: string;
};

export type DataHealthSnapshot = {
  catalogVersion: string;
  currentStateSummary: CurrentStateSummaryRow[];
  sourceHealth: SourceHealthRow[];
  intelligenceReadiness: IntelligenceReadinessRow[];
  browserDataState: {
    approved2012Aggregates: { applications: number; uniqueStrings: number; idnApplications: number };
    entityLevel2012InBrowser: boolean;
    entityLevel2012Message: string;
    historical2012PayloadStatus: "not-loaded" | "loaded";
    historical2012CorpusHash?: string;
    historical2012SnapshotId?: string;
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
    checklist: PublicationChecklistItem[];
  };
};

export function humanizeMethodReadiness(readiness: MetricReadiness | string): string {
  if (readiness === "COMPARABLE") return "Comparable method";
  if (readiness === "PARTIAL") return "Partial method";
  if (readiness === "BLOCKED_METHOD") return "Blocked by method";
  if (readiness === "BLOCKED_COVERAGE") return "Blocked by coverage";
  if (readiness === "BLOCKED_SOURCE") return "Blocked by source";
  if (readiness === "NOT_APPLICABLE") return "Not applicable";
  return String(readiness).replaceAll("_", " ").toLowerCase();
}

export function humanizeClaimReadiness(readiness: ClaimReadiness | string): string {
  if (readiness === "REAL_SOURCE_READY") return "Approved source ready";
  if (readiness === "HISTORICAL_ONLY") return "Historical baseline only";
  if (readiness === "REHEARSAL_ONLY") return "Rehearsal fixture only";
  if (readiness === "NOT_PUBLISHED") return "Not published";
  return String(readiness).replaceAll("_", " ").toLowerCase();
}

export function humanizeBrowserPayloadMode(mode: HubRegistryDataResolution["mode"]): string {
  if (mode === "promoted-2026") return "Promoted 2026 payload active";
  return "Rehearsal payload (12-app drill fixture)";
}

export function humanizePayloadSelectionReason(
  reason: HubRegistryDataResolution["selectionReason"],
): string {
  switch (reason) {
    case "rehearsal-default":
      return "Default rehearsal — no promotion env configured";
    case "claim-not-promoted":
      return "2026 claim not promoted — rehearsal fallback";
    case "payload-not-configured":
      return "Promoted claim set but browser payload missing — rehearsal fallback";
    case "snapshot-id-mismatch":
      return "Snapshot id pin mismatch — fail-closed to rehearsal";
    case "content-hash-mismatch":
      return "Content hash pin mismatch — fail-closed to rehearsal";
    case "promoted-active":
      return "Pins match promoted publication — payload active";
    default:
      return reason;
  }
}

function buildCurrentStateSummary(
  claimActuality: ClaimActualityState,
  resolution: HubRegistryDataResolution,
  historical2012: Historical2012PayloadResolution,
  comparableUnlocked: number,
  comparableTotal: number,
): CurrentStateSummaryRow[] {
  const agg = APPROVED_2012_BASELINE;
  const historical2012Loaded = historical2012.status === "loaded";
  const comparisonPrimary =
    comparableUnlocked > 0
      ? `${comparableUnlocked} of ${comparableTotal} comparable metrics unlocked`
      : comparableTotal > 0
        ? "All comparable metrics gated"
        : "No comparable metrics at current method readiness";

  return [
    {
      id: "browser-mode",
      title: "Browser payload mode",
      primary: humanizeBrowserPayloadMode(resolution.mode),
      secondary: resolution.mode,
      tone: resolution.mode === "promoted-2026" ? "ready" : "context",
    },
    {
      id: "2012-aggregates",
      title: "2012 aggregate readiness",
      primary: `Ready — ${agg.applications} apps · ${agg.uniqueStrings} strings · ${agg.idnApplications} IDN (approved baseline wired in UI)`,
      secondary: historical2012Loaded
        ? "Entity browser loaded separately — aggregates unchanged; supports IDN and initial-contention application filtering"
        : "Entity-level 2012 rows not loaded in browser",
      tone: "ready",
      badgeLabel: "Ready",
    },
    {
      id: "2012-entity-browser",
      title: "2012 entity browser",
      primary: historical2012Loaded
        ? `Loaded — ${historical2012.document.applications.length} applications · ${historical2012.document.payloadVersion}`
        : "Not loaded — aggregate-only historical counts",
      secondary: historical2012Loaded
        ? `Corpus ${historical2012.document.corpusContentHash.slice(0, 12)}… · source ${historical2012.document.provenance.inputContentHash.slice(0, 12)}… (offline normalization input)`
        : historical2012.status === "not-loaded"
          ? historical2012.errorMessage
          : ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE,
      tone: historical2012Loaded ? "ready" : "muted",
      badgeLabel: historical2012Loaded ? "Loaded" : "Not loaded",
    },
    {
      id: "2026-publication",
      title: "2026 publication state",
      primary:
        claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY"
          ? "Real 2026 application source promoted"
          : "Not published — rehearsal identity only",
      secondary:
        resolution.selectionReason === "payload-not-configured"
        || resolution.selectionReason === "snapshot-id-mismatch"
        || resolution.selectionReason === "content-hash-mismatch"
          ? humanizePayloadSelectionReason(resolution.selectionReason)
          : claimActuality.round2026ApplicationActuality,
      tone:
        claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY" ? "ready" : "muted",
    },
    {
      id: "cross-round",
      title: "Cross-round comparison",
      primary: comparisonPrimary,
      secondary:
        claimActuality.round2026ApplicationActuality === "NOT_PUBLISHED"
          ? "2026 not published — application-count family remains gated"
          : `${comparableUnlocked}/${comparableTotal} comparable metrics allow cross-round comparison`,
      tone: comparableUnlocked > 0 ? "ready" : "muted",
      badgeLabel: comparableUnlocked > 0 ? undefined : "Gated",
    },
  ];
}

function buildPublicationChecklist(
  claimActuality: ClaimActualityState,
  resolution: HubRegistryDataResolution,
  historical2012: Historical2012PayloadResolution,
  comparableUnlocked: number,
): PublicationChecklistItem[] {
  const historical2012Loaded = historical2012.status === "loaded";
  const actualityComplete = claimActuality.round2026ApplicationActuality === "REAL_SOURCE_READY";
  const payloadComplete = resolution.selectionReason === "promoted-active";
  const payloadWarning =
    resolution.selectionReason === "snapshot-id-mismatch" ||
    resolution.selectionReason === "content-hash-mismatch";

  return [
    {
      id: "actuality",
      label: "2026 application actuality promoted",
      status: actualityComplete ? "complete" : "pending",
      detail: actualityComplete
        ? `Promoted${claimActuality.promotedAt ? ` at ${claimActuality.promotedAt}` : ""} · snapshot ${claimActuality.snapshotId ?? "—"}`
        : "Steward promote-actuality required before real 2026 identity.",
    },
    {
      id: "browser-payload",
      label: "Hash-matched browser application payload",
      status: payloadComplete ? "complete" : payloadWarning ? "warning" : "pending",
      detail: humanizePayloadSelectionReason(resolution.selectionReason),
    },
    {
      id: "org-resolution",
      label: "Organization resolution steward promotion",
      status: "pending",
      detail: `${ORGANIZATION_RESOLUTION_METHOD} — ${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} apps promoted offline; org/portfolio cross-round metrics stay gated.`,
    },
    {
      id: "entity-2012",
      label: "Entity-level 2012 browser payload (Ticket D1)",
      status: historical2012Loaded ? "complete" : "pending",
      detail: historical2012Loaded
        ? `${historical2012.document.applications.length} application rows · ${APPROVED_2012_BASELINE.uniqueStrings} derived strings · Explore ?dataset=2012-historical · hash ${historical2012.document.corpusContentHash.slice(0, 16)}…`
        : historical2012.status === "not-loaded"
          ? historical2012.errorMessage
          : "Configure REGISTRY_HUB_2012_APPLICATION_PAYLOAD_* — no fallback to rehearsal.",
    },
    {
      id: "comparison-unlock",
      label: "Cross-round comparable metrics unlocked",
      status: comparableUnlocked > 0 ? "complete" : actualityComplete ? "pending" : "blocked",
      detail:
        comparableUnlocked > 0
          ? `${comparableUnlocked} metric(s) allow cross-round comparison at current actuality.`
          : "All COMPARABLE metrics remain comparison-gated until publication preconditions are met.",
    },
  ];
}

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
  historical2012: Historical2012PayloadResolution = {
    status: "not-loaded",
    reason: "not-configured",
    errorMessage: ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE,
  },
  confirmedPortfolios: ConfirmedPortfoliosSidecarResolution = {
    status: "not-loaded",
    reason: "not-configured",
    errorMessage: "2012 confirmed portfolio sidecar not configured.",
  },
): SourceHealthRow[] {
  const baseline = APPROVED_2012_BASELINE;
  const doc = resolution.document;
  const historical2012Loaded = historical2012.status === "loaded";
  const confirmedPortfoliosLoaded = confirmedPortfolios.status === "loaded";

  return [
    {
      id: "2012-reveal-csv",
      name: "2012 Reveal Day application source",
      classification: "Historical",
      snapshotOrVersion: `${APPROVED_2012_BASELINE_BUNDLE} · ${baseline.parserVersion}`,
      coverage: `${baseline.applications} applications (offline CSV)`,
      readiness: "Ready",
      limitation: historical2012Loaded
        ? "Entity rows available via dedicated 2012 browser payload — not mixed with 2026 rehearsal."
        : "Browser shows approved aggregate counts only until 2012 payload is configured.",
    },
    {
      id: "2012-contention-pdf",
      name: "2012 contention source",
      classification: "Historical",
      snapshotOrVersion: "icann2012-contention-pdf/1.0.0",
      coverage: `${baseline.contentionMembershipApplications} applications in PDF membership`,
      readiness: "Partial",
      limitation: historical2012Loaded
        ? `Explore initial-contention handoff when the 2012 payload is loaded; set-entity headline blocked (${baseline.extractedContentionSetEntities} extracted vs ${baseline.icannCitedContentionSetEntities} ICANN-cited).`
        : `Set-entity headline blocked (${baseline.extractedContentionSetEntities} extracted vs ${baseline.icannCitedContentionSetEntities} ICANN-cited).`,
    },
    {
      id: "2012-normalized-corpus",
      name: "2012 normalized application corpus",
      classification: historical2012Loaded ? "Browser payload" : "Offline only",
      snapshotOrVersion: historical2012Loaded
        ? `${historical2012.document.payloadVersion} · ${historical2012.document.corpusContentHash.slice(0, 12)}…`
        : baseline.bundleId,
      coverage: historical2012Loaded
        ? `${historical2012.document.applications.length} runtime-loaded Explore rows`
        : `${baseline.applications} observations (CLI normalize + verify)`,
      readiness: historical2012Loaded ? "Ready" : "Browser not loaded",
      limitation: historical2012Loaded
        ? "Generated artifact from offline normalization input — organization/category coverage unchanged."
        : "Configure REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH or _JSON for Explore historical mode.",
    },
    {
      id: "2012-org-promotion",
      name: "2012 organization promotion / resolution",
      classification: "Historical",
      snapshotOrVersion: ORGANIZATION_RESOLUTION_METHOD,
      coverage: confirmedPortfoliosLoaded
        ? `${CONFIRMED_2012_MAPPED_APPLICATION_COUNT} confirmed / ${CONFIRMED_2012_PORTFOLIO_COUNT} orgs · ${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} total promoted · ${OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS} unresolved`
        : `${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} promoted · ${OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS} unresolved`,
      readiness: "Partial",
      limitation: confirmedPortfoliosLoaded
        ? `Explore confirmed portfolios when sidecar loaded; ${OFFLINE_2012_ORG_CANDIDATE_APPLICATIONS} candidate / ${OFFLINE_2012_ORG_AMBIGUOUS_APPLICATIONS} ambiguous apps excluded from browse. Round-wide org counts and concentration remain blocked.`
        : "Round-wide organization counts and portfolio concentration remain blocked.",
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
      limitation:
        resolution.selectionReason === "payload-not-configured"
        || resolution.selectionReason === "snapshot-id-mismatch"
        || resolution.selectionReason === "content-hash-mismatch"
          ? humanizePayloadSelectionReason(resolution.selectionReason)
          : "Real 2026 identity requires steward promote-actuality — not inferred from rehearsal.",
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
          ? "The synthetic rehearsal cohort is not shown as registry intelligence unless Demo / Rehearsal mode is on."
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
  historical2012: Historical2012PayloadResolution = {
    status: "not-loaded",
    reason: "not-configured",
    errorMessage: ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE,
  },
  confirmedPortfolios: ConfirmedPortfoliosSidecarResolution = {
    status: "not-loaded",
    reason: "not-configured",
    errorMessage: "2012 confirmed portfolio sidecar not configured.",
  },
): DataHealthSnapshot {
  const claim = claimActualityAssertedForBrowser(claimActuality, resolution);
  const historical2012Loaded = historical2012.status === "loaded";
  const confirmedPortfoliosLoaded = confirmedPortfolios.status === "loaded";
  const unlock = buildComparisonUnlockReport(claim);
  const comparableTotal = unlock.metrics.filter((m) => m.methodReadiness === "COMPARABLE").length;
  const comparableUnlocked = unlock.metrics.filter((m) => m.comparisonAllowed).length;

  const prerequisites: string[] = [
    "Immutable 2026 publication validated and promoted via reveal-2026 promote-actuality (application actuality only).",
    "Hash-matched browser application payload configured for the promoted snapshot.",
    `${ORGANIZATION_RESOLUTION_METHOD} steward promotion before organization or portfolio cross-round metrics unlock.`,
    historical2012Loaded
      ? "Explore historical mode (D1) active — Compare and org/portfolio unlock remain deferred (D2+)."
      : "Entity-level 2012 browser payload (REGISTRY_HUB_2012_APPLICATION_PAYLOAD_*) before Explore historical rows.",
  ];

  if (claim.round2026ApplicationActuality === "NOT_PUBLISHED") {
    prerequisites.unshift("2026 round remains NOT_PUBLISHED — cross-round COMPARABLE metrics stay gated.");
  }

  return {
    catalogVersion: METRIC_ELIGIBILITY_CATALOG_VERSION,
    currentStateSummary: buildCurrentStateSummary(
      claim,
      resolution,
      historical2012,
      comparableUnlocked,
      comparableTotal,
    ),
    sourceHealth: buildSourceHealthRows(resolution, claim, historical2012, confirmedPortfolios),
    intelligenceReadiness: buildIntelligenceReadinessRows(claim),
    browserDataState: {
      approved2012Aggregates: {
        applications: APPROVED_2012_BASELINE.applications,
        uniqueStrings: APPROVED_2012_BASELINE.uniqueStrings,
        idnApplications: APPROVED_2012_BASELINE.idnApplications,
      },
      entityLevel2012InBrowser: historical2012Loaded,
      entityLevel2012Message: historical2012Loaded
        ? `Historical 2012 entity browser loaded (${historical2012.document.applications.length} applications + ${APPROVED_2012_BASELINE.uniqueStrings} strings derived from the same payload) — Explore ?dataset=2012-historical; 2026 rehearsal remains the default dataset.`
        : ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE,
      historical2012PayloadStatus: historical2012Loaded ? "loaded" : "not-loaded",
      ...(historical2012Loaded
        ? {
            historical2012CorpusHash: historical2012.document.corpusContentHash,
            historical2012SnapshotId: historical2012.document.snapshotId,
          }
        : {}),
      offlineNormalizedCorpus: historical2012Loaded
        ? `Offline normalization (${APPROVED_2012_BASELINE_BUNDLE}) materialized as browser payload ${historical2012.document.corpusContentHash.slice(0, 16)}…${confirmedPortfoliosLoaded ? ` · confirmed portfolio sidecar ${confirmedPortfolios.document.payloadVersion}` : " · org promotion offline unless confirmed portfolio sidecar loaded."}`
        : `Available offline (${APPROVED_2012_BASELINE_BUNDLE}); not loaded in browser entity tables.`,
      browserEntityDataset: resolution.mode === "rehearsal"
        ? "Synthetic rehearsal cohort is withheld from the default product surface. Demo / Rehearsal mode is opt-in."
        : `${resolution.document.applications.length}-record promoted 2026 snapshot (${resolution.document.snapshotId})`,
      real2026Publication:
        claim.round2026ApplicationActuality === "REAL_SOURCE_READY"
          ? "REAL_SOURCE_READY"
          : resolution.selectionReason === "payload-not-configured"
            || resolution.selectionReason === "snapshot-id-mismatch"
            || resolution.selectionReason === "content-hash-mismatch"
            ? "Not published — promoted configuration rejected"
            : "Not published / not promoted",
      rehearsalEntityWarning:
        "Demo / Rehearsal mode uses a synthetic cohort. Those names are not 2012 Reveal Day applicants and are not the default product surface.",
    },
    coverageLimitations: [
      historical2012Loaded
        ? `${APPROVED_2012_BASELINE.applications} applications in approved 2012 baseline — entity rows loaded in Explore historical mode only (not merged with 2026 rehearsal).`
        : `${APPROVED_2012_BASELINE.applications} applications in approved 2012 baseline (aggregate-only in browser).`,
      `Taxonomy ${OFFLINE_2012_TAXONOMY_CLASSIFIED}/${APPROVED_2012_BASELINE.applications} classified — category-mix remains BLOCKED_COVERAGE.`,
      `${APPROVED_2012_BASELINE.contentionMembershipApplications} contention PDF memberships; set count blocked (${APPROVED_2012_BASELINE.extractedContentionSetEntities} vs ${APPROVED_2012_BASELINE.icannCitedContentionSetEntities}).`,
      confirmedPortfoliosLoaded
        ? `Confirmed portfolios: ${CONFIRMED_2012_PORTFOLIO_COUNT} steward-confirmed orgs · ${CONFIRMED_2012_MAPPED_APPLICATION_COUNT} mapped apps; ${OFFLINE_2012_ORG_CANDIDATE_ORGANIZATIONS} candidate / ${OFFLINE_2012_ORG_AMBIGUOUS_ORGANIZATIONS} ambiguous org entities; ${OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS} unresolved applications.`
        : `Organization resolution partial — ${OFFLINE_2012_ORG_PROMOTED_APPLICATIONS} promoted applications (~${Math.round((OFFLINE_2012_ORG_PROMOTED_APPLICATIONS / APPROVED_2012_BASELINE.applications) * 100)}%); no round-wide org rankings.`,
      "Portfolio concentration and round-wide organization metrics stay gated per eligibility catalog.",
    ],
    publicationReadiness: {
      round2026ApplicationActuality: claim.round2026ApplicationActuality,
      claimActualityPromotedAt: claim.promotedAt,
      browserPayloadMode: resolution.mode,
      browserPayloadSelectionReason: resolution.selectionReason,
      comparableMetricsUnlocked: comparableUnlocked,
      comparableMetricsTotal: comparableTotal,
      unlockSummary: `${comparableUnlocked} of ${comparableTotal} COMPARABLE metrics allow cross-round comparison at current actuality.`,
      prerequisites,
      checklist: buildPublicationChecklist(claim, resolution, historical2012, comparableUnlocked),
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
