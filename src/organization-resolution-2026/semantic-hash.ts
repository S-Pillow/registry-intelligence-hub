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
        // identityContext omitted when absent so pre-WEB-1 hashes remain stable
        ...(m.identityContext
          ? {
              identityContext: {
                representativeApplicationId: m.identityContext.representativeApplicationId,
                applicantWebsiteHost: m.identityContext.applicantWebsiteHost,
                applicantWebsiteUrl: m.identityContext.applicantWebsiteUrl,
                directParentLegalName: m.identityContext.directParentLegalName,
                ultimateParentLegalName: m.identityContext.ultimateParentLegalName,
                ultimateControlLegalName: m.identityContext.ultimateControlLegalName,
                evidenceExplanationLines: [...m.identityContext.evidenceExplanationLines],
                relationshipTypes: [...m.identityContext.relationshipTypes].sort(),
              },
            }
          : {}),
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
      .map((d) => {
        const base = {
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
        };
        // Optional steward-application fields omitted when absent so pre-steward
        // ORG-RES-2026-2 hash (04316e1c…) remains stable.
        if (d.stewardDecisionId || d.priorResolutionState) {
          return {
            ...base,
            stewardDecisionId: d.stewardDecisionId ?? null,
            stewardDecisionAuthority: d.stewardDecisionAuthority ?? null,
            stewardDecidedAt: d.stewardDecidedAt ?? null,
            priorResolutionState: d.priorResolutionState ?? null,
          };
        }
        return base;
      })
      .sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName)),
    ...(snapshot.stewardDecisionProvenance
      ? {
          stewardDecisionProvenance: {
            decisionId: snapshot.stewardDecisionProvenance.decisionId,
            authority: snapshot.stewardDecisionProvenance.authority,
            decidedAt: snapshot.stewardDecisionProvenance.decidedAt,
            scope: snapshot.stewardDecisionProvenance.scope,
            approvedApplicantLegalNames: [
              ...snapshot.stewardDecisionProvenance.approvedApplicantLegalNames,
            ].sort(),
            sourceEvidencePackageCommit: snapshot.stewardDecisionProvenance.sourceEvidencePackageCommit,
            sourceEvidencePackageSemanticHash:
              snapshot.stewardDecisionProvenance.sourceEvidencePackageSemanticHash,
            notes: snapshot.stewardDecisionProvenance.notes,
          },
        }
      : {}),
    ...(snapshot.web1StewardDecisionProvenance
      ? {
          web1StewardDecisionProvenance: {
            decisionId: snapshot.web1StewardDecisionProvenance.decisionId,
            authority: snapshot.web1StewardDecisionProvenance.authority,
            decidedAt: snapshot.web1StewardDecisionProvenance.decidedAt,
            scope: snapshot.web1StewardDecisionProvenance.scope,
            approvedApplicantLegalNames: [
              ...snapshot.web1StewardDecisionProvenance.approvedApplicantLegalNames,
            ].sort(),
            priorStewardDecisionId: snapshot.web1StewardDecisionProvenance.priorStewardDecisionId,
            sourceEvidencePackageSemanticHash:
              snapshot.web1StewardDecisionProvenance.sourceEvidencePackageSemanticHash,
            notes: snapshot.web1StewardDecisionProvenance.notes,
          },
        }
      : {}),
    ...(snapshot.brand1StewardDecisionProvenance
      ? {
          brand1StewardDecisionProvenance: {
            decisionId: snapshot.brand1StewardDecisionProvenance.decisionId,
            authority: snapshot.brand1StewardDecisionProvenance.authority,
            decidedAt: snapshot.brand1StewardDecisionProvenance.decidedAt,
            scope: snapshot.brand1StewardDecisionProvenance.scope,
            approvedApplicantLegalNames: [
              ...snapshot.brand1StewardDecisionProvenance.approvedApplicantLegalNames,
            ].sort(),
            priorStewardDecisionId: snapshot.brand1StewardDecisionProvenance.priorStewardDecisionId,
            sourceEvidencePackageSemanticHash:
              snapshot.brand1StewardDecisionProvenance.sourceEvidencePackageSemanticHash,
            notes: snapshot.brand1StewardDecisionProvenance.notes,
          },
        }
      : {}),
    quality: snapshot.quality,
    limitations: [...snapshot.limitations].sort(),
  };
}

export function hashOrganizationResolutionSnapshot(
  snapshot: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt">,
): string {
  return contentHash(organizationResolutionSemanticHashInput(snapshot));
}
