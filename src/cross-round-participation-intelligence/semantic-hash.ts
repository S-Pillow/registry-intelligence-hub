import { contentHash } from "@/normalization/hashes";
import type { CrossRoundParticipationIntelligenceSnapshot } from "./types";

export function participationIntelligenceSemanticHashInput(
  snapshot: Omit<CrossRoundParticipationIntelligenceSnapshot, "semanticContentSha256" | "generatedAt">,
): unknown {
  return {
    schemaVersion: snapshot.schemaVersion,
    methodVersion: snapshot.methodVersion,
    sourceCrossRoundIdentityHash: snapshot.sourceCrossRoundIdentityHash,
    source2012OrganizationPin: snapshot.source2012OrganizationPin,
    source2026OrganizationPin: snapshot.source2026OrganizationPin,
    source2026ApplicationGraphPin: snapshot.source2026ApplicationGraphPin,
    generatedFromConfirmedSubset: snapshot.generatedFromConfirmedSubset,
    organizationComparisons: [...snapshot.organizationComparisons]
      .map((c) => ({
        crossRoundIdentityId: c.crossRoundIdentityId,
        organization2012Id: c.organization2012Id,
        organization2026Id: c.organization2026Id,
        canonicalDisplayName: c.canonicalDisplayName,
        participationStatus: c.participationStatus,
        relationshipType: c.relationshipType,
        applications2012: c.applications2012,
        applications2026: c.applications2026,
        applicationDelta: c.applicationDelta,
        applicationPercentDelta: c.applicationPercentDelta,
        portfolioChange: c.portfolioChange,
        evidenceState: c.evidenceState,
        disclosureKeys: [...c.disclosureKeys].sort(),
      }))
      .sort((a, b) => a.crossRoundIdentityId.localeCompare(b.crossRoundIdentityId)),
    excludedCases: [...snapshot.excludedCases]
      .map((e) => ({
        organization2026Id: e.organization2026Id,
        organization2026CanonicalName: e.organization2026CanonicalName,
        organization2012Id: e.organization2012Id,
        organization2012CanonicalName: e.organization2012CanonicalName,
        crossRoundState: e.crossRoundState,
        relationshipType: e.relationshipType,
        exclusionReason: e.exclusionReason,
        label: e.label,
      }))
      .sort((a, b) => a.organization2026Id.localeCompare(b.organization2026Id)),
    summary: snapshot.summary,
    coverage: snapshot.coverage,
    limitations: [...snapshot.limitations].sort(),
    eligibilityNotes: snapshot.eligibilityNotes,
  };
}

export function hashParticipationIntelligenceSnapshot(
  snapshot: Omit<CrossRoundParticipationIntelligenceSnapshot, "semanticContentSha256" | "generatedAt">,
): string {
  return contentHash(participationIntelligenceSemanticHashInput(snapshot));
}
