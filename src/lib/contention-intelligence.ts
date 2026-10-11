/**
 * Set-centric official 2026 initial contention intelligence (CONT-INTEL-1).
 * Reuses browser officialContention overlay + GoDaddy focal Applicant + RSP/org overlays.
 * Does not invent exact-string contention or final-outcome claims.
 */

import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  exploreApplicantHref,
  type OrganizationResolutionOverlayStatus,
  type ParticipantIntelligence,
  type ParticipantOverlays,
} from "@/lib/participant-intelligence";
import {
  buildRspOpportunityIntelligence,
  prospectingPostureLabel,
  type ApplicantRspPosture,
  type RspOpportunityIntelligence,
} from "@/lib/rsp-opportunity-intelligence";
import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";

export type ContentionMemberRow = {
  applicationId: string;
  appliedForString: string;
  applicantLegalName: string;
  region: string | null;
  isGodaddyApplicant: boolean;
  organizationResolutionStatus: OrganizationResolutionOverlayStatus;
  confirmedOrganizationName: string | null;
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  evidenceExplanationLines: string[];
  rspPublicPostureLabel: string;
  exploreApplicationHref: string;
  exploreApplicantHref: string;
  competitiveLandscapeHref: string;
};

export type ContentionSetRow = {
  setId: string;
  appliedForStrings: string[];
  totalApplications: number;
  godaddyApplications: number;
  nonGodaddyApplications: number;
  distinctApplicants: number;
  distinctCounterpartApplicants: number;
  includesGodaddy: boolean;
  members: ContentionMemberRow[];
  /** Compact public-RSP summary for list views (counterparts only). */
  publicRspContextSummary: string;
};

export type ContentionLandscapeMetrics = {
  officialSets: number;
  officialMemberships: number;
  godaddyMemberships: number;
  uniqueGodaddySets: number;
  uniqueCounterpartApplicants: number;
  counterpartMembershipsInGodaddySets: number;
  averageMembersPerSet: number;
  largestSetSize: number;
  largestGodaddySetSize: number;
};

export type ContentionIntelligence = {
  focalApplicantLegalName: string;
  metrics: ContentionLandscapeMetrics;
  sets: ContentionSetRow[];
  godaddySets: ContentionSetRow[];
  asOf: {
    snapshotId: string;
    publishedAt: string;
    retrievedAt: string;
    checkedAt: string;
    contentionSnapshotId: string | null;
    terminology: string;
  };
  participantIntelligence: ParticipantIntelligence;
  rspIntelligence: RspOpportunityIntelligence;
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function compareSetPriority(a: ContentionSetRow, b: ContentionSetRow): number {
  return (
    b.totalApplications - a.totalApplications ||
    b.distinctCounterpartApplicants - a.distinctCounterpartApplicants ||
    a.setId.localeCompare(b.setId, undefined, { numeric: true }) ||
    (a.appliedForStrings[0] ?? "").localeCompare(b.appliedForStrings[0] ?? "")
  );
}

function rspSummaryForCounterparts(
  members: ContentionMemberRow[],
  focalName: string,
): string {
  const counterparts = members.filter((m) => m.applicantLegalName !== focalName);
  if (counterparts.length === 0) return "No non-GoDaddy counterparts";
  const noPublic = counterparts.filter((m) =>
    m.rspPublicPostureLabel === "No public Main-RSP capability found",
  ).length;
  const publicFound = counterparts.filter((m) =>
    m.rspPublicPostureLabel === "Public Main-RSP capability found" ||
    m.rspPublicPostureLabel === "Main-RSP capability via confirmed organization",
  ).length;
  const review = counterparts.filter((m) => m.rspPublicPostureLabel === "Identity review needed").length;
  const parts: string[] = [];
  if (noPublic > 0) parts.push(`${noPublic} relevant for RSP research`);
  if (publicFound > 0) parts.push(`${publicFound} public Main-RSP`);
  if (review > 0) parts.push(`${review} identity review`);
  return parts.length > 0 ? parts.join(" · ") : "Mixed / other postures";
}

/**
 * Build set-centric official initial contention intelligence.
 * Membership universe matches Change Intelligence / browser officialContention overlay.
 */
export function buildContentionIntelligence(
  document: RegistryApplicationsDocumentV2,
  overlays: ParticipantOverlays | undefined,
  evaluatedRsp: EvaluatedMainRspArtifact,
  options?: { focalApplicantLegalName?: string },
): ContentionIntelligence {
  const focalName = options?.focalApplicantLegalName ?? GODADDY_FOCAL_APPLICANT_LEGAL_NAME;
  const participantIntelligence = buildParticipantIntelligence(document, overlays, {
    focalApplicantLegalName: focalName,
  });
  const rspIntelligence = buildRspOpportunityIntelligence(participantIntelligence, evaluatedRsp);
  const postureByApplicant = new Map<string, ApplicantRspPosture>(
    rspIntelligence.postures.map((p) => [p.applicantLegalName, p]),
  );
  const orgByName = new Map(
    (overlays?.organizations ?? []).map((o) => [o.applicantLegalName, o] as const),
  );

  type AccMember = {
    applicationId: string;
    appliedForString: string;
    applicantLegalName: string;
    region: string | null;
  };
  const setMembers = new Map<string, AccMember[]>();

  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      let list = setMembers.get(setId);
      if (!list) {
        list = [];
        setMembers.set(setId, list);
      }
      list.push({
        applicationId: app.applicationId,
        appliedForString: app.appliedString?.label ?? "",
        applicantLegalName: app.applicant,
        region: app.region ?? null,
      });
    }
  }

  // Stable member order within sets (independent of source application order)
  for (const [setId, list] of setMembers) {
    list.sort(
      (a, b) =>
        a.applicationId.localeCompare(b.applicationId) ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    );
    setMembers.set(setId, list);
  }

  const sets: ContentionSetRow[] = [...setMembers.entries()].map(([setId, rawMembers]) => {
    const members: ContentionMemberRow[] = rawMembers.map((m) => {
      const org = orgByName.get(m.applicantLegalName);
      const status: OrganizationResolutionOverlayStatus = org?.resolutionStatus ?? "UNRESOLVED";
      const confirmedName =
        status === "CONFIRMED" ? (org?.confirmedOrganizationName ?? null) : null;
      const posture = postureByApplicant.get(m.applicantLegalName);
      const rspLabel = posture
        ? prospectingPostureLabel(posture.rspProspectingPosture)
        : "No public Main-RSP capability found";
      const identity = org?.identityEvidence;
      return {
        applicationId: m.applicationId,
        appliedForString: m.appliedForString,
        applicantLegalName: m.applicantLegalName,
        region: m.region,
        isGodaddyApplicant: m.applicantLegalName === focalName,
        organizationResolutionStatus: status,
        confirmedOrganizationName: confirmedName,
        applicantWebsiteHost: identity?.applicantWebsiteHost ?? null,
        applicantWebsiteUrl: identity?.applicantWebsiteUrl ?? null,
        directParentLegalName: identity?.directParentLegalName ?? null,
        ultimateParentLegalName: identity?.ultimateParentLegalName ?? null,
        ultimateControlLegalName: identity?.ultimateControlLegalName ?? null,
        evidenceExplanationLines: identity?.evidenceExplanationLines ?? [],
        rspPublicPostureLabel: rspLabel,
        exploreApplicationHref: `/explore?q=${encodeURIComponent(m.applicationId)}`,
        exploreApplicantHref: exploreApplicantHref(m.applicantLegalName),
        competitiveLandscapeHref: `/competitive-landscape?q=${encodeURIComponent(m.applicantLegalName)}`,
      };
    });

    const applicants = new Set(members.map((m) => m.applicantLegalName));
    const godaddyApplications = members.filter((m) => m.isGodaddyApplicant).length;
    const counterpartApplicants = [...applicants].filter((n) => n !== focalName);
    const includesGodaddy = godaddyApplications > 0;

    return {
      setId,
      appliedForStrings: uniqueSorted(members.map((m) => m.appliedForString)),
      totalApplications: members.length,
      godaddyApplications,
      nonGodaddyApplications: members.length - godaddyApplications,
      distinctApplicants: applicants.size,
      distinctCounterpartApplicants: counterpartApplicants.length,
      includesGodaddy,
      members,
      publicRspContextSummary: includesGodaddy
        ? rspSummaryForCounterparts(members, focalName)
        : "—",
    };
  });

  sets.sort(compareSetPriority);
  const godaddySets = sets.filter((s) => s.includesGodaddy);

  let godaddyMemberships = 0;
  let counterpartMembershipsInGodaddySets = 0;
  const counterpartNames = new Set<string>();
  for (const set of godaddySets) {
    godaddyMemberships += set.godaddyApplications;
    counterpartMembershipsInGodaddySets += set.nonGodaddyApplications;
    for (const m of set.members) {
      if (!m.isGodaddyApplicant) counterpartNames.add(m.applicantLegalName);
    }
  }

  const officialSetsFromOverlay = document.contentionOverlay.officialContentionSetCount ?? 0;
  const officialMembershipsFromOverlay = document.contentionOverlay.joinedMemberCount ?? 0;
  // Prefer overlay counts (accepted pin) when present; derived set map must agree.
  const officialSets = officialSetsFromOverlay || sets.length;
  const officialMemberships =
    officialMembershipsFromOverlay ||
    [...setMembers.values()].reduce((n, list) => n + list.length, 0);

  const largestSetSize = sets.reduce((max, s) => Math.max(max, s.totalApplications), 0);
  const largestGodaddySetSize = godaddySets.reduce((max, s) => Math.max(max, s.totalApplications), 0);

  return {
    focalApplicantLegalName: focalName,
    metrics: {
      officialSets,
      officialMemberships,
      godaddyMemberships,
      uniqueGodaddySets: godaddySets.length,
      uniqueCounterpartApplicants: counterpartNames.size,
      counterpartMembershipsInGodaddySets,
      averageMembersPerSet: officialSets === 0 ? 0 : officialMemberships / officialSets,
      largestSetSize,
      largestGodaddySetSize,
    },
    sets,
    godaddySets,
    asOf: {
      snapshotId: document.snapshotId,
      publishedAt: document.publishedAt,
      retrievedAt: document.retrievedAt,
      checkedAt: document.checkedAt,
      contentionSnapshotId: document.contentionOverlay.snapshotId ?? null,
      terminology: "official-initial-contention",
    },
    participantIntelligence,
    rspIntelligence,
  };
}

export type ContentionGodaddyFilter = "all" | "includes-godaddy" | "excludes-godaddy";
export type ContentionSizeFilter = "all" | "2" | "3-4" | "5+";

export type ContentionViewFilter = {
  view?: "godaddy" | "all";
  q?: string;
  godaddy?: ContentionGodaddyFilter;
  size?: ContentionSizeFilter;
};

function sizeMatches(total: number, size: ContentionSizeFilter): boolean {
  if (size === "all") return true;
  if (size === "2") return total === 2;
  if (size === "3-4") return total >= 3 && total <= 4;
  if (size === "5+") return total >= 5;
  return true;
}

export function filterContentionSets(
  sets: ContentionSetRow[],
  filter: ContentionViewFilter = {},
): ContentionSetRow[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  const godaddy = filter.godaddy ?? "all";
  const size = filter.size ?? "all";

  return sets.filter((set) => {
    if (godaddy === "includes-godaddy" && !set.includesGodaddy) return false;
    if (godaddy === "excludes-godaddy" && set.includesGodaddy) return false;
    if (!sizeMatches(set.totalApplications, size)) return false;
    if (!q) return true;
    if (set.setId.toLowerCase().includes(q)) return true;
    if (set.appliedForStrings.some((s) => s.toLowerCase().includes(q))) return true;
    if (set.members.some((m) => m.applicantLegalName.toLowerCase().includes(q))) return true;
    if (set.members.some((m) => m.applicationId.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function contentionSetHref(setId: string): string {
  return `/contention?set=${encodeURIComponent(setId)}`;
}

export function contentionPageHref(params: {
  view?: "godaddy" | "all";
  q?: string;
  set?: string;
  godaddy?: ContentionGodaddyFilter;
  size?: ContentionSizeFilter;
}): string {
  const sp = new URLSearchParams();
  if (params.view && params.view !== "godaddy") sp.set("view", params.view);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.set) sp.set("set", params.set);
  if (params.godaddy && params.godaddy !== "all") sp.set("godaddy", params.godaddy);
  if (params.size && params.size !== "all") sp.set("size", params.size);
  const qs = sp.toString();
  return qs ? `/contention?${qs}` : "/contention";
}

export { exploreApplicantApplicationsHref, exploreApplicantHref };
