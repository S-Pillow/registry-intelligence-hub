import { contentHash } from "@/normalization/hashes";
import type { OrganizationResolutionSnapshot } from "./types";

/**
 * Semantic hash inputs — excludes generatedAt and incidental retrieval metadata.
 * Order of arrays is normalized so row/order changes do not alter the hash.
 */
export function organizationResolutionSemanticHashInput(
  snapshot: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt">,
): unknown {
  return {
    schemaVersion: snapshot.schemaVersion,
    methodVersion: snapshot.methodVersion,
    registryVersion: snapshot.registryVersion,
    applicationPublicationPin: {
      schemaVersion: snapshot.applicationPublicationPin.schemaVersion,
      snapshotId: snapshot.applicationPublicationPin.snapshotId,
      applicationGraphContentSha256: snapshot.applicationPublicationPin.applicationGraphContentSha256,
      normalizedApplicationRecordsObserved:
        snapshot.applicationPublicationPin.normalizedApplicationRecordsObserved,
      applicationRecordCoverageCompleteness:
        snapshot.applicationPublicationPin.applicationRecordCoverageCompleteness,
    },
    organizations: [...snapshot.organizations]
      .map((org) => ({
        organizationId: org.organizationId,
        organizationKey: org.organizationKey,
        canonicalName: org.canonicalName,
        status: org.status,
        applicantLegalNames: [...org.applicantLegalNames].sort(),
        memberApplicationIds: [...org.memberApplicationIds].sort(),
        evidenceRefIds: [...org.evidenceRefIds].sort(),
        resolutionMethod: org.resolutionMethod,
        confidence: org.confidence,
        reviewState: org.reviewState,
        stewardDecision: org.stewardDecision ?? null,
        notes: org.notes ?? null,
        possible2012OrganizationKey: org.possible2012OrganizationKey ?? null,
      }))
      .sort((a, b) => a.organizationId.localeCompare(b.organizationId)),
    applicantIdentityMappings: [...snapshot.applicantIdentityMappings]
      .map((m) => ({
        applicantLegalName: m.applicantLegalName,
        applicationIds: [...m.applicationIds].sort(),
        resolutionState: m.resolutionState,
        organizationId: m.organizationId,
        evidenceRefIds: [...m.evidenceRefIds].sort(),
        normalizedKey: m.normalizedKey,
        candidateClusterId: m.candidateClusterId,
        possible2012OrganizationKey: m.possible2012OrganizationKey,
        reason: m.reason,
        ambiguityNotes: m.ambiguityNotes ?? null,
      }))
      .sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName)),
    candidateClusters: [...snapshot.candidateClusters]
      .map((c) => ({
        clusterId: c.clusterId,
        normalizedKey: c.normalizedKey,
        applicantLegalNames: [...c.applicantLegalNames].sort(),
        applicationIds: [...c.applicationIds].sort(),
        discoveryOnly: true as const,
      }))
      .sort((a, b) => a.clusterId.localeCompare(b.clusterId)),
    evidence: [...snapshot.evidence]
      .map((e) => ({
        evidenceId: e.evidenceId,
        strength: e.strength,
        sourceType: e.sourceType,
        sourceIdentifier: e.sourceIdentifier,
        asOf: e.asOf,
        summary: e.summary,
        supportsClaim: e.supportsClaim,
        title: e.title ?? null,
        temporalRelevance: e.temporalRelevance ?? null,
        limitations: e.limitations ?? null,
        // retrievedAt excluded — incidental retrieval timestamp
      }))
      .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    stewardReviewDossiers: [...(snapshot.stewardReviewDossiers ?? [])]
      .map((d) => ({
        dossierId: d.dossierId,
        applicantLegalName: d.applicantLegalName,
        observedApplicationCount: d.observedApplicationCount,
        officialContentionMemberships: d.officialContentionMemberships,
        queueReasons: [...d.queueReasons].sort(),
        resolutionState: d.resolutionState,
        candidateOrganizationKey: d.candidateOrganizationKey,
        candidateOrganizationId: d.candidateOrganizationId,
        candidateCanonicalName: d.candidateCanonicalName,
        possible2012OrganizationKey: d.possible2012OrganizationKey,
        reviewRecommendation: d.reviewRecommendation,
        recommendationReason: d.recommendationReason,
        requiredStewardAction: d.requiredStewardAction,
        strongestEvidenceStrength: d.strongestEvidenceStrength,
        evidenceIds: [...d.evidenceIds].sort(),
        temporalNote: d.temporalNote,
        // stewardDecision blank until operator acts — included when set
        stewardDecision: d.stewardDecision || "",
      }))
      .sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName)),
    quality: snapshot.quality,
    limitations: [...snapshot.limitations].sort(),
  };
}

export function hashOrganizationResolutionSnapshot(
  snapshot: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt">,
): string {
  return contentHash(organizationResolutionSemanticHashInput(snapshot));
}
