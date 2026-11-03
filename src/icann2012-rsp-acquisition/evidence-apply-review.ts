/**
 * Offline historical RSP evidence-apply-review operator.
 *
 * Mechanically applies an external human approval packet against a steward
 * promotion-readiness review + candidate extraction. Zero HTTP. Never decides
 * approval itself. Never mutates extraction/review inputs.
 */
import { open, readFile, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import {
  assertHistoricalRspEvidenceApprovalPacket,
  type HistoricalRspEvidenceApprovalDecision,
  type HistoricalRspEvidenceApprovalPacket,
} from "./historical-rsp-evidence-approval";
import {
  buildHistoricalRspApprovedEvidenceArtifact,
  serializeHistoricalRspApprovedEvidence,
} from "./historical-rsp-approved-evidence";
import type { HistoricalRspEvidenceCandidate } from "./historical-rsp-evidence-candidate";
import {
  HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION,
} from "./historical-rsp-evidence-candidate";

export const EVIDENCE_APPLY_REVIEW_RECEIPT_VERSION =
  "registry-hub-rsp-evidence-apply-review-receipt/1.0.0" as const;

/** Exact wrapper version this operator accepts for pilot Q23 extractions. */
export const PILOT_Q23_EXTRACTION_WRAPPER_SCHEMA_VERSION =
  "rih-2012-rsp-pilot-q23-extraction/1.0.0" as const;

/** Exact wrapper version this operator accepts for promotion-readiness reviews. */
export const PILOT_PROMOTION_READINESS_REVIEW_WRAPPER_SCHEMA_VERSION =
  "rih-2012-rsp-pilot-promotion-readiness-review/1.0.0" as const;

export type EvidenceApplyReviewOutcome =
  | "APPROVED"
  | "HOLD_NO_PROMOTION"
  | "REJECT_NO_PROMOTION"
  | "APPROVE_REJECTED";

export interface EvidenceRowReconciliationResult {
  ok: boolean;
  extractionCandidateCount: number;
  reviewedCandidateCount: number;
  matchedCount: number;
  duplicateExtractionIdentities: string[];
  duplicateReviewIdentities: string[];
  unreviewedExtractionIdentities: string[];
  phantomReviewIdentities: string[];
  errors: string[];
}

export interface EvidenceApplicationReadinessReconciliationResult {
  ok: boolean;
  expectedCandidateBearingApplicationCount: number;
  readinessEntryCount: number;
  missingApplicationIds: string[];
  duplicateApplicationIds: string[];
  phantomApplicationIds: string[];
  candidateRowCountMismatches: Array<{
    applicationId: string;
    expected: number;
    actual: number;
  }>;
  notReadyApplicationIds: string[];
  readyApplicationCount: number;
  errors: string[];
}

export interface EvidenceApplyReviewReceipt {
  receiptVersion: typeof EVIDENCE_APPLY_REVIEW_RECEIPT_VERSION;
  sourceExtractionPath: string;
  sourceExtractionSha256: string;
  stewardReviewPath: string;
  stewardReviewSha256: string;
  approvalPacketPath: string;
  approvalPacketSha256: string;
  decision: HistoricalRspEvidenceApprovalDecision;
  reviewer: string;
  reviewedAt: string;
  extractionCandidateCount: number;
  reviewedCandidateCount: number;
  readyApplicationCount: number;
  rowReconciliation: EvidenceRowReconciliationResult;
  applicationReadinessReconciliation: EvidenceApplicationReadinessReconciliationResult;
  mechanicalEligibility: boolean;
  outcome: EvidenceApplyReviewOutcome;
  approvedOutputPath: string | null;
  approvedOutputSha256: string | null;
  extractionUnchanged: boolean;
  reviewUnchanged: boolean;
  approvalPacketUnchanged: boolean;
  networkRequests: 0;
  rejectReasons: string[];
}

export interface EvidenceApplyReviewOptions {
  extractionPath: string;
  stewardReviewPath: string;
  approvalPacketPath: string;
  outputPath: string;
  /**
   * Test-only: run immediately before exclusive write after pre-write rehash.
   * CLI never sets this.
   */
  testBeforeExclusiveWrite?: () => Promise<void>;
}

export class EvidenceApplyReviewError extends Error {
  readonly receipt: EvidenceApplyReviewReceipt | null;

  constructor(message: string, receipt: EvidenceApplyReviewReceipt | null = null) {
    super(message);
    this.name = "EvidenceApplyReviewError";
    this.receipt = receipt;
  }
}

const PROHIBITED_IDENTITY_KEYS = [
  "rspKey",
  "normalizedProviderId",
  "normalizedProviderKey",
  "canonicalProviderId",
  "canonicalProviderIdentity",
  "lineageId",
  "corporateLineageId",
  "portfolioCount",
  "confirmedRelationship",
] as const;

type ExtractionResultDoc = {
  applicationId: string | null;
  candidates: HistoricalRspEvidenceCandidate[];
};

type PilotExtractionArtifact = {
  schemaVersion: string;
  artifactPurpose: string;
  reviewState: string;
  extractionToolingSha?: string;
  deterministicPayloadHash?: string;
  sourceDocumentCount?: number;
  totalCandidateCount?: number;
  results: ExtractionResultDoc[];
};

type StewardReviewRow = {
  applicationId: string;
  sourceFieldPath: string;
  providerNameAsStated: string;
  roleAsStated?: string | null;
  evidenceLocator: string;
  stewardReviewClassification: string;
  evidenceClassification?: string;
  applicationVersionBasis?: string;
};

type StewardApplicationReadiness = {
  applicationId: string;
  applicationPromotionReadiness: string;
  candidateRowCount: number;
};

type PilotStewardReviewArtifact = {
  schemaVersion: string;
  artifactPurpose: string;
  reviewState: string;
  sourceExtractionArtifactSha256: string;
  candidateRowCount?: number;
  candidateBearingApplicationCount?: number;
  rowClassificationCounts?: Record<string, number>;
  applicationPromotionReadinessCounts?: Record<string, number>;
  rows: StewardReviewRow[];
  applicationLevelReadiness: StewardApplicationReadiness[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roleIdentity(role: string | null | undefined): string {
  return role == null ? "" : role;
}

/** Deterministic material evidence identity — not array position. */
export function evidenceRowIdentity(input: {
  applicationId: string;
  sourceFieldPath: string;
  providerNameAsStated: string;
  evidenceLocator: string;
  roleAsStated?: string | null;
}): string {
  return [
    input.applicationId,
    input.sourceFieldPath,
    input.providerNameAsStated,
    input.evidenceLocator,
    roleIdentity(input.roleAsStated),
  ].join("\u0001");
}

function collectProhibitedIdentityFields(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...collectProhibitedIdentityFields(item, `${path}[${i}]`)));
    return hits;
  }
  if (!isPlainObject(value)) return hits;
  for (const [key, child] of Object.entries(value)) {
    if ((PROHIBITED_IDENTITY_KEYS as readonly string[]).includes(key)) {
      hits.push(`${path}.${key}`);
    }
    hits.push(...collectProhibitedIdentityFields(child, `${path}.${key}`));
  }
  return hits;
}

function assertNoProhibitedIdentityFields(doc: unknown, label: string): string[] {
  return collectProhibitedIdentityFields(doc).map((p) => `${label} contains prohibited field ${p}`);
}

function parsePilotExtractionArtifact(doc: unknown): PilotExtractionArtifact {
  if (!isPlainObject(doc)) {
    throw new EvidenceApplyReviewError("Extraction artifact must be a JSON object");
  }
  if (doc.schemaVersion !== PILOT_Q23_EXTRACTION_WRAPPER_SCHEMA_VERSION) {
    throw new EvidenceApplyReviewError(
      `Extraction wrapper schema rejected (fail closed): expected ${PILOT_Q23_EXTRACTION_WRAPPER_SCHEMA_VERSION}, got ${String(doc.schemaVersion)}`,
    );
  }
  if (doc.artifactPurpose !== "EVIDENCE") {
    throw new EvidenceApplyReviewError(
      `Extraction lifecycle rejected: expected artifactPurpose=EVIDENCE, got ${String(doc.artifactPurpose)}`,
    );
  }
  if (doc.reviewState !== "REQUIRES_STEWARD_REVIEW") {
    throw new EvidenceApplyReviewError(
      `Extraction lifecycle rejected: expected reviewState=REQUIRES_STEWARD_REVIEW, got ${String(doc.reviewState)}`,
    );
  }
  if (!Array.isArray(doc.results)) {
    throw new EvidenceApplyReviewError("Extraction artifact missing results[]");
  }
  return doc as unknown as PilotExtractionArtifact;
}

function parseStewardReviewArtifact(doc: unknown): PilotStewardReviewArtifact {
  if (!isPlainObject(doc)) {
    throw new EvidenceApplyReviewError("Steward review artifact must be a JSON object");
  }
  if (doc.schemaVersion !== PILOT_PROMOTION_READINESS_REVIEW_WRAPPER_SCHEMA_VERSION) {
    throw new EvidenceApplyReviewError(
      `Steward review wrapper schema rejected (fail closed): expected ${PILOT_PROMOTION_READINESS_REVIEW_WRAPPER_SCHEMA_VERSION}, got ${String(doc.schemaVersion)}`,
    );
  }
  if (doc.artifactPurpose !== "REVIEW") {
    throw new EvidenceApplyReviewError(
      `Steward review lifecycle rejected: expected artifactPurpose=REVIEW, got ${String(doc.artifactPurpose)}`,
    );
  }
  if (doc.reviewState !== "DRAFT") {
    throw new EvidenceApplyReviewError(
      `Steward review lifecycle rejected: expected reviewState=DRAFT, got ${String(doc.reviewState)}`,
    );
  }
  if (
    typeof doc.sourceExtractionArtifactSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(doc.sourceExtractionArtifactSha256)
  ) {
    throw new EvidenceApplyReviewError(
      "Steward review missing/invalid sourceExtractionArtifactSha256",
    );
  }
  if (!Array.isArray(doc.rows)) {
    throw new EvidenceApplyReviewError("Steward review missing rows[]");
  }
  if (!Array.isArray(doc.applicationLevelReadiness)) {
    throw new EvidenceApplyReviewError("Steward review missing applicationLevelReadiness[]");
  }
  return doc as unknown as PilotStewardReviewArtifact;
}

function flattenExtractionCandidates(
  extraction: PilotExtractionArtifact,
): HistoricalRspEvidenceCandidate[] {
  const out: HistoricalRspEvidenceCandidate[] = [];
  for (const result of extraction.results) {
    if (!Array.isArray(result.candidates)) {
      throw new EvidenceApplyReviewError(
        `Extraction result for ${result.applicationId ?? "(null)"} missing candidates[]`,
      );
    }
    for (const candidate of result.candidates) {
      out.push(candidate);
    }
  }
  return out;
}

export function reconcileEvidenceCandidateRows(
  extractionCandidates: readonly HistoricalRspEvidenceCandidate[],
  reviewRows: readonly StewardReviewRow[],
): EvidenceRowReconciliationResult {
  const errors: string[] = [];
  const extractionIds = extractionCandidates.map((c) =>
    evidenceRowIdentity({
      applicationId: c.applicationId,
      sourceFieldPath: c.sourceFieldPath,
      providerNameAsStated: c.providerNameAsStated,
      evidenceLocator: c.evidenceLocator,
      roleAsStated: c.roleAsStated,
    }),
  );
  const reviewIds = reviewRows.map((r) =>
    evidenceRowIdentity({
      applicationId: r.applicationId,
      sourceFieldPath: r.sourceFieldPath,
      providerNameAsStated: r.providerNameAsStated,
      evidenceLocator: r.evidenceLocator,
      roleAsStated: r.roleAsStated,
    }),
  );

  const extractionCounts = new Map<string, number>();
  for (const id of extractionIds) {
    extractionCounts.set(id, (extractionCounts.get(id) ?? 0) + 1);
  }
  const reviewCounts = new Map<string, number>();
  for (const id of reviewIds) {
    reviewCounts.set(id, (reviewCounts.get(id) ?? 0) + 1);
  }

  const duplicateExtractionIdentities = [...extractionCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  const duplicateReviewIdentities = [...reviewCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);

  if (duplicateExtractionIdentities.length > 0) {
    errors.push(
      `Duplicate extraction row identities: ${duplicateExtractionIdentities.length}`,
    );
  }
  if (duplicateReviewIdentities.length > 0) {
    errors.push(`Duplicate review row identities: ${duplicateReviewIdentities.length}`);
  }

  const unreviewedExtractionIdentities = [...extractionCounts.keys()].filter(
    (id) => !reviewCounts.has(id),
  );
  const phantomReviewIdentities = [...reviewCounts.keys()].filter(
    (id) => !extractionCounts.has(id),
  );

  if (unreviewedExtractionIdentities.length > 0) {
    errors.push(
      `Unreviewed extraction candidates: ${unreviewedExtractionIdentities.length}`,
    );
  }
  if (phantomReviewIdentities.length > 0) {
    errors.push(`Phantom review candidates: ${phantomReviewIdentities.length}`);
  }

  if (extractionCandidates.length !== reviewRows.length) {
    errors.push(
      `Candidate/review count mismatch: extraction=${extractionCandidates.length} review=${reviewRows.length}`,
    );
  }

  const matchedCount = [...extractionCounts.keys()].filter((id) => reviewCounts.has(id)).length;

  return {
    ok: errors.length === 0,
    extractionCandidateCount: extractionCandidates.length,
    reviewedCandidateCount: reviewRows.length,
    matchedCount,
    duplicateExtractionIdentities,
    duplicateReviewIdentities,
    unreviewedExtractionIdentities,
    phantomReviewIdentities,
    errors,
  };
}

function validateCandidateContracts(
  candidates: readonly HistoricalRspEvidenceCandidate[],
): string[] {
  const errors: string[] = [];
  for (const [i, c] of candidates.entries()) {
    if (c.schemaVersion !== HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION) {
      errors.push(
        `candidate[${i}] unexpected schemaVersion=${String(c.schemaVersion)}`,
      );
    }
    if (c.evidenceClassification !== "PUBLIC_ICANN") {
      errors.push(`candidate[${i}] evidenceClassification must be PUBLIC_ICANN`);
    }
    if (c.applicationVersionBasis !== "current_public_portion") {
      errors.push(`candidate[${i}] applicationVersionBasis must be current_public_portion`);
    }
    if (c.reviewState !== "REQUIRES_STEWARD_REVIEW") {
      errors.push(`candidate[${i}] reviewState must be REQUIRES_STEWARD_REVIEW`);
    }
  }
  return errors;
}

/**
 * Derive expected candidate-bearing applications from extraction candidates and
 * reconcile against steward-review applicationLevelReadiness[]. Fail closed on
 * missing/duplicate/phantom readiness entries and candidateRowCount drift.
 */
export function reconcileApplicationReadiness(
  extractionCandidates: readonly HistoricalRspEvidenceCandidate[],
  readiness: readonly StewardApplicationReadiness[],
): EvidenceApplicationReadinessReconciliationResult {
  const errors: string[] = [];
  const expectedCounts = new Map<string, number>();
  for (const candidate of extractionCandidates) {
    expectedCounts.set(
      candidate.applicationId,
      (expectedCounts.get(candidate.applicationId) ?? 0) + 1,
    );
  }
  const expectedIds = [...expectedCounts.keys()].sort();

  const readinessCounts = new Map<string, number>();
  const readinessById = new Map<string, StewardApplicationReadiness>();
  for (const entry of readiness) {
    readinessCounts.set(
      entry.applicationId,
      (readinessCounts.get(entry.applicationId) ?? 0) + 1,
    );
    if (!readinessById.has(entry.applicationId)) {
      readinessById.set(entry.applicationId, entry);
    }
  }

  const duplicateApplicationIds = [...readinessCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id)
    .sort();
  const missingApplicationIds = expectedIds.filter((id) => !readinessCounts.has(id));
  const phantomApplicationIds = [...readinessCounts.keys()]
    .filter((id) => !expectedCounts.has(id))
    .sort();

  if (duplicateApplicationIds.length > 0) {
    errors.push(
      `Duplicate applicationLevelReadiness application IDs: ${duplicateApplicationIds.join(", ")}`,
    );
  }
  if (missingApplicationIds.length > 0) {
    errors.push(
      `Missing applicationLevelReadiness entries for candidate-bearing applications: ${missingApplicationIds.join(", ")}`,
    );
  }
  if (phantomApplicationIds.length > 0) {
    errors.push(
      `Phantom applicationLevelReadiness applications with no extraction candidates: ${phantomApplicationIds.join(", ")}`,
    );
  }

  const candidateRowCountMismatches: Array<{
    applicationId: string;
    expected: number;
    actual: number;
  }> = [];
  const notReadyApplicationIds: string[] = [];

  for (const applicationId of expectedIds) {
    const expected = expectedCounts.get(applicationId)!;
    const entry = readinessById.get(applicationId);
    if (!entry) continue;
    if (entry.candidateRowCount !== expected) {
      candidateRowCountMismatches.push({
        applicationId,
        expected,
        actual: entry.candidateRowCount,
      });
    }
    if (entry.applicationPromotionReadiness !== "READY_FOR_EVIDENCE_PROMOTION") {
      notReadyApplicationIds.push(applicationId);
    }
  }

  if (candidateRowCountMismatches.length > 0) {
    errors.push(
      `applicationLevelReadiness candidateRowCount mismatches: ${candidateRowCountMismatches
        .map((m) => `${m.applicationId}(expected=${m.expected},actual=${m.actual})`)
        .join(", ")}`,
    );
  }
  if (notReadyApplicationIds.length > 0) {
    errors.push(
      `Applications not READY_FOR_EVIDENCE_PROMOTION: ${notReadyApplicationIds.join(", ")}`,
    );
  }

  const ok = errors.length === 0;
  return {
    ok,
    expectedCandidateBearingApplicationCount: expectedIds.length,
    readinessEntryCount: readiness.length,
    missingApplicationIds,
    duplicateApplicationIds,
    phantomApplicationIds,
    candidateRowCountMismatches,
    notReadyApplicationIds,
    readyApplicationCount: ok ? expectedIds.length : 0,
    errors,
  };
}

export function evaluateEvidenceApproveEligibility(input: {
  packet: HistoricalRspEvidenceApprovalPacket;
  extractionSha256: string;
  reviewSha256: string;
  extraction: PilotExtractionArtifact;
  review: PilotStewardReviewArtifact;
  candidates: readonly HistoricalRspEvidenceCandidate[];
  reconciliation: EvidenceRowReconciliationResult;
  applicationReadinessReconciliation: EvidenceApplicationReadinessReconciliationResult;
}): { eligible: boolean; errors: string[]; readyApplicationCount: number } {
  const errors: string[] = [];

  if (input.packet.decision !== "APPROVE") {
    errors.push(`decision is ${input.packet.decision}, not APPROVE`);
  }
  if (input.packet.sourceExtractionSha256 !== input.extractionSha256.toLowerCase()) {
    errors.push("packet.sourceExtractionSha256 does not match extraction SHA");
  }
  if (input.packet.stewardReviewSha256 !== input.reviewSha256.toLowerCase()) {
    errors.push("packet.stewardReviewSha256 does not match steward review SHA");
  }
  if (
    input.review.sourceExtractionArtifactSha256.toLowerCase() !==
    input.extractionSha256.toLowerCase()
  ) {
    errors.push("steward review is bound to a different extraction SHA");
  }
  if (input.extraction.artifactPurpose !== "EVIDENCE") {
    errors.push("extraction artifactPurpose must be EVIDENCE");
  }
  if (input.extraction.reviewState !== "REQUIRES_STEWARD_REVIEW") {
    errors.push("extraction reviewState must be REQUIRES_STEWARD_REVIEW");
  }
  if (input.review.artifactPurpose !== "REVIEW") {
    errors.push("steward review artifactPurpose must be REVIEW");
  }
  if (input.review.reviewState !== "DRAFT") {
    errors.push("steward review reviewState must be DRAFT");
  }

  errors.push(...validateCandidateContracts(input.candidates));
  errors.push(...assertNoProhibitedIdentityFields(input.extraction, "extraction"));
  errors.push(...assertNoProhibitedIdentityFields(input.review, "steward review"));

  if (!input.reconciliation.ok) {
    errors.push(...input.reconciliation.errors);
  }
  if (!input.applicationReadinessReconciliation.ok) {
    errors.push(...input.applicationReadinessReconciliation.errors);
  }

  const rejectCount = input.review.rows.filter(
    (r) => r.stewardReviewClassification === "REJECT_EVIDENCE_CANDIDATE",
  ).length;
  const needsCorrectionCount = input.review.rows.filter(
    (r) => r.stewardReviewClassification === "NEEDS_CORRECTION",
  ).length;
  const acceptCount = input.review.rows.filter(
    (r) => r.stewardReviewClassification === "ACCEPT_EVIDENCE_CANDIDATE",
  ).length;

  if (acceptCount !== input.review.rows.length) {
    errors.push(
      `Not all review rows are ACCEPT_EVIDENCE_CANDIDATE (accept=${acceptCount}, total=${input.review.rows.length})`,
    );
  }
  if (rejectCount > 0) {
    errors.push(`REJECT_EVIDENCE_CANDIDATE present: ${rejectCount}`);
  }
  if (needsCorrectionCount > 0) {
    errors.push(`NEEDS_CORRECTION present: ${needsCorrectionCount}`);
  }

  const readyApplicationCount =
    input.applicationReadinessReconciliation.readyApplicationCount;

  if (input.packet.expectedCandidateRowCount !== input.review.rows.length) {
    errors.push(
      `packet.expectedCandidateRowCount=${input.packet.expectedCandidateRowCount} !== reviewed=${input.review.rows.length}`,
    );
  }
  if (
    input.packet.expectedReadyApplicationCount !==
    input.applicationReadinessReconciliation.expectedCandidateBearingApplicationCount
  ) {
    errors.push(
      `packet.expectedReadyApplicationCount=${input.packet.expectedReadyApplicationCount} !== expected candidate-bearing applications=${input.applicationReadinessReconciliation.expectedCandidateBearingApplicationCount}`,
    );
  }
  if (
    input.applicationReadinessReconciliation.ok &&
    input.packet.expectedReadyApplicationCount !== readyApplicationCount
  ) {
    errors.push(
      `packet.expectedReadyApplicationCount=${input.packet.expectedReadyApplicationCount} !== ready=${readyApplicationCount}`,
    );
  }

  return {
    eligible: errors.length === 0 && input.packet.decision === "APPROVE",
    errors,
    readyApplicationCount: input.applicationReadinessReconciliation.ok
      ? readyApplicationCount
      : 0,
  };
}

/**
 * Read-only eligibility/reconciliation preflight against extraction + review bytes.
 * Never writes an approved artifact.
 */
export function evaluateEvidencePromotionCompatibility(input: {
  extractionBytes: Buffer;
  stewardReviewBytes: Buffer;
}): {
  extractionSha256: string;
  stewardReviewSha256: string;
  extractionCandidateCount: number;
  reviewedCandidateCount: number;
  acceptCount: number;
  rejectCount: number;
  needsCorrectionCount: number;
  expectedCandidateBearingApplicationCount: number;
  readinessEntryCount: number;
  readyApplicationCount: number;
  reconciliation: EvidenceRowReconciliationResult;
  applicationReadinessReconciliation: EvidenceApplicationReadinessReconciliationResult;
  prohibitedIdentityFieldHits: string[];
  mechanicallyEligibleIgnoringPacket: boolean;
  errors: string[];
} {
  const extractionSha256 = sha256Hex(input.extractionBytes);
  const stewardReviewSha256 = sha256Hex(input.stewardReviewBytes);
  const extraction = parsePilotExtractionArtifact(
    JSON.parse(input.extractionBytes.toString("utf8")) as unknown,
  );
  const review = parseStewardReviewArtifact(
    JSON.parse(input.stewardReviewBytes.toString("utf8")) as unknown,
  );
  const candidates = flattenExtractionCandidates(extraction);
  const reconciliation = reconcileEvidenceCandidateRows(candidates, review.rows);
  const applicationReadinessReconciliation = reconcileApplicationReadiness(
    candidates,
    review.applicationLevelReadiness,
  );
  const prohibitedIdentityFieldHits = [
    ...assertNoProhibitedIdentityFields(extraction, "extraction"),
    ...assertNoProhibitedIdentityFields(review, "steward review"),
  ];

  const acceptCount = review.rows.filter(
    (r) => r.stewardReviewClassification === "ACCEPT_EVIDENCE_CANDIDATE",
  ).length;
  const rejectCount = review.rows.filter(
    (r) => r.stewardReviewClassification === "REJECT_EVIDENCE_CANDIDATE",
  ).length;
  const needsCorrectionCount = review.rows.filter(
    (r) => r.stewardReviewClassification === "NEEDS_CORRECTION",
  ).length;

  const syntheticPacket: HistoricalRspEvidenceApprovalPacket = {
    schemaVersion: "historical-rsp-evidence-approval/1.0.0",
    sourceExtractionSha256: extractionSha256,
    stewardReviewSha256,
    decision: "APPROVE",
    reviewer: "COMPATIBILITY_CHECK",
    reviewedAt: "1970-01-01T00:00:00.000Z",
    expectedCandidateRowCount: review.rows.length,
    expectedReadyApplicationCount:
      applicationReadinessReconciliation.expectedCandidateBearingApplicationCount,
  };
  const eligibility = evaluateEvidenceApproveEligibility({
    packet: syntheticPacket,
    extractionSha256,
    reviewSha256: stewardReviewSha256,
    extraction,
    review,
    candidates,
    reconciliation,
    applicationReadinessReconciliation,
  });

  return {
    extractionSha256,
    stewardReviewSha256,
    extractionCandidateCount: candidates.length,
    reviewedCandidateCount: review.rows.length,
    acceptCount,
    rejectCount,
    needsCorrectionCount,
    expectedCandidateBearingApplicationCount:
      applicationReadinessReconciliation.expectedCandidateBearingApplicationCount,
    readinessEntryCount: applicationReadinessReconciliation.readinessEntryCount,
    readyApplicationCount: applicationReadinessReconciliation.readyApplicationCount,
    reconciliation,
    applicationReadinessReconciliation,
    prohibitedIdentityFieldHits,
    mechanicallyEligibleIgnoringPacket: eligibility.eligible,
    errors: eligibility.errors,
  };
}

async function canonicalizeExistingPath(path: string): Promise<string> {
  return realpath(resolve(path));
}

async function canonicalizeOutputCandidate(path: string): Promise<string> {
  const abs = resolve(path);
  try {
    return await realpath(abs);
  } catch {
    try {
      const parentReal = await realpath(dirname(abs));
      return resolve(parentReal, basename(abs));
    } catch {
      return abs;
    }
  }
}

export async function assertSafeEvidenceApprovalOutputPath(input: {
  outputPath: string;
  protectedPaths: ReadonlyArray<{ label: string; path: string }>;
}): Promise<string> {
  const canonicalOutput = await canonicalizeOutputCandidate(input.outputPath);
  for (const protectedEntry of input.protectedPaths) {
    let canonicalProtected: string;
    try {
      canonicalProtected = await canonicalizeExistingPath(protectedEntry.path);
    } catch {
      canonicalProtected = resolve(protectedEntry.path);
    }
    if (canonicalOutput === canonicalProtected) {
      throw new EvidenceApplyReviewError(
        `Output path collision rejected (fail closed): output equals protected ${protectedEntry.label} (${canonicalProtected})`,
      );
    }
  }
  try {
    await realpath(canonicalOutput);
    throw new EvidenceApplyReviewError(
      `Output path already exists (fail closed; exclusive create only): ${canonicalOutput}`,
    );
  } catch (err) {
    if (err instanceof EvidenceApplyReviewError) throw err;
  }
  return canonicalOutput;
}

async function writeApprovedDerivativeExclusive(
  outputPath: string,
  contents: string,
): Promise<void> {
  const handle = await open(outputPath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
}

function baseReceipt(input: {
  extractionPath: string;
  extractionSha256: string;
  stewardReviewPath: string;
  stewardReviewSha256: string;
  approvalPacketPath: string;
  approvalPacketSha256: string;
  packet: HistoricalRspEvidenceApprovalPacket;
  extractionCandidateCount: number;
  reviewedCandidateCount: number;
  readyApplicationCount: number;
  rowReconciliation: EvidenceRowReconciliationResult;
  applicationReadinessReconciliation: EvidenceApplicationReadinessReconciliationResult;
  mechanicalEligibility: boolean;
  outcome: EvidenceApplyReviewOutcome;
  approvedOutputPath: string | null;
  approvedOutputSha256: string | null;
  extractionUnchanged: boolean;
  reviewUnchanged: boolean;
  approvalPacketUnchanged: boolean;
  rejectReasons: string[];
}): EvidenceApplyReviewReceipt {
  return {
    receiptVersion: EVIDENCE_APPLY_REVIEW_RECEIPT_VERSION,
    sourceExtractionPath: input.extractionPath,
    sourceExtractionSha256: input.extractionSha256,
    stewardReviewPath: input.stewardReviewPath,
    stewardReviewSha256: input.stewardReviewSha256,
    approvalPacketPath: input.approvalPacketPath,
    approvalPacketSha256: input.approvalPacketSha256,
    decision: input.packet.decision,
    reviewer: input.packet.reviewer,
    reviewedAt: input.packet.reviewedAt,
    extractionCandidateCount: input.extractionCandidateCount,
    reviewedCandidateCount: input.reviewedCandidateCount,
    readyApplicationCount: input.readyApplicationCount,
    rowReconciliation: input.rowReconciliation,
    applicationReadinessReconciliation: input.applicationReadinessReconciliation,
    mechanicalEligibility: input.mechanicalEligibility,
    outcome: input.outcome,
    approvedOutputPath: input.approvedOutputPath,
    approvedOutputSha256: input.approvedOutputSha256,
    extractionUnchanged: input.extractionUnchanged,
    reviewUnchanged: input.reviewUnchanged,
    approvalPacketUnchanged: input.approvalPacketUnchanged,
    networkRequests: 0,
    rejectReasons: input.rejectReasons,
  };
}

export function formatEvidenceApplyReviewReceipt(
  receipt: EvidenceApplyReviewReceipt,
): string {
  const lines = [
    "=== evidence-apply-review (zero HTTP; not a steward decision) ===",
    `sourceExtractionPath: ${receipt.sourceExtractionPath}`,
    `sourceExtractionSha256: ${receipt.sourceExtractionSha256}`,
    `stewardReviewPath: ${receipt.stewardReviewPath}`,
    `stewardReviewSha256: ${receipt.stewardReviewSha256}`,
    `approvalPacketPath: ${receipt.approvalPacketPath}`,
    `approvalPacketSha256: ${receipt.approvalPacketSha256}`,
    `decision: ${receipt.decision}`,
    `reviewer: ${receipt.reviewer}`,
    `reviewedAt: ${receipt.reviewedAt}`,
    `extractionCandidateCount: ${receipt.extractionCandidateCount}`,
    `reviewedCandidateCount: ${receipt.reviewedCandidateCount}`,
    `readyApplicationCount: ${receipt.readyApplicationCount}`,
    `rowReconciliationOk: ${receipt.rowReconciliation.ok}`,
    `applicationReadinessReconciliationOk: ${receipt.applicationReadinessReconciliation.ok}`,
    `mechanicalEligibility: ${receipt.mechanicalEligibility}`,
    `outcome: ${receipt.outcome}`,
    `approvedOutputPath: ${receipt.approvedOutputPath ?? "(none)"}`,
    `approvedOutputSha256: ${receipt.approvedOutputSha256 ?? "(none)"}`,
    `extractionUnchanged: ${receipt.extractionUnchanged ? "yes" : "no"}`,
    `reviewUnchanged: ${receipt.reviewUnchanged ? "yes" : "no"}`,
    `approvalPacketUnchanged: ${receipt.approvalPacketUnchanged ? "yes" : "no"}`,
    `networkRequests: ${receipt.networkRequests}`,
  ];
  if (receipt.outcome === "HOLD_NO_PROMOTION") {
    lines.push("HOLD — NO PROMOTION");
  } else if (receipt.outcome === "REJECT_NO_PROMOTION") {
    lines.push("REJECT — NO PROMOTION");
  } else if (receipt.outcome === "APPROVE_REJECTED") {
    lines.push("APPROVE — REJECTED (fail closed; no promotion)");
    for (const reason of receipt.rejectReasons) {
      lines.push(`  - ${reason}`);
    }
  } else if (receipt.outcome === "APPROVED") {
    lines.push("APPROVE — APPROVED derivative written");
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Apply external human packet under fail-closed mechanical eligibility.
 * Never mutates extraction or steward-review files.
 */
export async function runEvidenceApplyReview(
  options: EvidenceApplyReviewOptions,
): Promise<EvidenceApplyReviewReceipt> {
  // Single packet byte read: SHA and parse must derive from identical bytes.
  const packetBytes = await readFile(options.approvalPacketPath);
  const approvalPacketSha256 = sha256Hex(packetBytes);
  const packet = assertHistoricalRspEvidenceApprovalPacket(
    JSON.parse(packetBytes.toString("utf8")) as unknown,
  );

  const extractionBytesBefore = await readFile(options.extractionPath);
  const reviewBytesBefore = await readFile(options.stewardReviewPath);
  const extractionSha256 = sha256Hex(extractionBytesBefore);
  const stewardReviewSha256 = sha256Hex(reviewBytesBefore);

  // HOLD/REJECT still require exact SHA binding.
  if (packet.sourceExtractionSha256 !== extractionSha256.toLowerCase()) {
    throw new EvidenceApplyReviewError(
      "Packet binding failed (fail closed): sourceExtractionSha256 does not match extraction SHA",
    );
  }
  if (packet.stewardReviewSha256 !== stewardReviewSha256.toLowerCase()) {
    throw new EvidenceApplyReviewError(
      "Packet binding failed (fail closed): stewardReviewSha256 does not match steward review SHA",
    );
  }

  const extraction = parsePilotExtractionArtifact(
    JSON.parse(extractionBytesBefore.toString("utf8")) as unknown,
  );
  const review = parseStewardReviewArtifact(
    JSON.parse(reviewBytesBefore.toString("utf8")) as unknown,
  );
  const candidates = flattenExtractionCandidates(extraction);
  const reconciliation = reconcileEvidenceCandidateRows(candidates, review.rows);
  const applicationReadinessReconciliation = reconcileApplicationReadiness(
    candidates,
    review.applicationLevelReadiness,
  );
  const readyApplicationCount =
    applicationReadinessReconciliation.readyApplicationCount;

  const unchangedTriple = async (): Promise<{
    extractionUnchanged: boolean;
    reviewUnchanged: boolean;
    approvalPacketUnchanged: boolean;
  }> => {
    const extractionAfter = await readFile(options.extractionPath);
    const reviewAfter = await readFile(options.stewardReviewPath);
    const packetAfter = await readFile(options.approvalPacketPath);
    return {
      extractionUnchanged: Buffer.compare(extractionBytesBefore, extractionAfter) === 0,
      reviewUnchanged: Buffer.compare(reviewBytesBefore, reviewAfter) === 0,
      approvalPacketUnchanged: Buffer.compare(packetBytes, packetAfter) === 0,
    };
  };

  if (packet.decision === "HOLD") {
    const unchanged = await unchangedTriple();
    return baseReceipt({
      extractionPath: options.extractionPath,
      extractionSha256,
      stewardReviewPath: options.stewardReviewPath,
      stewardReviewSha256,
      approvalPacketPath: options.approvalPacketPath,
      approvalPacketSha256,
      packet,
      extractionCandidateCount: candidates.length,
      reviewedCandidateCount: review.rows.length,
      readyApplicationCount,
      rowReconciliation: reconciliation,
      applicationReadinessReconciliation,
      mechanicalEligibility: false,
      outcome: "HOLD_NO_PROMOTION",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      extractionUnchanged: unchanged.extractionUnchanged,
      reviewUnchanged: unchanged.reviewUnchanged,
      approvalPacketUnchanged: unchanged.approvalPacketUnchanged,
      rejectReasons: [],
    });
  }

  if (packet.decision === "REJECT") {
    const unchanged = await unchangedTriple();
    return baseReceipt({
      extractionPath: options.extractionPath,
      extractionSha256,
      stewardReviewPath: options.stewardReviewPath,
      stewardReviewSha256,
      approvalPacketPath: options.approvalPacketPath,
      approvalPacketSha256,
      packet,
      extractionCandidateCount: candidates.length,
      reviewedCandidateCount: review.rows.length,
      readyApplicationCount,
      rowReconciliation: reconciliation,
      applicationReadinessReconciliation,
      mechanicalEligibility: false,
      outcome: "REJECT_NO_PROMOTION",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      extractionUnchanged: unchanged.extractionUnchanged,
      reviewUnchanged: unchanged.reviewUnchanged,
      approvalPacketUnchanged: unchanged.approvalPacketUnchanged,
      rejectReasons: [],
    });
  }

  const eligibility = evaluateEvidenceApproveEligibility({
    packet,
    extractionSha256,
    reviewSha256: stewardReviewSha256,
    extraction,
    review,
    candidates,
    reconciliation,
    applicationReadinessReconciliation,
  });

  if (!eligibility.eligible) {
    const unchanged = await unchangedTriple();
    const receipt = baseReceipt({
      extractionPath: options.extractionPath,
      extractionSha256,
      stewardReviewPath: options.stewardReviewPath,
      stewardReviewSha256,
      approvalPacketPath: options.approvalPacketPath,
      approvalPacketSha256,
      packet,
      extractionCandidateCount: candidates.length,
      reviewedCandidateCount: review.rows.length,
      readyApplicationCount: eligibility.readyApplicationCount,
      rowReconciliation: reconciliation,
      applicationReadinessReconciliation,
      mechanicalEligibility: false,
      outcome: "APPROVE_REJECTED",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      extractionUnchanged: unchanged.extractionUnchanged,
      reviewUnchanged: unchanged.reviewUnchanged,
      approvalPacketUnchanged: unchanged.approvalPacketUnchanged,
      rejectReasons: eligibility.errors,
    });
    throw new EvidenceApplyReviewError(
      `APPROVE rejected (fail closed): ${eligibility.errors.join("; ")}`,
      receipt,
    );
  }

  const safeOutputPath = await assertSafeEvidenceApprovalOutputPath({
    outputPath: options.outputPath,
    protectedPaths: [
      { label: "extraction", path: options.extractionPath },
      { label: "steward review", path: options.stewardReviewPath },
      { label: "approval packet", path: options.approvalPacketPath },
    ],
  });

  // Re-read immediately before write — prevention, not rollback.
  const extractionPreWrite = await readFile(options.extractionPath);
  const reviewPreWrite = await readFile(options.stewardReviewPath);
  const packetPreWrite = await readFile(options.approvalPacketPath);
  if (Buffer.compare(extractionBytesBefore, extractionPreWrite) !== 0) {
    throw new EvidenceApplyReviewError(
      "Invariant violated before write: extraction artifact changed during apply-review",
    );
  }
  if (Buffer.compare(reviewBytesBefore, reviewPreWrite) !== 0) {
    throw new EvidenceApplyReviewError(
      "Invariant violated before write: steward review artifact changed during apply-review",
    );
  }
  if (Buffer.compare(packetBytes, packetPreWrite) !== 0) {
    throw new EvidenceApplyReviewError(
      "Invariant violated before write: approval packet changed during apply-review",
    );
  }

  if (options.testBeforeExclusiveWrite) {
    await options.testBeforeExclusiveWrite();
    const extractionAfterHook = await readFile(options.extractionPath);
    const reviewAfterHook = await readFile(options.stewardReviewPath);
    const packetAfterHook = await readFile(options.approvalPacketPath);
    if (Buffer.compare(extractionBytesBefore, extractionAfterHook) !== 0) {
      throw new EvidenceApplyReviewError(
        "Invariant violated before write: extraction artifact changed during apply-review",
      );
    }
    if (Buffer.compare(reviewBytesBefore, reviewAfterHook) !== 0) {
      throw new EvidenceApplyReviewError(
        "Invariant violated before write: steward review artifact changed during apply-review",
      );
    }
    if (Buffer.compare(packetBytes, packetAfterHook) !== 0) {
      throw new EvidenceApplyReviewError(
        "Invariant violated before write: approval packet changed during apply-review",
      );
    }
  }

  const approved = buildHistoricalRspApprovedEvidenceArtifact({
    candidates,
    sourceExtractionSha256: extractionSha256,
    sourceExtractionDeterministicPayloadHash:
      typeof extraction.deterministicPayloadHash === "string"
        ? extraction.deterministicPayloadHash
        : null,
    sourceExtractionToolingSha:
      typeof extraction.extractionToolingSha === "string"
        ? extraction.extractionToolingSha
        : null,
    stewardReviewSha256,
    approvalPacketSha256,
    packet,
    sourceApplicationCount:
      typeof extraction.sourceDocumentCount === "number"
        ? extraction.sourceDocumentCount
        : extraction.results.length,
    candidateBearingApplicationCount:
      applicationReadinessReconciliation.expectedCandidateBearingApplicationCount,
  });
  const approvedText = serializeHistoricalRspApprovedEvidence(approved);
  await writeApprovedDerivativeExclusive(safeOutputPath, approvedText);

  const unchanged = await unchangedTriple();
  if (
    !unchanged.extractionUnchanged ||
    !unchanged.reviewUnchanged ||
    !unchanged.approvalPacketUnchanged
  ) {
    throw new EvidenceApplyReviewError(
      "Invariant violated: source extraction/review/packet changed during apply-review",
    );
  }

  return baseReceipt({
    extractionPath: options.extractionPath,
    extractionSha256,
    stewardReviewPath: options.stewardReviewPath,
    stewardReviewSha256,
    approvalPacketPath: options.approvalPacketPath,
    approvalPacketSha256,
    packet,
    extractionCandidateCount: candidates.length,
    reviewedCandidateCount: review.rows.length,
    readyApplicationCount: eligibility.readyApplicationCount,
    rowReconciliation: reconciliation,
    applicationReadinessReconciliation,
    mechanicalEligibility: true,
    outcome: "APPROVED",
    approvedOutputPath: safeOutputPath,
    approvedOutputSha256: sha256Hex(Buffer.from(approvedText, "utf8")),
    extractionUnchanged: true,
    reviewUnchanged: true,
    approvalPacketUnchanged: true,
    rejectReasons: [],
  });
}
