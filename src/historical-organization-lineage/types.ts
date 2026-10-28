/**
 * Historical Organization lineage — evidence-backed predecessor/successor relations.
 * Distinct from cross-round SAME_ORGANIZATION returning identity.
 */

export type HistoricalLineageRelationshipType =
  | "SAME_ENTITY_RENAME"
  | "BUSINESS_LINE_SUCCESSION"
  | "ACQUISITION"
  | "MERGER"
  | "OTHER_EVIDENCE_BACKED_SUCCESSION";

export type HistoricalLineageEvidenceTier = "A" | "B" | "C" | "D";

export type HistoricalLineageEvidenceSourceType =
  | "icann-2012-promotion"
  | "sec-filing"
  | "first-party-corporate"
  | "regulatory-registry"
  | "acquisition-announcement"
  | "steward-note";

export type HistoricalLineageEvidenceRef = {
  evidenceId: string;
  strength: HistoricalLineageEvidenceTier;
  sourceType: HistoricalLineageEvidenceSourceType;
  sourceIdentifier: string;
  title?: string;
  evidenceAsOf: string;
  retrievedAt: string;
  supportsClaim: string;
  limitations: string;
  /** Short summary — never long copyrighted text. */
  summary: string;
};

export type HistoricalLineageStewardState = "steward-approved" | "pending-review";

export type HistoricalOrganizationLineageRecord = {
  lineageId: string;
  /** Historical / predecessor Organization ID (e.g. organization:promoted:neustar). */
  historicalOrganizationId: string;
  historicalOrganizationKey: string;
  historicalCanonicalName: string;
  historicalRoundYear: 2012;
  /** Current / successor Organization ID (e.g. organization:resolved-2026:godaddy-registry-services). */
  currentOrganizationId: string;
  currentOrganizationKey: string;
  currentCanonicalName: string;
  relationshipType: HistoricalLineageRelationshipType;
  /** ISO date or year string when known (e.g. 2020-08). */
  effectiveDateOrYear: string | null;
  displayLabel: string;
  displaySummary: string;
  aliases: string[];
  evidence: HistoricalLineageEvidenceRef[];
  stewardState: HistoricalLineageStewardState;
  confidence: "high" | "medium" | "low";
  /** Scope notes — what the relationship does and does not claim. */
  scopeNotes: string;
  /** Explicit non-claims for UI/docs safety. */
  nonClaims: string[];
};

export type HistoricalOrganizationLineageRegistry = {
  registryVersion: "historical-organization-lineage-registry/1.0.0";
  methodVersion: "historical-organization-lineage/1.0.0";
  records: HistoricalOrganizationLineageRecord[];
};
