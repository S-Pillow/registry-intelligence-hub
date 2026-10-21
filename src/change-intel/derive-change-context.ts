import { applicantProfileHref } from "@/lib/applicant-intelligence";
import { organizationProfileHref } from "@/lib/organization-intelligence";
import {
  displayImpactLabel,
  displayImpactReasons,
  displayRspPostureLine,
} from "@/change-intel/impact-display";
import { changeMateriality } from "@/change-intel/materiality";
import type {
  ChangeInvestigationView,
  ChangeRecord,
  ContentionMembershipKey,
  DerivedChangeContext,
  DerivedChangeOrganizationContext,
  ChangeIntelObservation,
} from "@/change-intel/types";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export type OrganizationLookupRow = {
  applicantLegalName: string;
  resolutionState: "CONFIRMED" | "CANDIDATE" | "AMBIGUOUS" | "UNRESOLVED";
  organizationId: string | null;
  organizationKey: string | null;
  organizationName: string | null;
};

export function organizationLookupFromSnapshot(
  snapshot: OrganizationResolutionSnapshot,
): {
  hash: string;
  generatedAt: string;
  byApplicant: Map<string, OrganizationLookupRow>;
} {
  const orgById = new Map(snapshot.organizations.map((o) => [o.organizationId, o] as const));
  const byApplicant = new Map<string, OrganizationLookupRow>();
  for (const m of snapshot.applicantIdentityMappings) {
    const org =
      m.resolutionState === "CONFIRMED" && m.organizationId
        ? orgById.get(m.organizationId)
        : undefined;
    byApplicant.set(m.applicantLegalName, {
      applicantLegalName: m.applicantLegalName,
      resolutionState: m.resolutionState,
      organizationId: m.resolutionState === "CONFIRMED" ? m.organizationId : null,
      organizationKey: org?.organizationKey ?? null,
      organizationName: org?.canonicalName ?? null,
    });
  }
  return {
    hash: snapshot.semanticContentSha256,
    generatedAt: snapshot.generatedAt,
    byApplicant,
  };
}

export function deriveOrganizationContext(input: {
  applicantLegalName: string | null;
  snapshotHash: string;
  snapshotGeneratedAt: string | null;
  lookup: Map<string, OrganizationLookupRow>;
}): DerivedChangeOrganizationContext {
  const empty = (state: DerivedChangeOrganizationContext["organizationResolutionState"]): DerivedChangeOrganizationContext => ({
    organizationSnapshotHash: input.snapshotHash,
    organizationSnapshotGeneratedAt: input.snapshotGeneratedAt,
    organizationResolutionState: state,
    confirmedOrganizationId: null,
    confirmedOrganizationKey: null,
    confirmedOrganizationName: null,
    organizationHref: null,
  });

  if (!input.applicantLegalName) return empty("MISSING");
  const row = input.lookup.get(input.applicantLegalName);
  if (!row) return empty("MISSING");
  if (row.resolutionState !== "CONFIRMED") {
    return empty(row.resolutionState);
  }
  if (!row.organizationId || !row.organizationKey || !row.organizationName) {
    return empty("MISSING");
  }
  return {
    organizationSnapshotHash: input.snapshotHash,
    organizationSnapshotGeneratedAt: input.snapshotGeneratedAt,
    organizationResolutionState: "CONFIRMED",
    confirmedOrganizationId: row.organizationId,
    confirmedOrganizationKey: row.organizationKey,
    confirmedOrganizationName: row.organizationName,
    organizationHref: organizationProfileHref(row.organizationKey),
  };
}

/**
 * Contention membership basis for investigation links — historical observation only.
 * Never substitutes live publication memberships.
 */
export function contentionObservationBasis(
  change: ChangeRecord,
): "source" | "target" | "record" {
  switch (change.changeType) {
    case "APPLICATION_NO_LONGER_PRESENT":
    case "CONTENTION_MEMBERSHIP_REMOVED":
      return change.changeType === "CONTENTION_MEMBERSHIP_REMOVED" ? "record" : "source";
    case "APPLICATION_NOW_PRESENT":
    case "APPLICATION_FIELD_CHANGED":
    case "CONTENTION_MEMBERSHIP_ADDED":
      return change.changeType.startsWith("CONTENTION_") ? "record" : "target";
    default:
      return "target";
  }
}

export function deriveContentionSetIds(input: {
  change: ChangeRecord;
  sourceObservation: ChangeIntelObservation | null;
  targetObservation: ChangeIntelObservation | null;
}): string[] {
  const { change } = input;
  if (change.contentionSetId) {
    return [change.contentionSetId];
  }
  if (!change.applicationId) return [];

  const basis = contentionObservationBasis(change);
  let memberships: ContentionMembershipKey[] | null = null;
  if (basis === "source") {
    memberships = input.sourceObservation?.contentionMemberships ?? null;
  } else if (basis === "target") {
    memberships = input.targetObservation?.contentionMemberships ?? null;
  } else {
    // record already carries the set id when present; nothing further
    return change.contentionSetId ? [change.contentionSetId] : [];
  }
  if (!memberships) return [];
  return [
    ...new Set(
      memberships
        .filter((m) => m.applicationId === change.applicationId)
        .map((m) => m.contentionSetId),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function contentionHref(setId: string): string {
  return `/contention?set=${encodeURIComponent(setId)}`;
}

export function deriveChangeContext(input: {
  change: ChangeRecord;
  snapshotHash: string;
  snapshotGeneratedAt: string | null;
  organizationLookup: Map<string, OrganizationLookupRow>;
  sourceObservation: ChangeIntelObservation | null;
  targetObservation: ChangeIntelObservation | null;
}): DerivedChangeContext {
  const organization = deriveOrganizationContext({
    applicantLegalName: input.change.applicantLegalName,
    snapshotHash: input.snapshotHash,
    snapshotGeneratedAt: input.snapshotGeneratedAt,
    lookup: input.organizationLookup,
  });

  // Applicant legal name on the ChangeRecord is authoritative — never replace it.
  const applicantName = input.change.applicantLegalName;
  const contentionSetIds = deriveContentionSetIds({
    change: input.change,
    sourceObservation: input.sourceObservation,
    targetObservation: input.targetObservation,
  });

  return {
    materiality: changeMateriality(input.change),
    organization,
    contentionSetIds,
    links: {
      exploreHref: input.change.exploreHref,
      competitiveLandscapeHref: input.change.competitiveLandscapeHref,
      applicantHref: applicantName ? applicantProfileHref(applicantName) : null,
      organizationHref: organization.organizationHref,
      contentionSets: contentionSetIds.map((id) => ({
        contentionSetId: id,
        href: contentionHref(id),
      })),
      // Single-subject changes cannot form a valid multi-subject Compare URL.
      compareHref: null,
    },
    displayImpactLabel: displayImpactLabel(input.change.primaryImpact),
    displayImpactReasons: displayImpactReasons(input.change.impactReasons),
    displayRspPosture: displayRspPostureLine(
      input.change.rspPublicPosture,
      input.change.primaryImpact,
    ),
  };
}

export function toInvestigationView(
  change: ChangeRecord,
  derived: DerivedChangeContext,
): ChangeInvestigationView {
  return { change, derived };
}

/** Deterministic: same ChangeRecord + same Organization snapshot inputs → same derived context. */
export function deriveChangeContextDeterministic(
  a: DerivedChangeContext,
  b: DerivedChangeContext,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
