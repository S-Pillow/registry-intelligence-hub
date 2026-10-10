/**
 * Publication 2.0.0 / contention sidecar promotion CONTRACT.
 *
 * Validates promotion candidates and runs dry-run reports.
 * Does NOT write claim actuality, promotion history, browser payloads, or active config.
 *
 * Actuality (REAL_SOURCE_READY) ≠ metric eligibility (catalog/2.0.0).
 * Application may promote independently of contention; contention fails closed alone.
 */

import { contentHash } from "../normalization/hashes";
import {
  resolveMetricEligibilityWithActuality,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ClaimActualityState,
  type ContentionActualityState,
} from "./claim-actuality";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  contentionSidecarHashInput,
  type ContentionMembershipSnapshotV1,
} from "./contention-membership-types";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026PublicationV2,
} from "./publication-v2-types";
import { validatePublicationV2, validationV2Failed } from "./validate-v2";
import {
  validateContentionMembershipSnapshot,
} from "./validate-contention-membership";

export const PROMOTION_CONTRACT_2X_VERSION = "reveal-day-promotion-contract-2x/1.0.0";

/** Accepted Reveal Day Application identity (pins). Values are validated against artifacts, not hard-substituted. */
export type ApplicationV2PromotionExpectedPins = {
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
  snapshotId: string;
  applicationGraphContentSha256: string;
  rawSha256: string;
  officialAggregatesContentSha256: string;
  coverageDescriptorSha256: string;
  normalizedApplicationRecordsObserved: number;
  officialApplicationCount: number;
  officialApplicantCount: number;
  coverageCompleteness: "partial" | "complete";
  knownExcludedApplicationIds: readonly string[];
};

/** Accepted Reveal Day contention identity (pins). */
export type ContentionPromotionExpectedPins = {
  schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION;
  snapshotId: string;
  sidecarContentSha256: string;
  rawSha256: string;
  applicationGraphContentSha256: string;
  officialContentionSetCount: number;
  joinedMemberCount: number;
};

export type PromotionCandidateStatus = "PROMOTABLE" | "REJECTED";

export type ApplicationV2PromotionCandidateResult = {
  contractVersion: typeof PROMOTION_CONTRACT_2X_VERSION;
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20 | string;
  status: PromotionCandidateStatus;
  errors: string[];
  snapshotId: string | null;
  applicationGraphContentSha256: string | null;
  rawSha256: string | null;
  officialAggregatesContentSha256: string | null;
  coverageDescriptorSha256: string | null;
  coverage: {
    observed: number | null;
    official: number | null;
    completeness: "partial" | "complete" | null;
    knownExcludedApplicationIds: string[];
  };
  /** Candidate actuality if promotion were authorized and applied — never written by this contract. */
  actualityIfApplied: "REAL_SOURCE_READY" | "NOT_PUBLISHED";
  requiresApplicationsLengthEqualsOfficial: false;
  nextStateIfApplied: ClaimActualityState | null;
};

export type ContentionPromotionCandidateResult = {
  contractVersion: typeof PROMOTION_CONTRACT_2X_VERSION;
  schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION | string;
  status: PromotionCandidateStatus;
  errors: string[];
  snapshotId: string | null;
  sidecarContentSha256: string | null;
  rawSha256: string | null;
  applicationPublicationPinHash: string | null;
  actualityIfApplied: "REAL_SOURCE_READY" | "NOT_PUBLISHED";
  nextStateIfApplied: ContentionActualityState | null;
};

export type MetricEligibilityDryRunSlice = {
  metricId: string;
  claimReadiness2026: string;
  methodReadiness: string;
  comparisonAllowed: boolean;
  sourceChannel?: string;
  crossRoundStatus?: string;
};

export type RevealDayPromotion2xDryRunReport = {
  reportVersion: "reveal-day-promotion-2x-dry-run/1.0.0";
  contractVersion: typeof PROMOTION_CONTRACT_2X_VERSION;
  actualPromotionPerformed: false;
  activeStateMutation: false;
  browserProjectionGenerated: false;
  application: ApplicationV2PromotionCandidateResult;
  contention: ContentionPromotionCandidateResult | null;
  /** Application candidate remains valid even when contention is rejected/absent. */
  applicationIndependentOfContention: true;
  metricsAfterApplicationActualityIfApplied: MetricEligibilityDryRunSlice[];
  summary: {
    application: PromotionCandidateStatus | "ABSENT";
    contention: PromotionCandidateStatus | "ABSENT";
    uniqueStrings: "STILL_BLOCKED" | "UNEXPECTED";
    organizations: "STILL_BLOCKED" | "UNEXPECTED";
    returningNew: "STILL_BLOCKED" | "UNEXPECTED";
    category: "STILL_BLOCKED" | "UNEXPECTED";
  };
};

function recomputeAggregatePin(publication: Registry2026PublicationV2): string {
  return contentHash(publication.officialAggregates);
}

function recomputeCoveragePin(publication: Registry2026PublicationV2): string {
  return contentHash(publication.coverage);
}

function recomputeApplicationGraphPin(publication: Registry2026PublicationV2): string {
  return contentHash(applicationGraphHashInput(publication));
}

function recomputeContentionSidecarPin(snapshot: ContentionMembershipSnapshotV1): string {
  return contentHash(contentionSidecarHashInput(snapshot));
}

/**
 * Validate a registry-2026-publication/2.0.0 promotion candidate.
 * Fail-closed on pin/hash/coverage mismatches. Never requires applications.length === official count.
 */
export function evaluateApplicationPublicationV2PromotionCandidate(
  publication: Registry2026PublicationV2,
  expected?: Partial<ApplicationV2PromotionExpectedPins>,
  current: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
): ApplicationV2PromotionCandidateResult {
  const errors: string[] = [];

  if (publication.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    errors.push(`schemaVersion must be ${PUBLICATION_SCHEMA_VERSION_V20}`);
  }
  if (publication.publicationKind !== "immutable-publication") {
    errors.push("publicationKind must be immutable-publication");
  }

  const structural = validatePublicationV2(publication);
  if (validationV2Failed(structural.issues)) {
    errors.push(
      ...structural.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`),
    );
  }

  const graphHash = recomputeApplicationGraphPin(publication);
  const aggregateHash = recomputeAggregatePin(publication);
  const coverageHash = recomputeCoveragePin(publication);
  const rawSha = publication.lineage?.rawSha256 ?? null;

  if (publication.bundleManifest.applicationGraphContentSha256 !== graphHash) {
    errors.push(
      `application graph content hash mismatch: manifest=${publication.bundleManifest.applicationGraphContentSha256} recomputed=${graphHash}`,
    );
  }
  if (publication.bundleManifest.officialAggregatesContentSha256 !== aggregateHash) {
    errors.push(
      `official aggregate pin mismatch: manifest=${publication.bundleManifest.officialAggregatesContentSha256} recomputed=${aggregateHash}`,
    );
  }
  if (publication.bundleManifest.coverageDescriptorSha256 !== coverageHash) {
    errors.push(
      `coverage descriptor pin mismatch: manifest=${publication.bundleManifest.coverageDescriptorSha256} recomputed=${coverageHash}`,
    );
  }
  if (!rawSha || !/^[0-9a-f]{64}$/.test(rawSha)) {
    errors.push("lineage.rawSha256 missing or invalid");
  }

  const observed = publication.coverage.normalizedApplicationRecordsObserved;
  const official = publication.officialAggregates.officialApplicationCount;
  const completeness = publication.coverage.applicationRecordCoverage.completeness;
  const excluded = publication.coverage.applicationRecordCoverage.knownExcludedRecords.map((r) => r.applicationId);

  if (observed !== publication.applications.length) {
    errors.push(
      `coverage.normalizedApplicationRecordsObserved (${observed}) must equal applications.length (${publication.applications.length})`,
    );
  }
  // Explicit non-requirement: never demand applications.length === officialApplicationCount.
  if (completeness === "partial") {
    if (observed === official) {
      errors.push("partial coverage claimed but observed equals official application count");
    }
    if (excluded.length > 0 && observed >= official) {
      errors.push("partial coverage with knownExcludedRecords must keep observed below official application count");
    }
    if (excluded.length === 0 && observed >= official) {
      errors.push("partial coverage requires knownExcludedRecords or observed < official");
    }
  }

  if (expected?.schemaVersion && publication.schemaVersion !== expected.schemaVersion) {
    errors.push(`expected schemaVersion ${expected.schemaVersion}`);
  }
  if (expected?.snapshotId && publication.snapshotId !== expected.snapshotId) {
    errors.push(`snapshotId mismatch: got ${publication.snapshotId}, expected ${expected.snapshotId}`);
  }
  if (expected?.applicationGraphContentSha256 && graphHash !== expected.applicationGraphContentSha256) {
    errors.push(
      `application content hash rejected: got ${graphHash}, expected ${expected.applicationGraphContentSha256}`,
    );
  }
  if (expected?.rawSha256 && rawSha !== expected.rawSha256) {
    errors.push(`application raw SHA rejected: got ${rawSha}, expected ${expected.rawSha256}`);
  }
  if (expected?.officialAggregatesContentSha256 && aggregateHash !== expected.officialAggregatesContentSha256) {
    errors.push(
      `aggregate pin rejected: got ${aggregateHash}, expected ${expected.officialAggregatesContentSha256}`,
    );
  }
  if (expected?.coverageDescriptorSha256 && coverageHash !== expected.coverageDescriptorSha256) {
    errors.push(
      `coverage pin rejected: got ${coverageHash}, expected ${expected.coverageDescriptorSha256}`,
    );
  }
  if (
    expected?.normalizedApplicationRecordsObserved !== undefined
    && observed !== expected.normalizedApplicationRecordsObserved
  ) {
    errors.push(
      `observed application count mismatch: got ${observed}, expected ${expected.normalizedApplicationRecordsObserved}`,
    );
  }
  if (
    expected?.officialApplicationCount !== undefined
    && official !== expected.officialApplicationCount
  ) {
    errors.push(
      `official application count mismatch: got ${official}, expected ${expected.officialApplicationCount}`,
    );
  }
  if (
    expected?.officialApplicantCount !== undefined
    && publication.officialAggregates.officialApplicantCount !== expected.officialApplicantCount
  ) {
    errors.push(
      `official applicant count mismatch: got ${publication.officialAggregates.officialApplicantCount}, expected ${expected.officialApplicantCount}`,
    );
  }
  if (expected?.coverageCompleteness && completeness !== expected.coverageCompleteness) {
    errors.push(`coverage completeness mismatch: got ${completeness}, expected ${expected.coverageCompleteness}`);
  }
  if (expected?.knownExcludedApplicationIds) {
    for (const id of expected.knownExcludedApplicationIds) {
      if (!excluded.includes(id)) {
        errors.push(`known excluded application missing: ${id}`);
      }
    }
  }

  const ok = errors.length === 0;
  void current;
  const nextStateIfApplied: ClaimActualityState | null = ok
    ? {
        version: DEFAULT_CLAIM_ACTUALITY_STATE.version,
        round2026ApplicationActuality: "REAL_SOURCE_READY",
        promotedAt: null, // dry-run / candidate only — never stamped here
        snapshotId: publication.snapshotId,
        snapshotContentHash: graphHash,
        rawSha256: rawSha,
        stewardApprovalId: null,
        productApprovalId: null,
        promotionGates: {
          snapshotValidated: true,
          parserPassed: true,
          normalizationPassed: true,
          provenanceRecorded: Boolean(publication.source?.name && publication.source?.url),
          validationPassed: true,
          contaminationClear: true,
        },
      }
    : null;

  return {
    contractVersion: PROMOTION_CONTRACT_2X_VERSION,
    schemaVersion: publication.schemaVersion,
    status: ok ? "PROMOTABLE" : "REJECTED",
    errors,
    snapshotId: publication.snapshotId,
    applicationGraphContentSha256: graphHash,
    rawSha256: rawSha,
    officialAggregatesContentSha256: aggregateHash,
    coverageDescriptorSha256: coverageHash,
    coverage: {
      observed,
      official,
      completeness,
      knownExcludedApplicationIds: excluded,
    },
    actualityIfApplied: ok ? "REAL_SOURCE_READY" : "NOT_PUBLISHED",
    requiresApplicationsLengthEqualsOfficial: false,
    nextStateIfApplied,
  };
}

/**
 * Validate official contention sidecar promotion independently of Application actuality write.
 * Requires exact Application publication pin match (hash identity), not Application actuality state.
 */
export function evaluateContentionMembershipPromotionCandidate(
  sidecar: ContentionMembershipSnapshotV1,
  applicationGraphContentSha256: string,
  expected?: Partial<ContentionPromotionExpectedPins>,
): ContentionPromotionCandidateResult {
  const errors: string[] = [];

  const structural = validateContentionMembershipSnapshot(sidecar);
  if (structural.issues.some((i) => i.severity === "error")) {
    errors.push(
      ...structural.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`),
    );
  }

  if (sidecar.schemaVersion !== CONTENTION_MEMBERSHIP_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CONTENTION_MEMBERSHIP_SCHEMA_VERSION}`);
  }

  const sidecarHash = recomputeContentionSidecarPin(sidecar);
  const rawSha = sidecar.lineage?.rawSha256 ?? sidecar.bundleManifest.rawSourceSha256;
  const pinHash = sidecar.applicationPublicationPin.applicationGraphContentSha256;

  if (sidecar.bundleManifest.sidecarContentSha256 !== sidecarHash) {
    errors.push(
      `contention semantic hash mismatch: manifest=${sidecar.bundleManifest.sidecarContentSha256} recomputed=${sidecarHash}`,
    );
  }
  if (sidecar.bundleManifest.rawSourceSha256 !== rawSha) {
    errors.push("contention raw source hash inconsistent between lineage and bundleManifest");
  }
  if (pinHash !== applicationGraphContentSha256) {
    errors.push(
      `contention Application pin rejected: sidecar pin=${pinHash}, active application graph=${applicationGraphContentSha256}`,
    );
  }
  if (sidecar.applicationPublicationPin.applicationGraphContentSha256 !== applicationGraphContentSha256) {
    errors.push("applicationPublicationPin.applicationGraphContentSha256 must match active Application publication");
  }

  if (expected?.schemaVersion && sidecar.schemaVersion !== expected.schemaVersion) {
    errors.push(`expected schemaVersion ${expected.schemaVersion}`);
  }
  if (expected?.snapshotId && sidecar.snapshotId !== expected.snapshotId) {
    errors.push(`contention snapshotId mismatch: got ${sidecar.snapshotId}, expected ${expected.snapshotId}`);
  }
  if (expected?.sidecarContentSha256 && sidecarHash !== expected.sidecarContentSha256) {
    errors.push(
      `contention semantic hash rejected: got ${sidecarHash}, expected ${expected.sidecarContentSha256}`,
    );
  }
  if (expected?.rawSha256 && rawSha !== expected.rawSha256) {
    errors.push(`contention raw SHA rejected: got ${rawSha}, expected ${expected.rawSha256}`);
  }
  if (expected?.applicationGraphContentSha256 && pinHash !== expected.applicationGraphContentSha256) {
    errors.push(
      `contention Application pin rejected: got ${pinHash}, expected ${expected.applicationGraphContentSha256}`,
    );
  }
  if (
    expected?.officialContentionSetCount !== undefined
    && sidecar.quality.officialContentionSetCount !== expected.officialContentionSetCount
  ) {
    errors.push(
      `officialContentionSetCount mismatch: got ${sidecar.quality.officialContentionSetCount}, expected ${expected.officialContentionSetCount}`,
    );
  }
  if (
    expected?.joinedMemberCount !== undefined
    && sidecar.quality.joinedMemberCount !== expected.joinedMemberCount
  ) {
    errors.push(
      `joinedMemberCount mismatch: got ${sidecar.quality.joinedMemberCount}, expected ${expected.joinedMemberCount}`,
    );
  }

  const ok = errors.length === 0;
  const nextStateIfApplied: ContentionActualityState | null = ok
    ? {
        round2026ContentionActuality: "REAL_SOURCE_READY",
        snapshotId: sidecar.snapshotId,
        sidecarContentHash: sidecarHash,
        rawSha256: rawSha,
        applicationPublicationPinHash: pinHash,
      }
    : null;

  return {
    contractVersion: PROMOTION_CONTRACT_2X_VERSION,
    schemaVersion: sidecar.schemaVersion,
    status: ok ? "PROMOTABLE" : "REJECTED",
    errors,
    snapshotId: sidecar.snapshotId,
    sidecarContentSha256: sidecarHash,
    rawSha256: rawSha,
    applicationPublicationPinHash: pinHash,
    actualityIfApplied: ok ? "REAL_SOURCE_READY" : "NOT_PUBLISHED",
    nextStateIfApplied,
  };
}

const METRIC_PROBE_IDS = [
  "application-count",
  "observed-application-records",
  "applicant-count",
  "unique-applied-strings",
  "idn-applications",
  "organization-round-count",
  "returning-participant-identity",
  "returning-delegated-operator",
  "category-mix",
  "exact-applied-string-competition",
  "initial-contention-sets",
  "initial-contention-memberships",
] as const;

function metricSlice(
  metricId: string,
  appState: ClaimActualityState,
  contentionState: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
): MetricEligibilityDryRunSlice {
  const resolved = resolveMetricEligibilityWithActuality(metricId, appState, contentionState);
  return {
    metricId,
    claimReadiness2026: resolved?.claimReadiness.round2026 ?? "NOT_PUBLISHED",
    methodReadiness: resolved?.methodReadiness ?? "NOT_APPLICABLE",
    comparisonAllowed: resolved?.comparisonAllowed ?? false,
    sourceChannel: resolved?.sourceChannel,
    crossRoundStatus: resolved?.crossRoundStatus,
  };
}

function blockedLabel(
  slice: MetricEligibilityDryRunSlice | undefined,
  predicate: (s: MetricEligibilityDryRunSlice) => boolean,
): "STILL_BLOCKED" | "UNEXPECTED" {
  if (!slice) return "UNEXPECTED";
  return predicate(slice) ? "STILL_BLOCKED" : "UNEXPECTED";
}

/**
 * Deterministic dry-run: proves Application (± contention) candidates are promotable
 * without mutating active claim actuality or generating browser projection.
 */
export function runRevealDayPromotion2xDryRun(input: {
  publication: Registry2026PublicationV2;
  contention?: ContentionMembershipSnapshotV1 | null;
  expectedApplication?: Partial<ApplicationV2PromotionExpectedPins>;
  expectedContention?: Partial<ContentionPromotionExpectedPins>;
  /** When provided without a sidecar, proves Application-only path. */
  applicationOnly?: boolean;
}): RevealDayPromotion2xDryRunReport {
  const application = evaluateApplicationPublicationV2PromotionCandidate(
    input.publication,
    input.expectedApplication,
  );

  let contention: ContentionPromotionCandidateResult | null = null;
  if (input.contention) {
    const appPin =
      application.applicationGraphContentSha256
      ?? input.publication.bundleManifest.applicationGraphContentSha256;
    contention = evaluateContentionMembershipPromotionCandidate(
      input.contention,
      appPin,
      input.expectedContention,
    );
  }

  const appStateIfApplied =
    application.nextStateIfApplied
    && application.status === "PROMOTABLE"
      ? {
          ...application.nextStateIfApplied,
          // Eligibility probes need REAL_SOURCE_READY flag set (promotedAt stays null in dry-run).
          round2026ApplicationActuality: "REAL_SOURCE_READY" as const,
        }
      : DEFAULT_CLAIM_ACTUALITY_STATE;

  const contentionStateIfApplied =
    contention?.status === "PROMOTABLE" && contention.nextStateIfApplied
      ? contention.nextStateIfApplied
      : DEFAULT_CONTENTION_ACTUALITY_STATE;

  const metrics = METRIC_PROBE_IDS.map((id) =>
    metricSlice(id, appStateIfApplied, contentionStateIfApplied),
  );
  const byId = new Map(metrics.map((m) => [m.metricId, m]));

  const unique = byId.get("unique-applied-strings");
  const org = byId.get("organization-round-count");
  const returning = byId.get("returning-participant-identity");
  const category = byId.get("category-mix");

  return {
    reportVersion: "reveal-day-promotion-2x-dry-run/1.0.0",
    contractVersion: PROMOTION_CONTRACT_2X_VERSION,
    actualPromotionPerformed: false,
    activeStateMutation: false,
    browserProjectionGenerated: false,
    application,
    contention,
    applicationIndependentOfContention: true,
    metricsAfterApplicationActualityIfApplied: metrics,
    summary: {
      application: application.status,
      contention: contention ? contention.status : "ABSENT",
      uniqueStrings: blockedLabel(
        unique,
        (s) =>
          s.claimReadiness2026 !== "REAL_SOURCE_READY"
          && (s.methodReadiness === "BLOCKED_COVERAGE" || !s.comparisonAllowed),
      ),
      organizations: blockedLabel(
        org,
        (s) => s.methodReadiness === "BLOCKED_SOURCE" && s.claimReadiness2026 !== "REAL_SOURCE_READY",
      ),
      returningNew: blockedLabel(
        returning,
        (s) => s.methodReadiness === "BLOCKED_SOURCE" && s.claimReadiness2026 !== "REAL_SOURCE_READY",
      ),
      category: blockedLabel(
        category,
        (s) => s.methodReadiness === "BLOCKED_SOURCE" && s.claimReadiness2026 !== "REAL_SOURCE_READY",
      ),
    },
  };
}

/**
 * @deprecated RIH-ACTIVATION-2X-1 authorizes writes via evaluateApplicationPublicationV2ActualityPromotion.
 * Kept for test discovery; always points operators at the activation write path.
 */
export function refuseActualApplicationV2Promotion(): {
  ok: false;
  errors: string[];
} {
  return {
    ok: false,
    errors: [
      "Use evaluateApplicationPublicationV2ActualityPromotion / CLI promote-actuality for registry-2026-publication/2.0.0 (requires steward + product approvals). dry-run-promotion-2x never writes.",
    ],
  };
}
