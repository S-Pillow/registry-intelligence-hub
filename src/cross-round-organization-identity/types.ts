/** Mapping lifecycle — only steward-approved CONFIRMED may later drive returning/new. */
export type CrossRoundIdentityState =
  | "CONFIRMED"
  | "CANDIDATE"
  | "AMBIGUOUS"
  | "REJECTED"
  | "UNMATCHED";

export type CrossRoundRelationshipType =
  | "SAME_ORGANIZATION"
  | "RENAMED_ENTITY"
  | "CONTINUOUS_PARENT_IDENTITY"
  | "SUCCESSOR_ENTITY_REVIEW_REQUIRED"
  | "ACQUIRED_AFTER_2012"
  | "RELATED_BUT_NOT_SAME_ANALYTICAL_IDENTITY"
  | "NO_PLAUSIBLE_CONFIRMED_2012_MATCH";

export type CrossRoundReviewRecommendation =
  | "CONFIRM"
  | "REJECT"
  | "AMBIGUOUS"
  | "NO_MATCH";

export type CrossRoundEvidenceStrength = "A" | "B" | "C" | "D";

export type CrossRoundEvidenceSourceType =
  | "icann-2012-promotion"
  | "icann-public-summary"
  | "sec-filing"
  | "first-party-corporate"
  | "regulatory-registry"
  | "acquisition-announcement"
  | "steward-note";

export type CrossRoundEvidenceRef = {
  evidenceId: string;
  strength: CrossRoundEvidenceStrength;
  sourceType: CrossRoundEvidenceSourceType;
  sourceIdentifier: string;
  title?: string;
  evidenceAsOf: string;
  retrievedAt: string;
  supportsClaim: string;
  temporalRelevance: string;
  limitations: string;
  /** Short summary — never long copyrighted text. */
  summary: string;
};

export type TemporalAssessment = {
  continuityClaim: string;
  knownEvents: string[];
  acquisitionAfter2012: boolean;
  renameContinuity: boolean;
  stewardJudgmentRequired: boolean;
  limitations: string;
};

export type CrossRoundIdentityMapping = {
  crossRoundIdentityId: string;
  /** Canonical key — never display name / Applicant Name. */
  organization2012Id: string | null;
  organization2012Key: string | null;
  organization2012CanonicalName: string | null;
  organization2012ApplicationCount: number;
  /** Canonical key — never display name / Applicant Name. */
  organization2026Id: string;
  organization2026Key: string;
  organization2026CanonicalName: string;
  organization2026ApplicationCount: number;
  state: CrossRoundIdentityState;
  relationshipType: CrossRoundRelationshipType;
  evidenceRefIds: string[];
  temporalAssessment: TemporalAssessment;
  reviewRecommendation: CrossRoundReviewRecommendation;
  recommendationReason: string;
  /** Always null in CROSS-ROUND-ID-1 — steward gate is a later ticket. */
  stewardDecision: null;
  notes: string;
};

export type Confirmed2012Organization = {
  organizationId: string;
  organizationKey: string;
  canonicalOrganizationName: string;
  memberApplicationIds: string[];
  evidence: string[];
  promotionOpIds: string[];
  confidence: "high" | "medium";
  reviewState: "steward-approved";
};

export type OrganizationLayerPin = {
  round: 2012 | 2026;
  schemaOrRegistryVersion: string;
  methodVersion: string;
  contentSha256: string;
  confirmedOrganizationCount: number;
  confirmedApplicationCount: number;
};

export type CrossRoundIdentityQuality = {
  examined2026ConfirmedOrganizations: number;
  available2012ConfirmedOrganizations: number;
  candidateMappings: number;
  recommendConfirm: number;
  recommendReject: number;
  recommendAmbiguous: number;
  noPlausibleConfirmed2012Match: number;
  crossRoundConfirmed: 0;
  crossRoundCandidate: number;
  crossRoundAmbiguous: number;
  crossRoundRejected: number;
  unmatched2026Organizations: number;
  applicationsInRecommendConfirmMappings: number;
  returningClassificationsFinalized: 0;
  newClassificationsFinalized: 0;
  expandedClassificationsFinalized: 0;
  contractedClassificationsFinalized: 0;
  categoryInferencesCreated: 0;
};

export type CrossRoundOrganizationIdentitySnapshot = {
  schemaVersion: "cross-round-organization-identity-snapshot/1.0.0";
  methodVersion: "cross-round-organization-identity/1.0.0";
  registryVersion: "cross-round-organization-identity-registry/1.0.0";
  generatedAt: string;
  semanticContentSha256: string;
  pin2012: OrganizationLayerPin;
  pin2026Resolution: OrganizationLayerPin & {
    applicationGraphContentSha256: string;
  };
  evidence: CrossRoundEvidenceRef[];
  mappings: CrossRoundIdentityMapping[];
  quality: CrossRoundIdentityQuality;
  limitations: string[];
};

export type CrossRoundResearchDossier = {
  organization2026Id: string;
  organization2026Key: string;
  organization2012Id?: string | null;
  organization2012Key?: string | null;
  relationshipType: CrossRoundRelationshipType;
  reviewRecommendation: CrossRoundReviewRecommendation;
  recommendationReason: string;
  temporalAssessment: TemporalAssessment;
  notes: string;
  evidence: CrossRoundEvidenceRef[];
};

export type CrossRoundResearchPackage = {
  packageVersion: "cross-round-research-package/1.0.0";
  researchedAt: string;
  methodNote: string;
  dossiers: CrossRoundResearchDossier[];
};
