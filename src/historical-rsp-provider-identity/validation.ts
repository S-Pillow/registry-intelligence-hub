import {
  HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
  HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION,
  type HistoricalRspApprovedEvidenceArtifact,
  type HistoricalRspApprovedEvidenceRow,
} from "@/icann2012-rsp-acquisition/historical-rsp-approved-evidence";
import { contentHash } from "@/normalization/hashes";
import {
  FORBIDDEN_PROVIDER_IDENTITY_FIELDS,
  HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
  HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
  type ForbiddenProviderIdentityField,
  type HistoricalRspEvidenceRowReference,
  type HistoricalRspEvidenceRowSelector,
  type HistoricalRspProviderIdentityDecision,
  type HistoricalRspProviderRelationship,
  type TrustedConfirmedOrganization,
} from "./types";

export class HistoricalRspProviderContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HistoricalRspProviderContractError";
    this.code = code;
  }
}

export function assertNoForbiddenProviderIdentityFields(
  payload: Record<string, unknown>,
): void {
  const present: ForbiddenProviderIdentityField[] = [];
  for (const field of FORBIDDEN_PROVIDER_IDENTITY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      present.push(field);
    }
  }
  if (present.length > 0) {
    throw new HistoricalRspProviderContractError(
      "FORBIDDEN_OWNERSHIP_FIELDS",
      `Provider identity operation rejects ownership/relationship fields: ${present.join(", ")}`,
    );
  }
}

export function assertExactString(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new HistoricalRspProviderContractError(
      "EXACT_MATCH_REQUIRED",
      `${label} mismatch: expected exact ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertSha256Hex(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new HistoricalRspProviderContractError(
      "INVALID_SHA256",
      `${label} must be a 64-character hex SHA-256`,
    );
  }
}

export function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HistoricalRspProviderContractError(
      "INVALID_STRING",
      `${label} must be a non-empty string`,
    );
  }
}

/**
 * Local evidence-row identity — semantic parity with
 * `evidenceRowIdentity` in evidence-apply-review.ts
 * (applicationId, sourceFieldPath, providerNameAsStated, evidenceLocator, roleAsStated).
 * Implemented locally to avoid importing the apply-review operator module.
 */
export function approvedEvidenceRowIdentity(input: {
  applicationId: string;
  sourceFieldPath: string;
  providerNameAsStated: string;
  evidenceLocator: string;
  roleAsStated?: string | null;
}): string {
  const role = input.roleAsStated == null ? "" : input.roleAsStated;
  return [
    input.applicationId,
    input.sourceFieldPath,
    input.providerNameAsStated,
    input.evidenceLocator,
    role,
  ].join("\u0001");
}

export function evidenceRowReferenceEquals(
  a: HistoricalRspEvidenceRowReference,
  b: HistoricalRspEvidenceRowReference,
): boolean {
  return (
    approvedEvidenceRowIdentity(a) === approvedEvidenceRowIdentity(b) &&
    a.approvedEvidenceArtifactSha256.toLowerCase() ===
      b.approvedEvidenceArtifactSha256.toLowerCase()
  );
}

/**
 * Validate canonical approved-evidence artifact lifecycle fields.
 * Treats verifiedApprovedEvidenceArtifactSha256 as an externally verified byte hash
 * (does not re-hash the in-memory object as proof of original bytes).
 */
export function assertTrustedApprovedEvidenceArtifact(input: {
  artifact: HistoricalRspApprovedEvidenceArtifact;
  verifiedApprovedEvidenceArtifactSha256: string;
}): void {
  const { artifact } = input;
  assertSha256Hex(
    input.verifiedApprovedEvidenceArtifactSha256,
    "verifiedApprovedEvidenceArtifactSha256",
  );
  if (artifact.schemaVersion !== HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION) {
    throw new HistoricalRspProviderContractError(
      "APPROVED_EVIDENCE_SCHEMA_MISMATCH",
      `Expected approved-evidence schema ${HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION}, got ${String(artifact.schemaVersion)}`,
    );
  }
  if (artifact.artifactPurpose !== "EVIDENCE") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_EVIDENCE_PURPOSE_MISMATCH",
      `artifactPurpose must be EVIDENCE, got ${String(artifact.artifactPurpose)}`,
    );
  }
  if (artifact.approvalState !== "APPROVED") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_EVIDENCE_NOT_APPROVED",
      "Approved-evidence artifact approvalState must be APPROVED",
    );
  }
  if (!Array.isArray(artifact.approvedEvidenceRows)) {
    throw new HistoricalRspProviderContractError(
      "APPROVED_EVIDENCE_ROWS_MISSING",
      "approvedEvidenceRows must be an array",
    );
  }
}

export function assertCanonicalApprovedEvidenceRow(
  row: HistoricalRspApprovedEvidenceRow,
): void {
  if (row.schemaVersion !== HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION) {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_SCHEMA_MISMATCH",
      `Expected approved-row schema ${HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION}, got ${String(row.schemaVersion)}`,
    );
  }
  if (row.evidenceClassification !== "PUBLIC_ICANN") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_CLASSIFICATION",
      "evidenceClassification must be PUBLIC_ICANN",
    );
  }
  if (row.applicationVersionBasis !== "current_public_portion") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_VERSION_BASIS",
      "applicationVersionBasis must be current_public_portion",
    );
  }
  if (row.approvalState !== "APPROVED") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_NOT_APPROVED",
      "approved evidence row approvalState must be APPROVED",
    );
  }
  if (row.approvalBasis !== "STEWARD_REVIEW") {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_BASIS",
      "approvalBasis must be STEWARD_REVIEW",
    );
  }
}

/**
 * Resolve exactly one approved row from a trusted artifact by material evidence identity.
 * Fail-closed on zero or duplicate matches.
 */
export function resolveUniqueApprovedEvidenceRow(input: {
  artifact: HistoricalRspApprovedEvidenceArtifact;
  verifiedApprovedEvidenceArtifactSha256: string;
  selector: HistoricalRspEvidenceRowSelector;
}): HistoricalRspApprovedEvidenceRow {
  assertTrustedApprovedEvidenceArtifact({
    artifact: input.artifact,
    verifiedApprovedEvidenceArtifactSha256: input.verifiedApprovedEvidenceArtifactSha256,
  });
  const target = approvedEvidenceRowIdentity(input.selector);
  const matches: HistoricalRspApprovedEvidenceRow[] = [];
  for (const row of input.artifact.approvedEvidenceRows) {
    assertCanonicalApprovedEvidenceRow(row);
    if (approvedEvidenceRowIdentity(row) === target) {
      matches.push(row);
    }
  }
  if (matches.length === 0) {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_NOT_FOUND",
      "Referenced evidence row does not exist in the approved-evidence artifact",
    );
  }
  if (matches.length > 1) {
    throw new HistoricalRspProviderContractError(
      "APPROVED_ROW_NOT_UNIQUE",
      "Referenced evidence row identity is not unique inside the approved-evidence artifact",
    );
  }
  return matches[0]!;
}

export function buildEvidenceRowReference(
  row: HistoricalRspApprovedEvidenceRow,
  approvedEvidenceArtifactSha256: string,
): HistoricalRspEvidenceRowReference {
  assertCanonicalApprovedEvidenceRow(row);
  assertSha256Hex(approvedEvidenceArtifactSha256, "approvedEvidenceArtifactSha256");
  return {
    applicationId: row.applicationId,
    sourceFieldPath: row.sourceFieldPath,
    evidenceLocator: row.evidenceLocator,
    providerNameAsStated: row.providerNameAsStated,
    roleAsStated: row.roleAsStated ?? null,
    approvedEvidenceArtifactSha256: approvedEvidenceArtifactSha256.toLowerCase(),
  };
}

/** Deterministic relationship ID from evidence coordinates + state class. */
export function deterministicRelationshipId(input: {
  evidenceRef: HistoricalRspEvidenceRowReference;
  relationshipState: HistoricalRspProviderRelationship["relationshipState"];
  organizationKey: string | null;
  providerIdentityDecisionId: string | null;
}): string {
  return `hist-rsp-rel:${contentHash({
    schemaVersion: HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    evidenceRef: input.evidenceRef,
    relationshipState: input.relationshipState,
    organizationKey: input.organizationKey,
    providerIdentityDecisionId: input.providerIdentityDecisionId,
  })}`;
}

/** Deterministic decision ID from semantic decision content (excludes reviewer/reviewedAt). */
export function deterministicProviderIdentityDecisionId(
  decision: Pick<
    HistoricalRspProviderIdentityDecision,
    | "operationType"
    | "providerNameAsStated"
    | "organizationKey"
    | "canonicalOrganizationName"
    | "reviewState"
    | "rationale"
    | "confidence"
    | "organizationOrigin"
    | "provenance"
  >,
): string {
  return `hist-rsp-pid:${contentHash({
    schemaVersion: HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
    operationType: decision.operationType,
    providerNameAsStated: decision.providerNameAsStated,
    organizationKey: decision.organizationKey,
    canonicalOrganizationName: decision.canonicalOrganizationName,
    reviewState: decision.reviewState,
    rationale: decision.rationale,
    confidence: decision.confidence,
    organizationOrigin: decision.organizationOrigin,
    provenance: {
      sourceApprovedEvidenceArtifactSha256:
        decision.provenance.sourceApprovedEvidenceArtifactSha256.toLowerCase(),
      identityReviewArtifactSha256:
        decision.provenance.identityReviewArtifactSha256.toLowerCase(),
    },
  })}`;
}

export function validateProviderIdentityDecision(
  decision: HistoricalRspProviderIdentityDecision,
): void {
  assertNoForbiddenProviderIdentityFields(decision as unknown as Record<string, unknown>);
  if (decision.schemaVersion !== HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_SCHEMA_MISMATCH",
      `Unexpected provider identity schemaVersion: ${decision.schemaVersion}`,
    );
  }
  if (
    decision.operationType !== "BIND_EXISTING_ORGANIZATION" &&
    decision.operationType !== "CREATE_PROVIDER_ORGANIZATION"
  ) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_OPERATION_UNKNOWN",
      `Unrecognized operationType: ${String(decision.operationType)}`,
    );
  }
  if (
    decision.reviewState !== "steward-approved" &&
    decision.reviewState !== "pending-review" &&
    decision.reviewState !== "rejected"
  ) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_REVIEW_STATE_UNKNOWN",
      `Unrecognized reviewState: ${String(decision.reviewState)}`,
    );
  }
  assertNonEmptyString(decision.decisionId, "decisionId");
  assertNonEmptyString(decision.providerNameAsStated, "providerNameAsStated");
  assertNonEmptyString(decision.organizationKey, "organizationKey");
  assertNonEmptyString(decision.canonicalOrganizationName, "canonicalOrganizationName");
  assertNonEmptyString(decision.reviewer, "reviewer");
  assertNonEmptyString(decision.reviewedAt, "reviewedAt");
  assertNonEmptyString(decision.rationale, "rationale");
  if (
    decision.confidence !== "high" &&
    decision.confidence !== "medium" &&
    decision.confidence !== "low"
  ) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_CONFIDENCE_UNKNOWN",
      `Unrecognized confidence: ${String(decision.confidence)}`,
    );
  }
  assertSha256Hex(
    decision.provenance.sourceApprovedEvidenceArtifactSha256,
    "provenance.sourceApprovedEvidenceArtifactSha256",
  );
  assertSha256Hex(
    decision.provenance.identityReviewArtifactSha256,
    "provenance.identityReviewArtifactSha256",
  );

  if (
    decision.operationType === "BIND_EXISTING_ORGANIZATION" &&
    decision.organizationOrigin !== "existing-confirmed"
  ) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_ORIGIN_MISMATCH",
      "BIND_EXISTING_ORGANIZATION requires organizationOrigin existing-confirmed",
    );
  }
  if (
    decision.operationType === "CREATE_PROVIDER_ORGANIZATION" &&
    decision.organizationOrigin !== "provider-origin"
  ) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_ORIGIN_MISMATCH",
      "CREATE_PROVIDER_ORGANIZATION requires organizationOrigin provider-origin",
    );
  }

  const expectedId = deterministicProviderIdentityDecisionId(decision);
  if (decision.decisionId !== expectedId) {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_DECISION_LINK_TAMPERED",
      "decisionId does not match deterministic semantic decision content",
    );
  }
}

export function indexTrustedOrganizations(
  orgs: readonly TrustedConfirmedOrganization[],
): Map<string, TrustedConfirmedOrganization> {
  const map = new Map<string, TrustedConfirmedOrganization>();
  for (const org of orgs) {
    assertNonEmptyString(org.organizationKey, "trusted organizationKey");
    assertNonEmptyString(org.canonicalOrganizationName, "trusted canonicalOrganizationName");
    if (map.has(org.organizationKey)) {
      throw new HistoricalRspProviderContractError(
        "DUPLICATE_TRUSTED_ORG",
        `Duplicate trusted organizationKey: ${org.organizationKey}`,
      );
    }
    map.set(org.organizationKey, org);
  }
  return map;
}

export function assertRelationshipStateConsistency(
  relationship: HistoricalRspProviderRelationship,
): void {
  if (relationship.schemaVersion !== HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION) {
    throw new HistoricalRspProviderContractError(
      "SCHEMA_MISMATCH",
      `Unexpected relationship schemaVersion: ${relationship.schemaVersion}`,
    );
  }
  if (relationship.relationshipState === "IDENTITY_CONFIRMED") {
    if (!relationship.organizationKey || !relationship.canonicalOrganizationName) {
      throw new HistoricalRspProviderContractError(
        "CONFIRMED_WITHOUT_ORG",
        "IDENTITY_CONFIRMED requires organizationKey and canonicalOrganizationName",
      );
    }
    if (!relationship.providerIdentityDecisionId) {
      throw new HistoricalRspProviderContractError(
        "CONFIRMED_WITHOUT_DECISION",
        "IDENTITY_CONFIRMED requires providerIdentityDecisionId",
      );
    }
  } else if (
    relationship.relationshipState === "UNRESOLVED" ||
    relationship.relationshipState === "PENDING_IDENTITY_REVIEW"
  ) {
    if (relationship.organizationKey !== null || relationship.canonicalOrganizationName !== null) {
      throw new HistoricalRspProviderContractError(
        "UNRESOLVED_WITH_ORG",
        `${relationship.relationshipState} must not carry a confirmed organization binding`,
      );
    }
    if (relationship.providerIdentityDecisionId !== null) {
      throw new HistoricalRspProviderContractError(
        "UNRESOLVED_WITH_DECISION",
        `${relationship.relationshipState} must not carry providerIdentityDecisionId`,
      );
    }
  }
  assertExactString(
    relationship.applicationId,
    relationship.evidenceRef.applicationId,
    "relationship.applicationId vs evidenceRef.applicationId",
  );
  assertExactString(
    relationship.providerNameAsStated,
    relationship.evidenceRef.providerNameAsStated,
    "relationship.providerNameAsStated vs evidenceRef.providerNameAsStated",
  );
  assertExactString(
    relationship.provenance.approvedEvidenceArtifactSha256,
    relationship.evidenceRef.approvedEvidenceArtifactSha256,
    "provenance vs evidenceRef approvedEvidenceArtifactSha256",
  );
}
