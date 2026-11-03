/**
 * Historical RSP provider identity + relationship contracts.
 * Architecture: REUSE_ORGANIZATION_IDENTITY_WITH_RSP_RELATIONSHIP_LAYER.
 *
 * Organization identity and RSP participation are separate layers.
 * No canonical rspKey. No applicant membership from provider role.
 */

export const HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION =
  "historical-rsp-provider-identity/1.0.0" as const;

export const HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION =
  "historical-rsp-provider-relationship/1.0.0" as const;

export const HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION =
  "historical-rsp-current-attribution/1.0.0" as const;

export type ProviderIdentityOperationType =
  | "BIND_EXISTING_ORGANIZATION"
  | "CREATE_PROVIDER_ORGANIZATION";

export type ProviderIdentityReviewState = "steward-approved" | "pending-review" | "rejected";

export type ProviderIdentityConfidence = "high" | "medium" | "low";

/**
 * Fields that would cross the identity/relationship ownership boundary.
 * Must be rejected fail-closed on provider-identity operations.
 */
export const FORBIDDEN_PROVIDER_IDENTITY_FIELDS = [
  "applicationIds",
  "memberApplicationIds",
  "ownedApplicationIds",
  "rspKey",
] as const;

export type ForbiddenProviderIdentityField =
  (typeof FORBIDDEN_PROVIDER_IDENTITY_FIELDS)[number];

/** Trusted confirmed organization entry supplied by the caller (DI). */
export type TrustedConfirmedOrganization = {
  organizationKey: string;
  canonicalOrganizationName: string;
};

/**
 * Steward-reviewed provider identity decision.
 * Explicit only — never inferred by case/punctuation/fuzzy match.
 */
export type HistoricalRspProviderIdentityDecision = {
  schemaVersion: typeof HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION;
  decisionId: string;
  operationType: ProviderIdentityOperationType;
  /** Exact historical provider wording under review — never normalized. */
  providerNameAsStated: string;
  organizationKey: string;
  canonicalOrganizationName: string;
  reviewState: ProviderIdentityReviewState;
  reviewer: string;
  reviewedAt: string;
  rationale: string;
  confidence: ProviderIdentityConfidence;
  /**
   * Origin marker for CREATE_PROVIDER_ORGANIZATION.
   * Provider-origin identities have no applicant membership.
   */
  organizationOrigin: "existing-confirmed" | "provider-origin";
};

export type HistoricalRspEvidenceRowReference = {
  applicationId: string;
  sourceFieldPath: "Q23" | "Q24" | "Q25";
  evidenceLocator: string;
  providerNameAsStated: string;
  approvedEvidenceArtifactSha256: string;
};

/**
 * Minimal approved-evidence row shape required for relationship materialization.
 * Mirrors approved-evidence-row coordinates without importing production artifacts.
 */
export type ApprovedHistoricalRspEvidenceRowInput = {
  approvalState: "APPROVED";
  applicationId: string;
  sourceFieldPath: "Q23" | "Q24" | "Q25";
  evidenceLocator: string;
  providerNameAsStated: string;
};

export type HistoricalRspRelationshipState =
  | "UNRESOLVED"
  | "PENDING_IDENTITY_REVIEW"
  | "IDENTITY_CONFIRMED"
  | "REJECTED";

/**
 * Historical RSP provider relationship — evidence-bound, not ownership.
 * Does not imply applicant membership or current capability.
 */
export type HistoricalRspProviderRelationship = {
  schemaVersion: typeof HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION;
  relationshipId: string;
  applicationId: string;
  evidenceRef: HistoricalRspEvidenceRowReference;
  providerNameAsStated: string;
  relationshipState: HistoricalRspRelationshipState;
  /** Present only when relationshipState === IDENTITY_CONFIRMED. */
  organizationKey: string | null;
  canonicalOrganizationName: string | null;
  /** Present only when relationshipState === IDENTITY_CONFIRMED. */
  providerIdentityDecisionId: string | null;
  provenance: {
    approvedEvidenceArtifactSha256: string;
    methodVersion: typeof HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION;
  };
  /**
   * Explicit non-claims preserved on every relationship record.
   */
  nonClaims: readonly string[];
};

export const HISTORICAL_RSP_RELATIONSHIP_NON_CLAIMS = [
  "Does not claim application ownership by the provider organization",
  "Does not add the application to provider applicant/member portfolio",
  "Does not claim the provider was the applicant or Registry Operator",
  "Does not claim current RSP capability or current provider relationship",
  "Does not rewrite historical source provider wording",
] as const;

export type HistoricalRspLineageInput = {
  lineageId: string;
  historicalOrganizationKey: string;
  historicalCanonicalName: string;
  currentOrganizationKey: string;
  currentCanonicalName: string;
  relationshipType:
    | "SAME_ENTITY_RENAME"
    | "BUSINESS_LINE_SUCCESSION"
    | "ACQUISITION"
    | "MERGER"
    | "OTHER_EVIDENCE_BACKED_SUCCESSION";
  stewardState: "steward-approved" | "pending-review";
  confidence: "high" | "medium" | "low";
  effectiveDateOrYear: string | null;
  scopeNotes: string;
  nonClaims: readonly string[];
};

/**
 * Historical footprint attribution — never current capability.
 */
export type HistoricalRspCurrentAttribution = {
  methodVersion: typeof HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION;
  attributionKind: "HISTORICAL_FOOTPRINT";
  relationshipId: string;
  applicationId: string;
  historicalOrganizationKey: string;
  historicalCanonicalName: string;
  currentOrganizationKey: string;
  currentCanonicalName: string;
  lineageId: string;
  lineageRelationshipType: HistoricalRspLineageInput["relationshipType"];
  providerNameAsStated: string;
  /** Always false — lineage never implies current RSP capability. */
  claimsCurrentRspCapability: false;
  /** Always false — not application ownership. */
  claimsApplicationOwnership: false;
  nonClaims: readonly string[];
};
