import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";
import {
  CROSS_ROUND_ORG_IDENTITY_METHOD_VERSION,
  CROSS_ROUND_ORG_IDENTITY_REGISTRY_VERSION,
  CROSS_ROUND_ORG_IDENTITY_SCHEMA_VERSION,
  EXPECTED_2012_CONFIRMED_APPLICATIONS,
  EXPECTED_2012_CONFIRMED_ORGANIZATIONS,
  EXPECTED_2026_CONFIRMED_APPLICATIONS,
  EXPECTED_2026_CONFIRMED_ORGANIZATIONS,
  PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
} from "./constants";
import { unmatchedDoesNotImplyNewDisclosure } from "./eligibility";
import type { Loaded2012ConfirmedUniverse } from "./load-2012-confirmed";
import { hashCrossRoundOrganizationIdentitySnapshot } from "./semantic-hash";
import type {
  CrossRoundEvidenceRef,
  CrossRoundIdentityMapping,
  CrossRoundIdentityState,
  CrossRoundOrganizationIdentitySnapshot,
  CrossRoundResearchPackage,
  CrossRoundReviewRecommendation,
} from "./types";

function stateFromRecommendation(rec: CrossRoundReviewRecommendation): CrossRoundIdentityState {
  switch (rec) {
    case "CONFIRM":
      return "CANDIDATE";
    case "REJECT":
      return "REJECTED";
    case "AMBIGUOUS":
      return "AMBIGUOUS";
    case "NO_MATCH":
      return "UNMATCHED";
  }
}

function mappingId(organization2026Id: string, organization2012Id: string | null): string {
  const right = organization2012Id ?? "unmatched";
  return `xri:${organization2026Id}:${right}`;
}

/**
 * Build cross-round identity snapshot from pinned 2012/2026 confirmed universes + research package.
 * Never creates steward-approved CONFIRMED mappings.
 */
export function buildCrossRoundOrganizationIdentitySnapshot(input: {
  universe2012: Loaded2012ConfirmedUniverse;
  snapshot2026: OrganizationResolutionSnapshot;
  research: CrossRoundResearchPackage;
  generatedAt?: string;
}): CrossRoundOrganizationIdentitySnapshot {
  const { universe2012, snapshot2026, research } = input;

  if (snapshot2026.semanticContentSha256 !== PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256) {
    throw new Error(
      `2026 Organization-resolution pin mismatch: expected ${PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256}, got ${snapshot2026.semanticContentSha256}`,
    );
  }
  if (
    snapshot2026.applicationPublicationPin.applicationGraphContentSha256 !==
    PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error(
      `2026 Application graph pin mismatch: expected ${PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256}, got ${snapshot2026.applicationPublicationPin.applicationGraphContentSha256}`,
    );
  }

  const confirmed2026 = snapshot2026.organizations.filter((o) => o.status === "CONFIRMED");
  if (confirmed2026.length !== EXPECTED_2026_CONFIRMED_ORGANIZATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2026_CONFIRMED_ORGANIZATIONS} CONFIRMED 2026 Organizations, got ${confirmed2026.length}`,
    );
  }
  const confirmed2026Apps = snapshot2026.quality.applicationsCoveredByConfirmedOrganizations;
  if (confirmed2026Apps !== EXPECTED_2026_CONFIRMED_APPLICATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2026_CONFIRMED_APPLICATIONS} confirmed 2026 Applications, got ${confirmed2026Apps}`,
    );
  }
  if (universe2012.organizations.length !== EXPECTED_2012_CONFIRMED_ORGANIZATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2012_CONFIRMED_ORGANIZATIONS} CONFIRMED 2012 Organizations, got ${universe2012.organizations.length}`,
    );
  }
  if (universe2012.pin.confirmedApplicationCount !== EXPECTED_2012_CONFIRMED_APPLICATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2012_CONFIRMED_APPLICATIONS} confirmed 2012 Applications, got ${universe2012.pin.confirmedApplicationCount}`,
    );
  }

  const org2026ById = new Map(confirmed2026.map((o) => [o.organizationId, o]));
  const org2012ById = new Map(universe2012.organizations.map((o) => [o.organizationId, o]));
  const org2012ByKey = new Map(universe2012.organizations.map((o) => [o.organizationKey, o]));

  // Fail closed: research may only reference CONFIRMED 2026 orgs and CONFIRMED 2012 orgs (or null)
  const seen2026 = new Set<string>();
  const evidenceById = new Map<string, CrossRoundEvidenceRef>();
  const mappings: CrossRoundIdentityMapping[] = [];

  for (const dossier of research.dossiers) {
    if (seen2026.has(dossier.organization2026Id)) {
      throw new Error(`Duplicate research dossier for ${dossier.organization2026Id}`);
    }
    seen2026.add(dossier.organization2026Id);

    const org2026 = org2026ById.get(dossier.organization2026Id);
    if (!org2026 || org2026.status !== "CONFIRMED") {
      throw new Error(
        `Research dossier ${dossier.organization2026Id} is outside CONFIRMED 2026 universe — fail closed`,
      );
    }
    if (org2026.organizationKey !== dossier.organization2026Key) {
      throw new Error(
        `Research dossier key mismatch for ${dossier.organization2026Id}: ${dossier.organization2026Key} vs ${org2026.organizationKey}`,
      );
    }

    let org2012 = null as ReturnType<typeof org2012ById.get> | null;
    if (dossier.organization2012Id) {
      org2012 = org2012ById.get(dossier.organization2012Id) ?? null;
      if (!org2012) {
        throw new Error(
          `Research references non-CONFIRMED or unknown 2012 Organization ${dossier.organization2012Id}`,
        );
      }
      if (dossier.organization2012Key && dossier.organization2012Key !== org2012.organizationKey) {
        throw new Error(
          `2012 key mismatch for ${dossier.organization2012Id}: ${dossier.organization2012Key} vs ${org2012.organizationKey}`,
        );
      }
      // Guard: never allow candidate/ambiguous 2012 keys
      if (!org2012ByKey.has(org2012.organizationKey)) {
        throw new Error(`2012 Organization ${org2012.organizationKey} not in confirmed universe`);
      }
    } else if (dossier.reviewRecommendation !== "NO_MATCH") {
      throw new Error(
        `Dossier ${dossier.organization2026Id} lacks organization2012Id but recommendation is ${dossier.reviewRecommendation}`,
      );
    }

    for (const ev of dossier.evidence) {
      if (evidenceById.has(ev.evidenceId) && evidenceById.get(ev.evidenceId)!.supportsClaim !== ev.supportsClaim) {
        throw new Error(`Duplicate evidenceId with conflicting payload: ${ev.evidenceId}`);
      }
      evidenceById.set(ev.evidenceId, ev);
    }

    // Name similarity alone cannot CONFIRM
    if (dossier.reviewRecommendation === "CONFIRM") {
      const strengths = dossier.evidence.map((e) => e.strength);
      if (!strengths.some((s) => s === "A" || s === "B")) {
        throw new Error(`CONFIRM recommendation for ${dossier.organization2026Id} requires A/B evidence`);
      }
      if (strengths.every((s) => s === "D")) {
        throw new Error(`CONFIRM cannot rest on D-only (name similarity) evidence`);
      }
      if (dossier.temporalAssessment.acquisitionAfter2012 && dossier.relationshipType === "SAME_ORGANIZATION") {
        throw new Error(
          `Acquisition-after-2012 cannot be SAME_ORGANIZATION for ${dossier.organization2026Id}`,
        );
      }
    }

    mappings.push({
      crossRoundIdentityId: mappingId(dossier.organization2026Id, dossier.organization2012Id ?? null),
      organization2012Id: org2012?.organizationId ?? null,
      organization2012Key: org2012?.organizationKey ?? null,
      organization2012CanonicalName: org2012?.canonicalOrganizationName ?? null,
      organization2012ApplicationCount: org2012?.memberApplicationIds.length ?? 0,
      organization2026Id: org2026.organizationId,
      organization2026Key: org2026.organizationKey,
      organization2026CanonicalName: org2026.canonicalName,
      organization2026ApplicationCount: org2026.memberApplicationIds.length,
      state: stateFromRecommendation(dossier.reviewRecommendation),
      relationshipType: dossier.relationshipType,
      evidenceRefIds: dossier.evidence.map((e) => e.evidenceId),
      temporalAssessment: dossier.temporalAssessment,
      reviewRecommendation: dossier.reviewRecommendation,
      recommendationReason: dossier.recommendationReason,
      stewardDecision: null,
      notes: dossier.notes,
    });
  }

  // Every confirmed 2026 Organization must appear exactly once
  for (const org of confirmed2026) {
    if (!seen2026.has(org.organizationId)) {
      throw new Error(`Missing research dossier for confirmed 2026 Organization ${org.organizationId}`);
    }
  }

  const recommendConfirm = mappings.filter((m) => m.reviewRecommendation === "CONFIRM");
  const quality = {
    examined2026ConfirmedOrganizations: confirmed2026.length,
    available2012ConfirmedOrganizations: universe2012.organizations.length,
    candidateMappings: mappings.filter((m) => m.state === "CANDIDATE").length,
    recommendConfirm: recommendConfirm.length,
    recommendReject: mappings.filter((m) => m.reviewRecommendation === "REJECT").length,
    recommendAmbiguous: mappings.filter((m) => m.reviewRecommendation === "AMBIGUOUS").length,
    noPlausibleConfirmed2012Match: mappings.filter((m) => m.reviewRecommendation === "NO_MATCH").length,
    crossRoundConfirmed: 0 as const,
    crossRoundCandidate: mappings.filter((m) => m.state === "CANDIDATE").length,
    crossRoundAmbiguous: mappings.filter((m) => m.state === "AMBIGUOUS").length,
    crossRoundRejected: mappings.filter((m) => m.state === "REJECTED").length,
    unmatched2026Organizations: mappings.filter((m) => m.state === "UNMATCHED").length,
    applicationsInRecommendConfirmMappings: recommendConfirm.reduce(
      (sum, m) => sum + m.organization2026ApplicationCount,
      0,
    ),
    returningClassificationsFinalized: 0 as const,
    newClassificationsFinalized: 0 as const,
    expandedClassificationsFinalized: 0 as const,
    contractedClassificationsFinalized: 0 as const,
    categoryInferencesCreated: 0 as const,
  };

  if (quality.crossRoundConfirmed !== 0) {
    throw new Error("CROSS-ROUND-ID-1 must not create CONFIRMED cross-round mappings");
  }

  const withoutHash = {
    schemaVersion: CROSS_ROUND_ORG_IDENTITY_SCHEMA_VERSION,
    methodVersion: CROSS_ROUND_ORG_IDENTITY_METHOD_VERSION,
    registryVersion: CROSS_ROUND_ORG_IDENTITY_REGISTRY_VERSION,
    pin2012: universe2012.pin,
    pin2026Resolution: {
      round: 2026 as const,
      schemaOrRegistryVersion: snapshot2026.schemaVersion,
      methodVersion: snapshot2026.methodVersion,
      contentSha256: snapshot2026.semanticContentSha256,
      confirmedOrganizationCount: confirmed2026.length,
      confirmedApplicationCount: confirmed2026Apps,
      applicationGraphContentSha256: snapshot2026.applicationPublicationPin.applicationGraphContentSha256,
    },
    evidence: [...evidenceById.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    mappings: mappings.sort((a, b) => a.crossRoundIdentityId.localeCompare(b.crossRoundIdentityId)),
    quality,
    limitations: [
      unmatchedDoesNotImplyNewDisclosure(),
      "Offline 2012 promotion registry includes candidate/ambiguous records that are excluded from the confirmed historical identity universe.",
      `Excluded candidate 2012 keys: ${universe2012.excludedCandidateOrganizationKeys.join(", ") || "(none)"}.`,
      `Excluded ambiguous 2012 keys: ${universe2012.excludedAmbiguousOrganizationKeys.join(", ") || "(none)"}.`,
      "Recommendations are not steward approvals. ORG-RES-2026-2A approvals do not authorize cross-round identity.",
      "Returning/new/expanded/contracted classifications remain 0 until CROSS-ROUND-ID-1A steward application.",
      "Contention Org Name is irrelevant to cross-round Organization identity.",
      "Category/sector inference is out of scope.",
    ],
  };

  return {
    ...withoutHash,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    semanticContentSha256: hashCrossRoundOrganizationIdentitySnapshot(withoutHash),
  };
}
