/** Shared with 2012 organization-promotion states. */
export type OrganizationResolutionState = "CONFIRMED" | "CANDIDATE" | "AMBIGUOUS" | "UNRESOLVED";

/**
 * Evidence strength rubric:
 * A — authoritative ownership/control
 * B — first-party explicit identity
 * C — strong corroborating public evidence
 * D — string/name similarity only (never sufficient to CONFIRMED)
 */
export type EvidenceStrength = "A" | "B" | "C" | "D";

export type OrganizationEvidenceSourceType =
  | "aps-publication"
  | "icann-public-summary"
  | "first-party-corporate"
  | "regulatory-registry"
  | "sec-filing"
  | "steward-note"
  | "2012-promotion-alias";

export type OrganizationEvidenceRef = {
  evidenceId: string;
  strength: EvidenceStrength;
  sourceType: OrganizationEvidenceSourceType;
  /** URL, snapshot id, or steward note id — not a local filesystem path. */
  sourceIdentifier: string;
  /** As-of date for the identity claim (ISO date preferred). */
  asOf: string;
  /** Short summary — never long copyrighted text. */
  summary: string;
  /** Exact identity claim this source supports. */
  supportsClaim: string;
};

export type OrganizationReviewState = "steward-approved" | "pending-steward" | "rejected";

export type OrganizationConfidence = "high" | "medium" | "low";

export type ResolvedOrganization2026 = {
  organizationId: string;
  organizationKey: string;
  canonicalName: string;
  status: Exclude<OrganizationResolutionState, "UNRESOLVED">;
  applicantLegalNames: string[];
  memberApplicationIds: string[];
  evidenceRefIds: string[];
  resolutionMethod: "organization-resolution-2026/1.0.0";
  confidence: OrganizationConfidence;
  reviewState: OrganizationReviewState;
  stewardDecision?: string;
  notes?: string;
  /** Steward-review hint only — never implies CROSS-ROUND-ID returning/new. */
  possible2012OrganizationKey?: string;
};

export type ApplicantIdentityMapping = {
  /** Exact published APS Applicant Name — preserved verbatim. */
  applicantLegalName: string;
  applicationIds: string[];
  resolutionState: OrganizationResolutionState;
  /** Set only when state is not UNRESOLVED and an Organization entity exists. */
  organizationId: string | null;
  evidenceRefIds: string[];
  /** Candidate-discovery key only — never auto-confirms. */
  normalizedKey: string;
  candidateClusterId: string | null;
  possible2012OrganizationKey: string | null;
  reason: string;
  ambiguityNotes?: string;
};

export type CandidateNameCluster = {
  clusterId: string;
  normalizedKey: string;
  applicantLegalNames: string[];
  applicationIds: string[];
  /** Always candidate-discovery — never confirmation. */
  discoveryOnly: true;
};

export type ApplicationPublicationPin = {
  schemaVersion: "registry-2026-publication/2.0.0";
  snapshotId: string;
  applicationGraphContentSha256: string;
  normalizedApplicationRecordsObserved: number;
  applicationRecordCoverageCompleteness: "partial" | "complete";
};

export type OrganizationResolutionQuality = {
  observedApplications: number;
  officialApplications: number;
  applicationCoverage: "PARTIAL";
  observedApplicantLegalNames: number;
  officialApplicants: number;
  applicantLegalNamesWithMultipleApplications: number;
  repeatedExactLegalNameCount: number;
  candidateOrganizationMappings: number;
  confirmedOrganizationMappings: number;
  ambiguousMappings: number;
  unresolvedApplicantLegalNames: number;
  applicationsCoveredByConfirmedOrganizations: number;
  confirmedApplicationCoverageRatio: number;
  confirmedOrganizationCount: number;
  candidateOrganizationCount: number;
  ambiguousOrganizationCount: number;
  candidateClusterCount: number;
  /** Product gate: only CONFIRMED mappings count. */
  productEligibleOrganizationCount: number;
  returningNewClassificationsCreated: 0;
  crossRoundIdentitiesCreated: 0;
  categoryInferencesCreated: 0;
};

export type OrganizationResolutionSnapshot = {
  schemaVersion: "organization-resolution-snapshot/1.0.0";
  methodVersion: "organization-resolution-2026/1.0.0";
  registryVersion: "organization-resolution-registry/1.0.0";
  applicationPublicationPin: ApplicationPublicationPin;
  organizations: ResolvedOrganization2026[];
  applicantIdentityMappings: ApplicantIdentityMapping[];
  candidateClusters: CandidateNameCluster[];
  evidence: OrganizationEvidenceRef[];
  quality: OrganizationResolutionQuality;
  semanticContentSha256: string;
  generatedAt: string;
  limitations: string[];
};

export type OrganizationResolutionOperation = {
  opId: string;
  opVersion: 1;
  organizationKey: string;
  canonicalOrganizationName: string;
  resolutionState: Exclude<OrganizationResolutionState, "UNRESOLVED">;
  confidence: OrganizationConfidence;
  reviewState: OrganizationReviewState;
  methodVersion: "organization-resolution-2026/1.0.0";
  evidenceRefIds: string[];
  /** Exact published Applicant Names covered by this op. */
  applicantLegalNames: string[];
  /** Optional explicit application id set; defaults to all apps for those legal names. */
  applicationIds?: string[];
  reason: string;
  createdAt: string;
  possible2012OrganizationKey?: string;
  stewardDecision?: string;
  notes?: string;
};

export type OrganizationResolutionRegistry = {
  registryVersion: "organization-resolution-registry/1.0.0";
  methodVersion: "organization-resolution-2026/1.0.0";
  evidence: OrganizationEvidenceRef[];
  operations: OrganizationResolutionOperation[];
};
