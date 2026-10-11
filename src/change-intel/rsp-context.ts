import { buildParticipantIntelligence } from "@/lib/participant-intelligence";
import {
  buildRspOpportunityIntelligence,
  type ApplicantRspPosture,
} from "@/lib/rsp-opportunity-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  type ContentionSetV1,
} from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026ApplicationV2 } from "@/reveal-day-2026/publication-v2-types";

/** Build a minimal browser document shape for RSP posture derivation (no Reveal Day mutation). */
export function browserDocumentFromNormalized(input: {
  applications: Registry2026ApplicationV2[];
  contentionSets: ContentionSetV1[];
  snapshotId?: string;
}): RegistryApplicationsDocumentV2 {
  const membershipByApp = new Map<string, string[]>();
  for (const set of input.contentionSets) {
    for (const member of set.members) {
      const list = membershipByApp.get(member.applicationId) ?? [];
      list.push(set.officialContentionSetId);
      membershipByApp.set(member.applicationId, list);
    }
  }
  const applications = input.applications.map((app) => {
    const sets = membershipByApp.get(app.applicationId) ?? [];
    return {
      applicationId: app.applicationId,
      applicant: app.applicant,
      country: app.country,
      region: app.region,
      applicationStatus: app.applicationStatus,
      processingStage: app.processingStage,
      applicationType: app.applicationType,
      priority: app.priority,
      designations: app.designations,
      labels: app.labels,
      appliedString: app.appliedString,
      replacementString: app.replacementString,
      officialContention: sets.length
        ? {
            membershipPresent: true as const,
            officialContentionSetIds: [...sets].sort((a, b) => a.localeCompare(b)),
            terminology: "official-initial-contention" as const,
          }
        : {
            membershipPresent: false as const,
            officialContentionSetIds: [] as [],
            terminology: "official-initial-contention" as const,
          },
    };
  });
  const memberships = [...membershipByApp.values()].reduce((n, ids) => n + ids.length, 0);
  const applicantCount = new Set(applications.map((a) => a.applicant)).size;
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "inactive-2x",
    snapshotId: input.snapshotId ?? "change-intel-ephemeral",
    snapshotContentHash: "change-intel-ephemeral",
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: new Date(0).toISOString(),
    retrievedAt: new Date(0).toISOString(),
    checkedAt: new Date(0).toISOString(),
    parserVersion: "change-intel",
    normalizerVersion: "change-intel",
    source: { name: "change-intel", url: "local", evidenceClass: "change-intel" },
    limitations: [],
    disclosureKeys: [],
    officialAggregates: {
      officialApplicationCount: applications.length,
      officialApplicantCount: applicantCount,
      provenance: {
        sourceName: "change-intel",
        sourceUrl: "local",
        retrievedAt: new Date(0).toISOString(),
        contentSha256: "change-intel",
      },
    },
    applicationRecordCoverage: {
      observed: applications.length,
      official: applications.length,
      completeness: "partial",
      knownExcludedRecords: [],
    },
    officialApplications: applications.length,
    observedApplicationRecords: applications.length,
    officialApplicants: applicantCount,
    knownExcludedRecords: [],
    bundleManifest: {
      officialAggregatesContentSha256: "change-intel",
      coverageDescriptorSha256: "change-intel",
      applicationGraphContentSha256: "change-intel",
    },
    rawSha256: "change-intel",
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "change-intel-contention",
      sidecarContentSha256: "change-intel",
      rawSha256: "change-intel",
      applicationPublicationPinHash: "change-intel",
      officialContentionSetCount: input.contentionSets.length,
      joinedMemberCount: memberships,
    },
    applications,
  };
}

export function buildRspPostureMap(
  document: RegistryApplicationsDocumentV2,
): Map<string, ApplicantRspPosture> {
  const intelligence = buildParticipantIntelligence(document);
  const artifact = loadEvaluatedMainRspArtifact();
  const rsp = buildRspOpportunityIntelligence(intelligence, artifact);
  return new Map(rsp.postures.map((p) => [p.applicantLegalName, p]));
}
