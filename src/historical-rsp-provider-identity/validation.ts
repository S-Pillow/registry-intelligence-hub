import { contentHash } from "@/normalization/hashes";
import {
  FORBIDDEN_PROVIDER_IDENTITY_FIELDS,
  HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
  HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
  type ApprovedHistoricalRspEvidenceRowInput,
  type ForbiddenProviderIdentityField,
  type HistoricalRspEvidenceRowReference,
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

export function evidenceRowReferenceEquals(
  a: HistoricalRspEvidenceRowReference,
  b: HistoricalRspEvidenceRowReference,
): boolean {
  return (
    a.applicationId === b.applicationId &&
    a.sourceFieldPath === b.sourceFieldPath &&
    a.evidenceLocator === b.evidenceLocator &&
    a.providerNameAsStated === b.providerNameAsStated &&
    a.approvedEvidenceArtifactSha256.toLowerCase() ===
      b.approvedEvidenceArtifactSha256.toLowerCase()
  );
}

export function buildEvidenceRowReference(
  row: ApprovedHistoricalRspEvidenceRowInput,
  approvedEvidenceArtifactSha256: string,
): HistoricalRspEvidenceRowReference {
  if (row.approvalState !== "APPROVED") {
    throw new HistoricalRspProviderContractError(
      "EVIDENCE_NOT_APPROVED",
      "Confirmed historical RSP relationships require APPROVED evidence rows",
    );
  }
  assertNonEmptyString(row.applicationId, "applicationId");
  assertNonEmptyString(row.evidenceLocator, "evidenceLocator");
  assertNonEmptyString(row.providerNameAsStated, "providerNameAsStated");
  assertSha256Hex(approvedEvidenceArtifactSha256, "approvedEvidenceArtifactSha256");
  if (!["Q23", "Q24", "Q25"].includes(row.sourceFieldPath)) {
    throw new HistoricalRspProviderContractError(
      "INVALID_SOURCE_FIELD",
      `sourceFieldPath must be Q23|Q24|Q25, got ${JSON.stringify(row.sourceFieldPath)}`,
    );
  }
  return {
    applicationId: row.applicationId,
    sourceFieldPath: row.sourceFieldPath,
    evidenceLocator: row.evidenceLocator,
    providerNameAsStated: row.providerNameAsStated,
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

/** Deterministic decision ID from semantic identity fields (not reviewedAt alone). */
export function deterministicProviderIdentityDecisionId(input: {
  operationType: HistoricalRspProviderIdentityDecision["operationType"];
  providerNameAsStated: string;
  organizationKey: string;
  canonicalOrganizationName: string;
  reviewState: HistoricalRspProviderIdentityDecision["reviewState"];
  rationale: string;
}): string {
  return `hist-rsp-pid:${contentHash({
    schemaVersion: HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
    operationType: input.operationType,
    providerNameAsStated: input.providerNameAsStated,
    organizationKey: input.organizationKey,
    canonicalOrganizationName: input.canonicalOrganizationName,
    reviewState: input.reviewState,
    rationale: input.rationale,
  })}`;
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
