import {
  HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION,
  type HistoricalRspCurrentAttribution,
  type HistoricalRspLineageInput,
  type HistoricalRspProviderRelationship,
} from "./types";
import {
  HistoricalRspProviderContractError,
  assertExactString,
  assertNonEmptyString,
} from "./validation";

const ATTRIBUTION_NON_CLAIMS = [
  "Historical footprint attribution only — not current RSP capability",
  "Does not claim current provider relationship for the application",
  "Does not claim application ownership",
  "Does not rewrite historical provider wording",
  "Does not imply SAME_ORGANIZATION identity unless lineage relationshipType says so",
] as const;

/**
 * Derive current historical-footprint attribution from:
 * 1) IDENTITY_CONFIRMED historical RSP relationship; and
 * 2) steward-approved historical organization lineage.
 *
 * Fail-closed on pending lineage, key mismatch, or unresolved relationship.
 * Preserves the actual lineage relationshipType (e.g. BUSINESS_LINE_SUCCESSION).
 */
export function deriveHistoricalRspCurrentAttribution(input: {
  relationship: HistoricalRspProviderRelationship;
  lineage: HistoricalRspLineageInput;
}): HistoricalRspCurrentAttribution {
  const { relationship, lineage } = input;

  if (relationship.relationshipState !== "IDENTITY_CONFIRMED") {
    throw new HistoricalRspProviderContractError(
      "RELATIONSHIP_NOT_CONFIRMED",
      "Current historical attribution requires an IDENTITY_CONFIRMED historical RSP relationship",
    );
  }
  if (!relationship.organizationKey || !relationship.canonicalOrganizationName) {
    throw new HistoricalRspProviderContractError(
      "RELATIONSHIP_MISSING_ORG",
      "IDENTITY_CONFIRMED relationship missing organization identity",
    );
  }

  if (lineage.stewardState !== "steward-approved") {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_NOT_APPROVED",
      "Current historical attribution requires steward-approved lineage",
    );
  }

  assertNonEmptyString(lineage.currentOrganizationKey, "lineage.currentOrganizationKey");
  assertNonEmptyString(lineage.currentCanonicalName, "lineage.currentCanonicalName");
  assertExactString(
    lineage.historicalOrganizationKey,
    relationship.organizationKey,
    "lineage.historicalOrganizationKey vs relationship.organizationKey",
  );

  return {
    methodVersion: HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION,
    attributionKind: "HISTORICAL_FOOTPRINT",
    relationshipId: relationship.relationshipId,
    applicationId: relationship.applicationId,
    historicalOrganizationKey: relationship.organizationKey,
    historicalCanonicalName: relationship.canonicalOrganizationName,
    currentOrganizationKey: lineage.currentOrganizationKey,
    currentCanonicalName: lineage.currentCanonicalName,
    lineageId: lineage.lineageId,
    lineageRelationshipType: lineage.relationshipType,
    providerNameAsStated: relationship.providerNameAsStated,
    claimsCurrentRspCapability: false,
    claimsApplicationOwnership: false,
    nonClaims: [
      ...ATTRIBUTION_NON_CLAIMS,
      ...lineage.nonClaims,
    ],
  };
}
