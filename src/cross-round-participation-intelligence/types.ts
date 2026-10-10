export type ParticipationStatus = "RETURNING";

export type PortfolioChangeClassification = "EXPANDED" | "CONTRACTED" | "UNCHANGED";

export type NewOrganizationMetricStatus = {
  status: "BLOCKED_SOURCE";
  numericCount: null;
  reason: string;
};

export type OrganizationParticipationComparison = {
  crossRoundIdentityId: string;
  organization2012Id: string;
  organization2026Id: string;
  canonicalDisplayName: string;
  participationStatus: ParticipationStatus;
  relationshipType: string;
  applications2012: number;
  applications2026: number;
  applicationDelta: number;
  applicationPercentDelta: number;
  portfolioChange: PortfolioChangeClassification;
  evidenceState: "steward-confirmed-cross-round-identity";
  disclosureKeys: readonly string[];
};

export type ExcludedCrossRoundCase = {
  organization2026Id: string;
  organization2026CanonicalName: string;
  organization2012Id: string | null;
  organization2012CanonicalName: string | null;
  crossRoundState: "REJECTED" | "AMBIGUOUS" | "UNMATCHED";
  relationshipType: string;
  exclusionReason: string;
  label: string;
};

export type ParticipationCoverage = {
  confirmed2012Organizations: number;
  confirmed2012Applications: number;
  confirmed2026Organizations: number;
  confirmed2026Applications: number;
  confirmedCrossRoundIdentities: number;
  representedApplications2012: number;
  representedApplications2026: number;
  crossRoundIdentityCoverageOf2026ConfirmedOrganizations: number;
  crossRoundIdentityCoverageOf2026ConfirmedApplications: number;
  crossRoundIdentityCoverageOf2012ConfirmedOrganizations: number;
  crossRoundIdentityCoverageOf2012ConfirmedApplications: number;
  /** Explicit: these are identity-resolution coverage ratios, not round coverage. */
  coverageKind: "confirmed-subset-identity-resolution";
};

export type ParticipationIntelligenceSummary = {
  confirmedReturningOrganizations: number;
  returningApplications2026: number;
  representedApplications2012: number;
  representedApplications2026: number;
  expandedConfirmed: number;
  contractedConfirmed: number;
  unchangedConfirmed: number;
  combinedConfirmedSubsetApplicationDelta: number;
  newOrganizationMetric: NewOrganizationMetricStatus;
  generatedFromConfirmedSubset: true;
};

export type CrossRoundParticipationIntelligenceSnapshot = {
  schemaVersion: "cross-round-participation-intelligence-snapshot/1.0.0";
  methodVersion: "cross-round-participation-intelligence/1.0.0";
  generatedAt: string;
  semanticContentSha256: string;
  sourceCrossRoundIdentityHash: string;
  source2012OrganizationPin: string;
  source2026OrganizationPin: string;
  source2026ApplicationGraphPin: string;
  generatedFromConfirmedSubset: true;
  organizationComparisons: OrganizationParticipationComparison[];
  excludedCases: ExcludedCrossRoundCase[];
  summary: ParticipationIntelligenceSummary;
  coverage: ParticipationCoverage;
  limitations: string[];
  eligibilityNotes: {
    confirmedReturning: "CONFIRMED_SUBSET_READY_WITH_LIMITATION";
    confirmedExpanded: "CONFIRMED_SUBSET_READY_WITH_LIMITATION";
    confirmedContracted: "CONFIRMED_SUBSET_READY_WITH_LIMITATION";
    confirmedUnchanged: "CONFIRMED_SUBSET_READY_WITH_LIMITATION";
    completeReturning: "BLOCKED_SOURCE";
    completeNew: "BLOCKED_SOURCE";
    completeExpandedContracted: "BLOCKED_SOURCE";
  };
};
