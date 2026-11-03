import {
  HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
  HISTORICAL_RSP_RELATIONSHIP_NON_CLAIMS,
  type ApprovedHistoricalRspEvidenceRowInput,
  type HistoricalRspProviderIdentityDecision,
  type HistoricalRspProviderRelationship,
} from "./types";
import {
  HistoricalRspProviderContractError,
  assertExactString,
  assertRelationshipStateConsistency,
  assertSha256Hex,
  buildEvidenceRowReference,
  deterministicRelationshipId,
} from "./validation";

export type UnresolvedRelationshipInput = {
  evidenceRow: ApprovedHistoricalRspEvidenceRowInput;
  approvedEvidenceArtifactSha256: string;
  relationshipState?: "UNRESOLVED" | "PENDING_IDENTITY_REVIEW";
};

/**
 * Build an unresolved / pending-identity historical RSP relationship.
 * Retains exact provider literal and evidence coordinates without organizationKey.
 */
export function buildUnresolvedHistoricalRspRelationship(
  input: UnresolvedRelationshipInput,
): HistoricalRspProviderRelationship {
  const evidenceRef = buildEvidenceRowReference(
    input.evidenceRow,
    input.approvedEvidenceArtifactSha256,
  );
  const relationshipState = input.relationshipState ?? "UNRESOLVED";
  const relationship: HistoricalRspProviderRelationship = {
    schemaVersion: HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    relationshipId: deterministicRelationshipId({
      evidenceRef,
      relationshipState,
      organizationKey: null,
      providerIdentityDecisionId: null,
    }),
    applicationId: evidenceRef.applicationId,
    evidenceRef,
    providerNameAsStated: evidenceRef.providerNameAsStated,
    relationshipState,
    organizationKey: null,
    canonicalOrganizationName: null,
    providerIdentityDecisionId: null,
    provenance: {
      approvedEvidenceArtifactSha256: evidenceRef.approvedEvidenceArtifactSha256,
      methodVersion: HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    },
    nonClaims: HISTORICAL_RSP_RELATIONSHIP_NON_CLAIMS,
  };
  assertRelationshipStateConsistency(relationship);
  return relationship;
}

export type MaterializeConfirmedRelationshipInput = {
  evidenceRow: ApprovedHistoricalRspEvidenceRowInput;
  approvedEvidenceArtifactSha256: string;
  identityDecision: HistoricalRspProviderIdentityDecision;
};

/**
 * Materialize an IDENTITY_CONFIRMED historical RSP relationship.
 * Fail-closed: APPROVED evidence, exact literal coverage, steward-approved decision.
 */
export function materializeIdentityConfirmedHistoricalRspRelationship(
  input: MaterializeConfirmedRelationshipInput,
): HistoricalRspProviderRelationship {
  if (input.evidenceRow.approvalState !== "APPROVED") {
    throw new HistoricalRspProviderContractError(
      "EVIDENCE_NOT_APPROVED",
      "Confirmed historical RSP relationships require APPROVED evidence",
    );
  }
  assertSha256Hex(input.approvedEvidenceArtifactSha256, "approvedEvidenceArtifactSha256");

  const decision = input.identityDecision;
  if (decision.reviewState !== "steward-approved") {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_NOT_APPROVED",
      "Confirmed relationship requires steward-approved provider identity decision",
    );
  }

  assertExactString(
    decision.providerNameAsStated,
    input.evidenceRow.providerNameAsStated,
    "identityDecision.providerNameAsStated vs evidenceRow.providerNameAsStated",
  );

  const evidenceRef = buildEvidenceRowReference(
    input.evidenceRow,
    input.approvedEvidenceArtifactSha256,
  );

  const relationship: HistoricalRspProviderRelationship = {
    schemaVersion: HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    relationshipId: deterministicRelationshipId({
      evidenceRef,
      relationshipState: "IDENTITY_CONFIRMED",
      organizationKey: decision.organizationKey,
      providerIdentityDecisionId: decision.decisionId,
    }),
    applicationId: evidenceRef.applicationId,
    evidenceRef,
    providerNameAsStated: evidenceRef.providerNameAsStated,
    relationshipState: "IDENTITY_CONFIRMED",
    organizationKey: decision.organizationKey,
    canonicalOrganizationName: decision.canonicalOrganizationName,
    providerIdentityDecisionId: decision.decisionId,
    provenance: {
      approvedEvidenceArtifactSha256: evidenceRef.approvedEvidenceArtifactSha256,
      methodVersion: HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    },
    nonClaims: HISTORICAL_RSP_RELATIONSHIP_NON_CLAIMS,
  };
  assertRelationshipStateConsistency(relationship);
  return relationship;
}

/**
 * Fail-closed materialization against mismatched evidence coordinates / artifact / decision.
 */
export function assertEvidenceBindingMatches(input: {
  relationship: HistoricalRspProviderRelationship;
  evidenceRow: ApprovedHistoricalRspEvidenceRowInput;
  approvedEvidenceArtifactSha256: string;
}): void {
  const { relationship, evidenceRow } = input;
  assertExactString(relationship.applicationId, evidenceRow.applicationId, "applicationId");
  assertExactString(
    relationship.providerNameAsStated,
    evidenceRow.providerNameAsStated,
    "providerNameAsStated",
  );
  assertExactString(
    relationship.evidenceRef.sourceFieldPath,
    evidenceRow.sourceFieldPath,
    "sourceFieldPath",
  );
  assertExactString(
    relationship.evidenceRef.evidenceLocator,
    evidenceRow.evidenceLocator,
    "evidenceLocator",
  );
  assertExactString(
    relationship.evidenceRef.approvedEvidenceArtifactSha256,
    input.approvedEvidenceArtifactSha256.toLowerCase(),
    "approvedEvidenceArtifactSha256",
  );
}

/**
 * RSP relationship never mutates applicant/member application lists.
 * Returns the unchanged membership snapshot for regression assertions.
 */
export function applyRelationshipWithoutMembershipMutation(input: {
  relationship: HistoricalRspProviderRelationship;
  existingMemberApplicationIds: readonly string[];
}): {
  memberApplicationIds: readonly string[];
  relationshipApplicationId: string;
  membershipUnchanged: true;
} {
  return {
    memberApplicationIds: [...input.existingMemberApplicationIds],
    relationshipApplicationId: input.relationship.applicationId,
    membershipUnchanged: true,
  };
}

/** Lineage alone never creates an RSP relationship. */
export function createRelationshipFromLineageAlone(lineage: unknown): never {
  void lineage;
  throw new HistoricalRspProviderContractError(
    "LINEAGE_CANNOT_CREATE_RELATIONSHIP",
    "A lineage record alone must never create a historical RSP provider relationship",
  );
}
