import type { HistoricalRspApprovedEvidenceArtifact } from "@/icann2012-rsp-acquisition/historical-rsp-approved-evidence";
import {
  HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
  HISTORICAL_RSP_RELATIONSHIP_NON_CLAIMS,
  type HistoricalRspEvidenceRowSelector,
  type HistoricalRspProviderIdentityDecision,
  type HistoricalRspProviderRelationship,
} from "./types";
import {
  HistoricalRspProviderContractError,
  assertExactString,
  assertRelationshipStateConsistency,
  buildEvidenceRowReference,
  deterministicRelationshipId,
  resolveUniqueApprovedEvidenceRow,
  validateProviderIdentityDecision,
} from "./validation";

export type UnresolvedRelationshipInput = {
  approvedEvidenceArtifact: HistoricalRspApprovedEvidenceArtifact;
  /** Externally verified SHA-256 of the approved-evidence artifact bytes. */
  verifiedApprovedEvidenceArtifactSha256: string;
  evidenceSelector: HistoricalRspEvidenceRowSelector;
  relationshipState?: "UNRESOLVED" | "PENDING_IDENTITY_REVIEW";
};

/**
 * Build an unresolved / pending-identity historical RSP relationship.
 * Requires trusted approved-artifact membership of the evidence row.
 */
export function buildUnresolvedHistoricalRspRelationship(
  input: UnresolvedRelationshipInput,
): HistoricalRspProviderRelationship {
  const row = resolveUniqueApprovedEvidenceRow({
    artifact: input.approvedEvidenceArtifact,
    verifiedApprovedEvidenceArtifactSha256: input.verifiedApprovedEvidenceArtifactSha256,
    selector: input.evidenceSelector,
  });
  const evidenceRef = buildEvidenceRowReference(
    row,
    input.verifiedApprovedEvidenceArtifactSha256,
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
  approvedEvidenceArtifact: HistoricalRspApprovedEvidenceArtifact;
  /** Externally verified SHA-256 of the approved-evidence artifact bytes. */
  verifiedApprovedEvidenceArtifactSha256: string;
  evidenceSelector: HistoricalRspEvidenceRowSelector;
  identityDecision: HistoricalRspProviderIdentityDecision;
};

/**
 * Materialize an IDENTITY_CONFIRMED historical RSP relationship.
 * Fail-closed on artifact trust, unique row membership, decision provenance,
 * and deterministic decision-link integrity.
 */
export function materializeIdentityConfirmedHistoricalRspRelationship(
  input: MaterializeConfirmedRelationshipInput,
): HistoricalRspProviderRelationship {
  const verifiedSha = input.verifiedApprovedEvidenceArtifactSha256.toLowerCase();
  const row = resolveUniqueApprovedEvidenceRow({
    artifact: input.approvedEvidenceArtifact,
    verifiedApprovedEvidenceArtifactSha256: verifiedSha,
    selector: input.evidenceSelector,
  });

  validateProviderIdentityDecision(input.identityDecision);
  if (input.identityDecision.reviewState !== "steward-approved") {
    throw new HistoricalRspProviderContractError(
      "IDENTITY_NOT_APPROVED",
      "Confirmed relationship requires steward-approved provider identity decision",
    );
  }

  assertExactString(
    input.identityDecision.provenance.sourceApprovedEvidenceArtifactSha256.toLowerCase(),
    verifiedSha,
    "identityDecision.provenance.sourceApprovedEvidenceArtifactSha256 vs verified approved-evidence artifact SHA",
  );
  assertExactString(
    input.identityDecision.providerNameAsStated,
    row.providerNameAsStated,
    "identityDecision.providerNameAsStated vs approved evidence row providerNameAsStated",
  );

  const evidenceRef = buildEvidenceRowReference(row, verifiedSha);
  const decision = input.identityDecision;

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
 * Fail-closed binding check against an approved artifact + selector.
 */
export function assertEvidenceBindingMatches(input: {
  relationship: HistoricalRspProviderRelationship;
  approvedEvidenceArtifact: HistoricalRspApprovedEvidenceArtifact;
  verifiedApprovedEvidenceArtifactSha256: string;
  evidenceSelector: HistoricalRspEvidenceRowSelector;
}): void {
  const row = resolveUniqueApprovedEvidenceRow({
    artifact: input.approvedEvidenceArtifact,
    verifiedApprovedEvidenceArtifactSha256: input.verifiedApprovedEvidenceArtifactSha256,
    selector: input.evidenceSelector,
  });
  const { relationship } = input;
  assertExactString(relationship.applicationId, row.applicationId, "applicationId");
  assertExactString(
    relationship.providerNameAsStated,
    row.providerNameAsStated,
    "providerNameAsStated",
  );
  assertExactString(
    relationship.evidenceRef.sourceFieldPath,
    row.sourceFieldPath,
    "sourceFieldPath",
  );
  assertExactString(
    relationship.evidenceRef.evidenceLocator,
    row.evidenceLocator,
    "evidenceLocator",
  );
  assertExactString(
    relationship.evidenceRef.approvedEvidenceArtifactSha256,
    input.verifiedApprovedEvidenceArtifactSha256.toLowerCase(),
    "approvedEvidenceArtifactSha256",
  );
}

/**
 * RSP relationship never mutates applicant/member application lists.
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
