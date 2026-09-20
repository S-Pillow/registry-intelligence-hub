import type { ClaimReadiness } from "../comparison/claim-readiness";
import { METRIC_ELIGIBILITY_CATALOG } from "../comparison/metric-eligibility-catalog";
import { resolveMetricEligibility } from "../comparison/metric-eligibility";
import type { DryRunDiagnostics } from "./types";
import { CLAIM_ACTUALITY_STATE_VERSION } from "./types";
import { isRehearsalPublication } from "./validate";
import type { Registry2026PublicationSnapshot } from "./types";
import type { HumanApprovalResult } from "./human-approval";
import { PUBLICATION_SCHEMA_VERSION_V11 } from "./types";

/** Metrics whose 2026 claim readiness may advance with immutable application publication only. */
export const APPLICATION_ACTUALITY_METRIC_IDS = [
  "application-count",
  "unique-applied-strings",
  "idn-applications",
] as const;

export type ApplicationActualityPromotion = typeof APPLICATION_ACTUALITY_METRIC_IDS[number];

export type ClaimActualityState = {
  version: typeof CLAIM_ACTUALITY_STATE_VERSION;
  round2026ApplicationActuality: "NOT_PUBLISHED" | "REAL_SOURCE_READY";
  promotedAt: string | null;
  snapshotId: string | null;
  snapshotContentHash: string | null;
  rawSha256: string | null;
  stewardApprovalId: string | null;
  productApprovalId: string | null;
  promotionGates: {
    snapshotValidated: boolean;
    parserPassed: boolean;
    normalizationPassed: boolean;
    provenanceRecorded: boolean;
    validationPassed: boolean;
    contaminationClear: boolean;
  };
};

export const DEFAULT_CLAIM_ACTUALITY_STATE: ClaimActualityState = {
  version: CLAIM_ACTUALITY_STATE_VERSION,
  round2026ApplicationActuality: "NOT_PUBLISHED",
  promotedAt: null,
  snapshotId: null,
  snapshotContentHash: null,
  rawSha256: null,
  stewardApprovalId: null,
  productApprovalId: null,
  promotionGates: {
    snapshotValidated: false,
    parserPassed: false,
    normalizationPassed: false,
    provenanceRecorded: false,
    validationPassed: false,
    contaminationClear: false,
  },
};

export function effectiveRound2026ClaimReadiness(
  metricId: string,
  catalogDefault: ClaimReadiness,
  state: ClaimActualityState,
): ClaimReadiness {
  if (
    state.round2026ApplicationActuality === "REAL_SOURCE_READY"
    && (APPLICATION_ACTUALITY_METRIC_IDS as readonly string[]).includes(metricId)
  ) {
    return "REAL_SOURCE_READY";
  }
  return catalogDefault;
}

export function resolveMetricEligibilityWithActuality(
  metricId: string,
  state: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
) {
  const base = resolveMetricEligibility(metricId);
  if (!base) return undefined;
  const round2026 = effectiveRound2026ClaimReadiness(metricId, base.claimReadiness.round2026, state);
  const comparisonAllowed =
    base.methodReadiness === "COMPARABLE"
    && base.claimReadiness.round2012 === "REAL_SOURCE_READY"
    && round2026 === "REAL_SOURCE_READY";
  return {
    ...base,
    claimReadiness: {
      round2012: base.claimReadiness.round2012,
      round2026,
    },
    comparisonAllowed,
  };
}

export type PromotionGateResult = {
  ok: boolean;
  errors: string[];
  nextState: ClaimActualityState;
};

export function evaluateApplicationActualityPromotion(
  snapshot: Registry2026PublicationSnapshot,
  diagnostics: DryRunDiagnostics,
  current: ClaimActualityState,
  humanApproval?: HumanApprovalResult,
): PromotionGateResult {
  const errors: string[] = [];

  if (isRehearsalPublication(snapshot)) {
    errors.push("Rehearsal publication cannot be promoted to REAL_SOURCE_READY (contamination guard)");
  }
  if (snapshot.publicationKind !== "immutable-publication") {
    errors.push(`publicationKind must be immutable-publication (got ${snapshot.publicationKind})`);
  }
  if (snapshot.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V11 || !snapshot.lineage) {
    errors.push(
      "Promotion requires registry-2026-publication/1.1.0 with explicit raw-byte lineage — never promote hand-edited JSON",
    );
  }
  if (humanApproval && !humanApproval.ok) {
    errors.push(...humanApproval.errors);
  } else if (!humanApproval) {
    errors.push("Human steward and product approvals are required before promote-actuality");
  }
  if (!diagnostics.validation.ok) {
    errors.push("Validation gate failed — resolve validation errors before promotion");
  }
  if (diagnostics.normalization.unresolvedFieldCount > 0) {
    errors.push(
      `Normalization has ${diagnostics.normalization.unresolvedFieldCount} unresolved field(s) — promotion blocked`,
    );
  }
  if (!diagnostics.provenance.sourceName || !diagnostics.provenance.sourceUrl) {
    errors.push("Provenance incomplete — source name and URL required");
  }

  const gates = {
    snapshotValidated: true,
    parserPassed: diagnostics.methodVersions.parser === snapshot.parserVersion,
    normalizationPassed: diagnostics.normalization.unresolvedFieldCount === 0,
    provenanceRecorded: Boolean(diagnostics.provenance.sourceName && diagnostics.provenance.sourceUrl),
    validationPassed: diagnostics.validation.ok,
    contaminationClear: !diagnostics.contaminationCheck.blockedForRealPromotion,
  };

  if (!gates.parserPassed) errors.push("Parser version mismatch between snapshot and diagnostics");
  if (!gates.contaminationClear) errors.push("Contamination check failed");

  const ok = errors.length === 0;
  const rawSha256 = snapshot.lineage?.rawSha256 ?? null;

  const nextState: ClaimActualityState = ok
    ? {
        version: CLAIM_ACTUALITY_STATE_VERSION,
        round2026ApplicationActuality: "REAL_SOURCE_READY",
        promotedAt: new Date().toISOString(),
        snapshotId: diagnostics.snapshotId,
        snapshotContentHash: diagnostics.snapshotContentHash,
        rawSha256,
        stewardApprovalId: humanApproval?.stewardApprovalId ?? null,
        productApprovalId: humanApproval?.productApprovalId ?? null,
        promotionGates: gates,
      }
    : {
        ...current,
        promotionGates: gates,
      };

  return { ok, errors, nextState };
}

export function organizationMetricsRemainGatedAfterApplicationPromotion(state: ClaimActualityState): boolean {
  if (state.round2026ApplicationActuality !== "REAL_SOURCE_READY") return true;
  const orgMetrics = METRIC_ELIGIBILITY_CATALOG.filter((e) =>
    e.metricId.includes("organization") || e.metricId.includes("portfolio"),
  );
  return orgMetrics.every((entry) => {
    const resolved = resolveMetricEligibilityWithActuality(entry.metricId, state);
    return resolved?.claimReadiness.round2026 !== "REAL_SOURCE_READY" || !resolved.comparisonAllowed;
  });
}
