import {
  ORGANIZATION_RESOLUTION_METHOD_VERSION,
  RESOLVED_2026_ORG_ENTITY_PREFIX,
} from "./constants";
import type { ResearchQueueEntry } from "./review-types";
import type { ResearchPackage } from "./review-types";
import { strongestStrength, validateReviewRecommendation } from "./validate-recommendation";
import { normalizeEvidenceIds } from "./validate-recommendation";
import type {
  OrganizationEvidenceRef,
  OrganizationResolutionSnapshot,
  ResolvedOrganization2026,
} from "./types";
import type { StewardReviewDossier } from "./review-types";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";

function orgId(key: string): string {
  return `${RESOLVED_2026_ORG_ENTITY_PREFIX}${key}`;
}

/**
 * Attach ORG-RES-2026-2 research dossiers to a base snapshot.
 * Never transitions mappings to CONFIRMED from research alone.
 */
export function applyResearchPackageToSnapshot(input: {
  snapshot: OrganizationResolutionSnapshot;
  queue: ResearchQueueEntry[];
  research: ResearchPackage;
  generatedAt?: string;
}): OrganizationResolutionSnapshot {
  const { snapshot, queue, research } = input;
  const queueByName = new Map(queue.map((q) => [q.applicantLegalName, q]));
  const mappings = new Map(snapshot.applicantIdentityMappings.map((m) => [m.applicantLegalName, { ...m }]));
  const organizations = [...snapshot.organizations.map((o) => ({ ...o, applicantLegalNames: [...o.applicantLegalNames], memberApplicationIds: [...o.memberApplicationIds], evidenceRefIds: [...o.evidenceRefIds] }))];
  const evidenceById = new Map<string, OrganizationEvidenceRef>(
    snapshot.evidence.map((e) => [e.evidenceId, { ...e }]),
  );
  const dossiers: StewardReviewDossier[] = [];

  for (const dossier of research.dossiers) {
    if (dossier.resolutionState === ("CONFIRMED" as string)) {
      throw new Error(
        `Research package must not set CONFIRMED for ${dossier.applicantLegalName} — steward approval required`,
      );
    }
    const queueRow = queueByName.get(dossier.applicantLegalName);
    if (!queueRow) {
      throw new Error(`Research dossier not in queue: ${dossier.applicantLegalName}`);
    }
    const mapping = mappings.get(dossier.applicantLegalName);
    if (!mapping) {
      throw new Error(`Unknown applicant legal name in research: ${dossier.applicantLegalName}`);
    }

    validateReviewRecommendation({
      recommendation: dossier.reviewRecommendation,
      evidence: dossier.evidence,
      claimsParentSubsidiaryCollapse: Boolean(
        dossier.candidateCanonicalName &&
          dossier.candidateCanonicalName !== dossier.applicantLegalName &&
          dossier.reviewRecommendation === "CONFIRM",
      ),
      selfResolution: dossier.candidateCanonicalName === dossier.applicantLegalName,
    });

    for (const item of dossier.evidence) {
      evidenceById.set(item.evidenceId, {
        evidenceId: item.evidenceId,
        strength: item.strength,
        sourceType: item.sourceType,
        sourceIdentifier: item.sourceIdentifier,
        asOf: item.asOf,
        summary: item.summary,
        supportsClaim: item.supportsClaim,
        title: item.title,
        retrievedAt: item.retrievedAt,
        temporalRelevance: item.temporalRelevance,
        limitations: item.limitations,
      });
    }

    const evidenceIds = normalizeEvidenceIds(dossier.evidence.map((e) => e.evidenceId));
    let organizationId: string | null = mapping.organizationId;
    let organizationKey: string | null = null;

    if (dossier.candidateOrganizationKey && dossier.resolutionState !== "UNRESOLVED") {
      organizationKey = dossier.candidateOrganizationKey;
      organizationId = orgId(organizationKey);
      const existing = organizations.find((o) => o.organizationId === organizationId);
      if (existing) {
        // Research must not upgrade to CONFIRMED
        if (existing.status === "CONFIRMED") {
          /* keep confirmed from prior steward registry only */
        } else {
          existing.status = dossier.resolutionState;
          existing.canonicalName = dossier.candidateCanonicalName ?? existing.canonicalName;
          existing.applicantLegalNames = [
            ...new Set([...existing.applicantLegalNames, dossier.applicantLegalName]),
          ].sort((a, b) => a.localeCompare(b));
          existing.memberApplicationIds = [
            ...new Set([...existing.memberApplicationIds, ...mapping.applicationIds]),
          ].sort();
          existing.evidenceRefIds = normalizeEvidenceIds([...existing.evidenceRefIds, ...evidenceIds]);
          existing.reviewState = "pending-steward";
          existing.notes = dossier.recommendationReason;
          existing.possible2012OrganizationKey =
            dossier.possible2012OrganizationKey ?? existing.possible2012OrganizationKey;
        }
      } else {
        const org: ResolvedOrganization2026 = {
          organizationId,
          organizationKey,
          canonicalName: dossier.candidateCanonicalName ?? dossier.applicantLegalName,
          status: dossier.resolutionState,
          applicantLegalNames: [dossier.applicantLegalName],
          memberApplicationIds: [...mapping.applicationIds],
          evidenceRefIds: evidenceIds,
          resolutionMethod: ORGANIZATION_RESOLUTION_METHOD_VERSION,
          confidence: dossier.reviewRecommendation === "CONFIRM" ? "medium" : "low",
          reviewState: "pending-steward",
          notes: `ORG-RES-2026-2 research recommendation: ${dossier.reviewRecommendation}`,
          possible2012OrganizationKey: dossier.possible2012OrganizationKey ?? undefined,
        };
        organizations.push(org);
      }
    }

    // Never auto-confirm from research
    const nextState =
      mapping.resolutionState === "CONFIRMED"
        ? "CONFIRMED"
        : dossier.resolutionState === "UNRESOLVED"
          ? mapping.resolutionState === "CANDIDATE" || mapping.resolutionState === "AMBIGUOUS"
            ? mapping.resolutionState
            : "UNRESOLVED"
          : dossier.resolutionState;

    mapping.resolutionState = nextState;
    if (organizationId && nextState !== "UNRESOLVED") {
      mapping.organizationId = organizationId;
    }
    mapping.evidenceRefIds = normalizeEvidenceIds([...mapping.evidenceRefIds, ...evidenceIds]);
    mapping.possible2012OrganizationKey =
      dossier.possible2012OrganizationKey ?? mapping.possible2012OrganizationKey;
    mapping.reason = `ORG-RES-2026-2: ${dossier.recommendationReason}`;
    if (dossier.resolutionState === "AMBIGUOUS") {
      mapping.ambiguityNotes = dossier.recommendationReason;
    }

    dossiers.push({
      dossierId: `dossier:${dossier.applicantLegalName}`,
      applicantLegalName: dossier.applicantLegalName,
      observedApplicationCount: queueRow.observedApplicationCount,
      officialContentionMemberships: queueRow.officialContentionMemberships,
      queueReasons: queueRow.queueReasons,
      resolutionState: mapping.resolutionState,
      candidateOrganizationKey: organizationKey,
      candidateOrganizationId: organizationId,
      candidateCanonicalName: dossier.candidateCanonicalName,
      possible2012OrganizationKey: mapping.possible2012OrganizationKey,
      reviewRecommendation: dossier.reviewRecommendation,
      recommendationReason: dossier.recommendationReason,
      requiredStewardAction: dossier.requiredStewardAction,
      strongestEvidenceStrength: strongestStrength(dossier.evidence.map((e) => e.strength)),
      evidenceIds,
      temporalNote: dossier.temporalNote,
      stewardDecision: "",
    });
  }

  // Include queue entries without research package rows as NO_EVIDENCE placeholders
  for (const q of queue) {
    if (dossiers.some((d) => d.applicantLegalName === q.applicantLegalName)) continue;
    const mapping = mappings.get(q.applicantLegalName)!;
    dossiers.push({
      dossierId: `dossier:${q.applicantLegalName}`,
      applicantLegalName: q.applicantLegalName,
      observedApplicationCount: q.observedApplicationCount,
      officialContentionMemberships: q.officialContentionMemberships,
      queueReasons: q.queueReasons,
      resolutionState: mapping.resolutionState,
      candidateOrganizationKey: null,
      candidateOrganizationId: mapping.organizationId,
      candidateCanonicalName: null,
      possible2012OrganizationKey: mapping.possible2012OrganizationKey,
      reviewRecommendation: "NO_EVIDENCE",
      recommendationReason: "No bounded public A/B identity evidence retained in this ticket",
      requiredStewardAction: "Leave UNRESOLVED or supply steward evidence",
      strongestEvidenceStrength: null,
      evidenceIds: [],
      temporalNote: "n/a",
      stewardDecision: "",
    });
  }

  dossiers.sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName));
  organizations.sort((a, b) => a.organizationId.localeCompare(b.organizationId));

  const applicantIdentityMappings = [...mappings.values()].sort((a, b) =>
    a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const confirmedMappings = applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED");
  const confirmedApps = new Set(confirmedMappings.flatMap((m) => m.applicationIds));

  const draft: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: snapshot.schemaVersion,
    methodVersion: snapshot.methodVersion,
    registryVersion: snapshot.registryVersion,
    applicationPublicationPin: snapshot.applicationPublicationPin,
    organizations,
    applicantIdentityMappings,
    candidateClusters: snapshot.candidateClusters,
    evidence: [...evidenceById.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    stewardReviewDossiers: dossiers,
    quality: {
      ...snapshot.quality,
      candidateOrganizationMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "CANDIDATE")
        .length,
      confirmedOrganizationMappings: confirmedMappings.length,
      ambiguousMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "AMBIGUOUS").length,
      unresolvedApplicantLegalNames: applicantIdentityMappings.filter((m) => m.resolutionState === "UNRESOLVED")
        .length,
      applicationsCoveredByConfirmedOrganizations: confirmedApps.size,
      confirmedApplicationCoverageRatio:
        snapshot.quality.observedApplications === 0
          ? 0
          : confirmedApps.size / snapshot.quality.observedApplications,
      confirmedOrganizationCount: organizations.filter((o) => o.status === "CONFIRMED").length,
      candidateOrganizationCount: organizations.filter((o) => o.status === "CANDIDATE").length,
      ambiguousOrganizationCount: organizations.filter((o) => o.status === "AMBIGUOUS").length,
      productEligibleOrganizationCount: organizations.filter((o) => o.status === "CONFIRMED").length,
      returningNewClassificationsCreated: 0,
      crossRoundIdentitiesCreated: 0,
      categoryInferencesCreated: 0,
      dossiersResearched: dossiers.length,
      recommendConfirm: dossiers.filter((d) => d.reviewRecommendation === "CONFIRM").length,
      recommendKeepCandidate: dossiers.filter((d) => d.reviewRecommendation === "KEEP_CANDIDATE").length,
      recommendAmbiguous: dossiers.filter((d) => d.reviewRecommendation === "MARK_AMBIGUOUS").length,
      recommendReject: dossiers.filter((d) => d.reviewRecommendation === "REJECT_RELATIONSHIP").length,
      recommendNoEvidence: dossiers.filter((d) => d.reviewRecommendation === "NO_EVIDENCE").length,
    },
    limitations: [
      ...snapshot.limitations,
      "ORG-RES-2026-2 research recommendations are not steward approvals and never unlock Organization product metrics.",
    ],
  };

  return {
    ...draft,
    semanticContentSha256: hashOrganizationResolutionSnapshot(draft),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
