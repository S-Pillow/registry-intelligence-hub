import {
  ORGANIZATION_RESOLUTION_METHOD_VERSION,
  RESOLVED_2026_ORG_ENTITY_PREFIX,
} from "../constants";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type {
  OrganizationEvidenceRef,
  OrganizationResolutionSnapshot,
  ResolvedOrganization2026,
} from "../types";
import type { StewardReviewDossier } from "../review-types";
import { normalizeEvidenceIds, strongestStrength, validateReviewRecommendation } from "../validate-recommendation";
import type { ApplicantIdentityContext, IdentityEvidencePackage, IdentityRelationshipType } from "./types";

function orgId(key: string): string {
  return `${RESOLVED_2026_ORG_ENTITY_PREFIX}${key}`;
}

function relationshipTypesFor(dossier: IdentityEvidencePackage["dossiers"][number]): IdentityRelationshipType[] {
  const types: IdentityRelationshipType[] = [];
  if (dossier.applicantWebsiteHost) types.push("APPLICANT_WEBSITE");
  if (dossier.evidence.some((e) => /affiliate/i.test(`${e.summary} ${e.supportsClaim}`))) {
    types.push("AFFILIATE_OF");
  }
  if (dossier.directParentLegalName) types.push("DIRECT_PARENT");
  if (dossier.ultimateParentLegalName) types.push("ULTIMATE_PARENT");
  if (dossier.ultimateControlLegalName) types.push("ULTIMATE_CONTROL");
  if (dossier.evidence.some((e) => /email/i.test(e.title ?? "") || /email/i.test(e.summary))) {
    types.push("BUSINESS_EMAIL_DOMAIN");
  }
  return types;
}

function identityContextFor(
  dossier: IdentityEvidencePackage["dossiers"][number],
): ApplicantIdentityContext {
  return {
    representativeApplicationId: dossier.representativeApplicationId,
    applicantWebsiteHost: dossier.applicantWebsiteHost,
    applicantWebsiteUrl: dossier.applicantWebsiteUrl,
    directParentLegalName: dossier.directParentLegalName,
    ultimateParentLegalName: dossier.ultimateParentLegalName,
    ultimateControlLegalName: dossier.ultimateControlLegalName,
    evidenceExplanationLines: [...dossier.evidenceExplanationLines],
    relationshipTypes: relationshipTypesFor(dossier),
  };
}

/**
 * Attach ORG-RES-WEB-1 first-party ICANN identity evidence.
 * Never transitions mappings to CONFIRMED. Never silently changes existing CONFIRMED mappings.
 * Conflicting CONFIRMED mappings are flagged via AMBIGUOUS dossier path only when not already CONFIRMED.
 */
export function applyIdentityEvidencePackageToSnapshot(input: {
  snapshot: OrganizationResolutionSnapshot;
  package: IdentityEvidencePackage;
  generatedAt?: string;
}): OrganizationResolutionSnapshot {
  const { snapshot } = input;
  const research = input.package;
  const mappings = new Map(snapshot.applicantIdentityMappings.map((m) => [m.applicantLegalName, { ...m }]));
  const organizations = snapshot.organizations.map((o) => ({
    ...o,
    applicantLegalNames: [...o.applicantLegalNames],
    memberApplicationIds: [...o.memberApplicationIds],
    evidenceRefIds: [...o.evidenceRefIds],
  }));
  const evidenceById = new Map<string, OrganizationEvidenceRef>(
    snapshot.evidence.map((e) => [e.evidenceId, { ...e }]),
  );
  const dossiersByName = new Map<string, StewardReviewDossier>(
    (snapshot.stewardReviewDossiers ?? []).map((d) => [d.applicantLegalName, { ...d }]),
  );

  for (const dossier of research.dossiers) {
    if (dossier.resolutionState === ("CONFIRMED" as string)) {
      throw new Error(
        `Identity evidence package must not set CONFIRMED for ${dossier.applicantLegalName}`,
      );
    }
    const mapping = mappings.get(dossier.applicantLegalName);
    if (!mapping) {
      throw new Error(`Unknown applicant legal name in identity package: ${dossier.applicantLegalName}`);
    }

    // Existing CONFIRMED: never auto-change; flag conflict for review only
    if (mapping.resolutionState === "CONFIRMED") {
      const existingOrg = organizations.find((o) => o.organizationId === mapping.organizationId);
      const conflict =
        dossier.candidateOrganizationKey &&
        existingOrg &&
        existingOrg.organizationKey !== dossier.candidateOrganizationKey;
      if (conflict) {
        mapping.ambiguityNotes = [
          mapping.ambiguityNotes,
          `ORG-RES-WEB-1 CONFIRMED_CONFLICT vs ${dossier.candidateCanonicalName}: ${dossier.recommendationReason}`,
        ]
          .filter(Boolean)
          .join(" | ");
        mapping.identityContext = identityContextFor(dossier);
      }
      continue;
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
        if (existing.status !== "CONFIRMED") {
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
          existing.confidence = dossier.reviewRecommendation === "CONFIRM" ? "medium" : "low";
        } else {
          existing.applicantLegalNames = [
            ...new Set([...existing.applicantLegalNames, dossier.applicantLegalName]),
          ].sort((a, b) => a.localeCompare(b));
          existing.memberApplicationIds = [
            ...new Set([...existing.memberApplicationIds, ...mapping.applicationIds]),
          ].sort();
          existing.evidenceRefIds = normalizeEvidenceIds([...existing.evidenceRefIds, ...evidenceIds]);
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
          notes: `ORG-RES-WEB-1 identity evidence: ${dossier.reviewRecommendation}`,
        };
        organizations.push(org);
      }
    }

    mapping.resolutionState = dossier.resolutionState;
    if (organizationId && dossier.resolutionState !== "UNRESOLVED") {
      mapping.organizationId = organizationId;
    }
    mapping.evidenceRefIds = normalizeEvidenceIds([...mapping.evidenceRefIds, ...evidenceIds]);
    mapping.reason = `ORG-RES-WEB-1: ${dossier.recommendationReason}`;
    if (dossier.resolutionState === "AMBIGUOUS") {
      mapping.ambiguityNotes = dossier.recommendationReason;
    }
    mapping.identityContext = identityContextFor(dossier);

    const prior = dossiersByName.get(dossier.applicantLegalName);
    dossiersByName.set(dossier.applicantLegalName, {
      dossierId: `dossier:${dossier.applicantLegalName}`,
      applicantLegalName: dossier.applicantLegalName,
      observedApplicationCount: prior?.observedApplicationCount ?? mapping.applicationIds.length,
      officialContentionMemberships: prior?.officialContentionMemberships ?? 0,
      queueReasons: prior?.queueReasons ?? ["top-app-count"],
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

  const applicantIdentityMappings = [...mappings.values()].sort((a, b) =>
    a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const confirmedMappings = applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED");
  const confirmedApps = new Set(confirmedMappings.flatMap((m) => m.applicationIds));
  const dossiers = [...dossiersByName.values()].sort((a, b) =>
    a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  organizations.sort((a, b) => a.organizationId.localeCompare(b.organizationId));

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
    stewardDecisionProvenance: snapshot.stewardDecisionProvenance,
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
      dossiersResearched: dossiers.length,
      recommendConfirm: dossiers.filter((d) => d.reviewRecommendation === "CONFIRM").length,
      recommendKeepCandidate: dossiers.filter((d) => d.reviewRecommendation === "KEEP_CANDIDATE").length,
      recommendAmbiguous: dossiers.filter((d) => d.reviewRecommendation === "MARK_AMBIGUOUS").length,
      recommendReject: dossiers.filter((d) => d.reviewRecommendation === "REJECT_RELATIONSHIP").length,
      recommendNoEvidence: dossiers.filter((d) => d.reviewRecommendation === "NO_EVIDENCE").length,
    },
    limitations: [
      ...snapshot.limitations.filter((l) => !l.includes("ORG-RES-WEB-1 identity evidence")),
      "ORG-RES-WEB-1 identity evidence recommendations are not steward approvals and never auto-CONFIRM from website alone.",
    ],
  };

  return {
    ...draft,
    semanticContentSha256: hashOrganizationResolutionSnapshot(draft),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
