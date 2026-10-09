import { contentHash } from "@/normalization/hashes";
import type { CrossRoundOrganizationIdentitySnapshot } from "./types";

/**
 * Deterministic semantic hash input — excludes generatedAt / row order / local paths.
 */
export function crossRoundIdentitySemanticHashInput(
  snapshot: Omit<CrossRoundOrganizationIdentitySnapshot, "semanticContentSha256" | "generatedAt">,
): unknown {
  return {
    schemaVersion: snapshot.schemaVersion,
    methodVersion: snapshot.methodVersion,
    registryVersion: snapshot.registryVersion,
    pin2012: snapshot.pin2012,
    pin2026Resolution: snapshot.pin2026Resolution,
    evidence: [...snapshot.evidence]
      .map((e) => ({
        evidenceId: e.evidenceId,
        strength: e.strength,
        sourceType: e.sourceType,
        sourceIdentifier: e.sourceIdentifier,
        title: e.title ?? null,
        evidenceAsOf: e.evidenceAsOf,
        retrievedAt: e.retrievedAt,
        supportsClaim: e.supportsClaim,
        temporalRelevance: e.temporalRelevance,
        limitations: e.limitations,
        summary: e.summary,
      }))
      .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    mappings: [...snapshot.mappings]
      .map((m) => ({
        crossRoundIdentityId: m.crossRoundIdentityId,
        organization2012Id: m.organization2012Id,
        organization2012Key: m.organization2012Key,
        organization2012CanonicalName: m.organization2012CanonicalName,
        organization2012ApplicationCount: m.organization2012ApplicationCount,
        organization2026Id: m.organization2026Id,
        organization2026Key: m.organization2026Key,
        organization2026CanonicalName: m.organization2026CanonicalName,
        organization2026ApplicationCount: m.organization2026ApplicationCount,
        state: m.state,
        relationshipType: m.relationshipType,
        evidenceRefIds: [...m.evidenceRefIds].sort(),
        temporalAssessment: {
          continuityClaim: m.temporalAssessment.continuityClaim,
          knownEvents: [...m.temporalAssessment.knownEvents].sort(),
          acquisitionAfter2012: m.temporalAssessment.acquisitionAfter2012,
          renameContinuity: m.temporalAssessment.renameContinuity,
          stewardJudgmentRequired: m.temporalAssessment.stewardJudgmentRequired,
          limitations: m.temporalAssessment.limitations,
        },
        reviewRecommendation: m.reviewRecommendation,
        recommendationReason: m.recommendationReason,
        stewardDecision: m.stewardDecision,
        notes: m.notes,
      }))
      .sort((a, b) => a.crossRoundIdentityId.localeCompare(b.crossRoundIdentityId)),
    // Omit absent provenance so pre-steward hash stays bit-identical to CROSS-ROUND-ID-1.
    ...(snapshot.stewardDecisionProvenance
      ? {
          stewardDecisionProvenance: {
            decisionId: snapshot.stewardDecisionProvenance.decisionId,
            authority: snapshot.stewardDecisionProvenance.authority,
            decidedAt: snapshot.stewardDecisionProvenance.decidedAt,
            scope: snapshot.stewardDecisionProvenance.scope,
            approvedPairs: [...snapshot.stewardDecisionProvenance.approvedPairs]
              .map((p) => ({
                organization2026Id: p.organization2026Id,
                organization2012Id: p.organization2012Id,
                relationshipType: p.relationshipType,
              }))
              .sort(
                (a, b) =>
                  a.organization2026Id.localeCompare(b.organization2026Id) ||
                  a.organization2012Id.localeCompare(b.organization2012Id),
              ),
            sourceEvidencePackageCommit: snapshot.stewardDecisionProvenance.sourceEvidencePackageCommit,
            sourceEvidencePackageSemanticHash:
              snapshot.stewardDecisionProvenance.sourceEvidencePackageSemanticHash,
            notes: snapshot.stewardDecisionProvenance.notes,
          },
        }
      : {}),
    quality: snapshot.quality,
    limitations: [...snapshot.limitations].sort(),
  };
}

export function hashCrossRoundOrganizationIdentitySnapshot(
  snapshot: Omit<CrossRoundOrganizationIdentitySnapshot, "semanticContentSha256" | "generatedAt">,
): string {
  return contentHash(crossRoundIdentitySemanticHashInput(snapshot));
}
