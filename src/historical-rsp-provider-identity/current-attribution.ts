import type { HistoricalOrganizationLineageRecord } from "@/historical-organization-lineage/types";
import {
  HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION,
  type HistoricalRspCurrentAttribution,
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

const RECOGNIZED_LINEAGE_RELATIONSHIP_TYPES = new Set<
  HistoricalOrganizationLineageRecord["relationshipType"]
>([
  "SAME_ENTITY_RENAME",
  "BUSINESS_LINE_SUCCESSION",
  "ACQUISITION",
  "MERGER",
  "OTHER_EVIDENCE_BACKED_SUCCESSION",
]);

/**
 * Validate canonical historical-organization lineage record semantics for attribution.
 * Contract validation only — does not mutate lineage or re-verify external sources.
 */
export function assertAttributionEligibleLineage(
  lineage: HistoricalOrganizationLineageRecord,
): void {
  assertNonEmptyString(lineage.lineageId, "lineage.lineageId");
  assertNonEmptyString(lineage.historicalOrganizationId, "lineage.historicalOrganizationId");
  assertNonEmptyString(lineage.historicalOrganizationKey, "lineage.historicalOrganizationKey");
  assertNonEmptyString(lineage.historicalCanonicalName, "lineage.historicalCanonicalName");
  assertNonEmptyString(lineage.currentOrganizationId, "lineage.currentOrganizationId");
  assertNonEmptyString(lineage.currentOrganizationKey, "lineage.currentOrganizationKey");
  assertNonEmptyString(lineage.currentCanonicalName, "lineage.currentCanonicalName");

  if (lineage.historicalRoundYear !== 2012) {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_ROUND_INVALID",
      "Historical lineage historicalRoundYear must be 2012",
    );
  }
  if (!RECOGNIZED_LINEAGE_RELATIONSHIP_TYPES.has(lineage.relationshipType)) {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_RELATIONSHIP_TYPE_UNKNOWN",
      `Unrecognized lineage relationshipType: ${String(lineage.relationshipType)}`,
    );
  }
  if (lineage.stewardState !== "steward-approved") {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_NOT_APPROVED",
      "Current historical attribution requires steward-approved lineage",
    );
  }
  if (!Array.isArray(lineage.evidence) || lineage.evidence.length === 0) {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_EVIDENCE_MISSING",
      "Attribution requires evidence-backed lineage (non-empty evidence[])",
    );
  }
  for (const ev of lineage.evidence) {
    assertNonEmptyString(ev.evidenceId, "lineage.evidence.evidenceId");
    assertNonEmptyString(ev.sourceType, "lineage.evidence.sourceType");
    assertNonEmptyString(ev.sourceIdentifier, "lineage.evidence.sourceIdentifier");
    assertNonEmptyString(ev.supportsClaim, "lineage.evidence.supportsClaim");
    assertNonEmptyString(ev.summary, "lineage.evidence.summary");
  }
}

/**
 * Derive current historical-footprint attribution from:
 * 1) IDENTITY_CONFIRMED historical RSP relationship; and
 * 2) steward-approved evidence-backed HistoricalOrganizationLineageRecord.
 */
export function deriveHistoricalRspCurrentAttribution(input: {
  relationship: HistoricalRspProviderRelationship;
  lineage: HistoricalOrganizationLineageRecord;
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

  assertAttributionEligibleLineage(lineage);
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
    nonClaims: [...ATTRIBUTION_NON_CLAIMS, ...lineage.nonClaims],
  };
}

/**
 * Reject objects that are not evidence-bearing lineage records.
 * Used to prove a reduced steward-approved shell is insufficient.
 */
export function deriveHistoricalRspCurrentAttributionFromUnknown(input: {
  relationship: HistoricalRspProviderRelationship;
  lineage: unknown;
}): HistoricalRspCurrentAttribution {
  if (input.lineage === null || typeof input.lineage !== "object" || Array.isArray(input.lineage)) {
    throw new HistoricalRspProviderContractError(
      "LINEAGE_SHAPE_INVALID",
      "lineage must be a HistoricalOrganizationLineageRecord object",
    );
  }
  return deriveHistoricalRspCurrentAttribution({
    relationship: input.relationship,
    lineage: input.lineage as HistoricalOrganizationLineageRecord,
  });
}
