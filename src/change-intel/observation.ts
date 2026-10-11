import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { ContentionSetV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026ApplicationV2 } from "@/reveal-day-2026/publication-v2-types";
import {
  CHANGE_INTEL_OBSERVATION_VERSION,
  type ChangeIntelObservation,
  type ContentionMembershipKey,
  type SourceArtifactMeta,
  type TrackedApplicationFields,
} from "@/change-intel/types";
import {
  hashContentionMemberships,
  hashTrackedApplications,
  makeObservationId,
  sha256Hex,
  sortMemberships,
} from "@/change-intel/hash";
import {
  sortTrackedApplications,
  trackedFieldsFromBrowserApp,
  trackedFieldsFromPublicationApp,
} from "@/change-intel/tracked-fields";

export function membershipsFromContentionSets(sets: ContentionSetV1[]): ContentionMembershipKey[] {
  const keys: ContentionMembershipKey[] = [];
  for (const set of sets) {
    for (const member of set.members) {
      keys.push({
        contentionSetId: set.officialContentionSetId,
        applicationId: member.applicationId,
      });
    }
  }
  return sortMemberships(keys);
}

export function membershipsFromBrowserDocument(
  document: RegistryApplicationsDocumentV2,
): ContentionMembershipKey[] {
  const keys: ContentionMembershipKey[] = [];
  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      keys.push({ contentionSetId: setId, applicationId: app.applicationId });
    }
  }
  return sortMemberships(keys);
}

export function buildObservationFromTracked(input: {
  observedAt: string;
  previousObservationId: string | null;
  bootstrap: boolean;
  applicationSource: SourceArtifactMeta;
  contentionSource: SourceArtifactMeta;
  applications: TrackedApplicationFields[];
  contentionMemberships: ContentionMembershipKey[];
  officialApplications: number | null;
  officialApplicants: number | null;
}): ChangeIntelObservation {
  const applications = sortTrackedApplications(input.applications);
  const contentionMemberships = sortMemberships(input.contentionMemberships);
  const applicationsSemanticHash = hashTrackedApplications(applications);
  const contentionSemanticHash = hashContentionMemberships(contentionMemberships);
  const setIds = new Set(contentionMemberships.map((m) => m.contentionSetId));
  return {
    version: CHANGE_INTEL_OBSERVATION_VERSION,
    observationId: makeObservationId(input.observedAt, applicationsSemanticHash),
    observedAt: input.observedAt,
    previousObservationId: input.previousObservationId,
    bootstrap: input.bootstrap,
    applicationSource: input.applicationSource,
    contentionSource: input.contentionSource,
    officialApplications: input.officialApplications,
    officialApplicants: input.officialApplicants,
    observedApplicationRecords: applications.length,
    officialContentionSets: setIds.size,
    officialContentionMemberships: contentionMemberships.length,
    applications,
    contentionMemberships,
    applicationsSemanticHash,
    contentionSemanticHash,
  };
}

export function buildObservationFromBrowserDocument(input: {
  document: RegistryApplicationsDocumentV2;
  observedAt?: string;
  previousObservationId?: string | null;
  bootstrap?: boolean;
  applicationContentSha256?: string;
  contentionContentSha256?: string;
}): ChangeIntelObservation {
  const document = input.document;
  const observedAt = input.observedAt ?? document.checkedAt ?? document.retrievedAt;
  const applications = document.applications.map(trackedFieldsFromBrowserApp);
  const contentionMemberships = membershipsFromBrowserDocument(document);
  const applicationSource: SourceArtifactMeta = {
    sourceUrl: document.source.url,
    contentSha256: input.applicationContentSha256 ?? document.rawSha256,
    retrievedAt: document.retrievedAt,
    recordCount: document.observedApplicationRecords,
    semanticHash: document.snapshotContentHash,
  };
  const contentionSource: SourceArtifactMeta = {
    sourceUrl: "official-initial-contention-overlay",
    contentSha256:
      input.contentionContentSha256
      ?? document.contentionOverlay.rawSha256
      ?? document.contentionOverlay.sidecarContentSha256
      ?? sha256Hex("unavailable"),
    retrievedAt: document.retrievedAt,
    recordCount: document.contentionOverlay.joinedMemberCount ?? contentionMemberships.length,
    semanticHash:
      document.contentionOverlay.sidecarContentSha256
      ?? sha256Hex(JSON.stringify(contentionMemberships)),
  };
  return buildObservationFromTracked({
    observedAt,
    previousObservationId: input.previousObservationId ?? null,
    bootstrap: input.bootstrap ?? false,
    applicationSource,
    contentionSource,
    applications,
    contentionMemberships,
    officialApplications: document.officialApplications,
    officialApplicants: document.officialApplicants,
  });
}

export function buildObservationFromNormalizedSources(input: {
  observedAt: string;
  previousObservationId: string | null;
  bootstrap: boolean;
  applications: Registry2026ApplicationV2[];
  contentionSets: ContentionSetV1[];
  applicationSource: SourceArtifactMeta;
  contentionSource: SourceArtifactMeta;
  officialApplications?: number | null;
  officialApplicants?: number | null;
}): ChangeIntelObservation {
  return buildObservationFromTracked({
    observedAt: input.observedAt,
    previousObservationId: input.previousObservationId,
    bootstrap: input.bootstrap,
    applicationSource: input.applicationSource,
    contentionSource: input.contentionSource,
    applications: input.applications.map(trackedFieldsFromPublicationApp),
    contentionMemberships: membershipsFromContentionSets(input.contentionSets),
    officialApplications: input.officialApplications ?? null,
    officialApplicants: input.officialApplicants ?? null,
  });
}
