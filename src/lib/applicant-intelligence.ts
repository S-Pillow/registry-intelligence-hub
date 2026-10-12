/**
 * Applicant Intelligence Profiles (APPLICANT-INTEL-1).
 * Derives a research profile from existing participant / org / contention / RSP overlays.
 * Applicant = exact ICANN legal name. Organization = optional evidence-backed enrichment.
 */

import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  exploreApplicantHref,
  type OrganizationResolutionOverlayStatus,
  type ParticipantIdentityEvidenceOverlay,
  type ParticipantOverlays,
  type ParticipantReturningOverlay,
  type ParticipantRow,
} from "@/lib/participant-intelligence";
import { organizationKeyFromOverlays, organizationProfileHref } from "@/lib/organization-intelligence";
import {
  buildRspOpportunityIntelligence,
  prospectingPostureLabel,
  type ApplicantRspPosture,
  type RspProspectingPosture,
} from "@/lib/rsp-opportunity-intelligence";
import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { contentionSetHref } from "@/lib/contention-intelligence";

export type ApplicantPortfolioRow = {
  applicationId: string;
  appliedForString: string;
  brand: boolean;
  community: boolean;
  idn: boolean;
  geographic: boolean;
  applicationStatus: string | null;
  processingStage: string | null;
  region: string | null;
  country: string | null;
  inInitialContention: boolean;
  officialContentionSetIds: string[];
  exploreHref: string;
};

export type ApplicantContentionSetMember = {
  applicationId: string;
  appliedForString: string;
  applicantLegalName: string;
  isFocalApplicant: boolean;
  exploreHref: string;
  profileHref: string;
};

export type ApplicantContentionSetSummary = {
  setId: string;
  appliedForStrings: string[];
  applicationCount: number;
  distinctApplicantCount: number;
  applicantApplicationIds: string[];
  includesGodaddy: boolean;
  contentionSetHref: string;
  /** Applications in the set — Applications may outnumber distinct Applicants. */
  members: ApplicantContentionSetMember[];
};

export type ApplicantOrganizationSibling = {
  applicantLegalName: string;
  applicationCount: number;
  profileHref: string;
};

export type ApplicantChangeSummary = {
  hasMaterialChanges: boolean;
  summaryLine: string;
  changesHref: string;
};

export type ApplicantIntelligenceProfile = {
  found: true;
  applicantLegalName: string;
  profileHref: string;
  countries: string[];
  regions: string[];
  organizationResolutionStatus: OrganizationResolutionOverlayStatus;
  confirmedOrganizationId: string | null;
  confirmedOrganizationName: string | null;
  /** Present only when Confirmed and canonical key is known. */
  organizationProfileHref: string | null;
  identityEvidence: ParticipantIdentityEvidenceOverlay | null;
  brandApplicationCount: number;
  applicationCount: number;
  contestedApplicationCount: number;
  uniqueContentionSets: number;
  distinctCounterpartApplicants: number;
  rspPosture: RspProspectingPosture;
  rspPostureLabel: string;
  rspProspectingReason: string;
  portfolio: ApplicantPortfolioRow[];
  contentionSets: ApplicantContentionSetSummary[];
  counterparts: Array<{
    applicantLegalName: string;
    sharedContentionSets: number;
    organizationResolutionStatus: OrganizationResolutionOverlayStatus;
    confirmedOrganizationName: string | null;
    profileHref: string;
  }>;
  organizationContext: {
    organizationName: string;
    organizationId: string;
    siblingApplicants: ApplicantOrganizationSibling[];
    siblingApplicantCount: number;
    organizationApplicationCount: number;
    organizationContentionMemberships: number;
  } | null;
  confirmedReturning: ParticipantReturningOverlay | null;
  changeSummary: ApplicantChangeSummary;
  exploreApplicationsHref: string;
  exploreApplicantHref: string;
  competitiveLandscapeHref: string;
  contentionHref: string;
  participantRow: ParticipantRow;
  rspRow: ApplicantRspPosture;
};

export type ApplicantIntelligenceLookup =
  | ApplicantIntelligenceProfile
  | { found: false; applicantLegalName: string; profileHref: string };

/** Shareable, deterministic Applicant profile route (legal name is the stable key). */
export function applicantProfileHref(applicantLegalName: string): string {
  return `/applicant?name=${encodeURIComponent(applicantLegalName)}`;
}

export function decodeApplicantProfileName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed).trim() || null;
  } catch {
    return trimmed;
  }
}

function portfolioRowsForApplicant(
  document: RegistryApplicationsDocumentV2,
  applicantLegalName: string,
): ApplicantPortfolioRow[] {
  const rows = document.applications
    .filter((a) => a.applicant === applicantLegalName)
    .map((app: BrowserApplicationV2) => {
      const oc = app.officialContention;
      const setIds = oc?.membershipPresent ? [...oc.officialContentionSetIds].sort() : [];
      return {
        applicationId: app.applicationId,
        appliedForString: app.appliedString?.label ?? "",
        brand: Boolean(app.designations.brand),
        community: Boolean(app.designations.community),
        idn: Boolean(app.designations.idn),
        geographic: Boolean(app.designations.geoSelfDesignated),
        applicationStatus: app.applicationStatus ?? null,
        processingStage: app.processingStage ?? null,
        region: app.region ?? null,
        country: app.country ?? null,
        inInitialContention: Boolean(oc?.membershipPresent),
        officialContentionSetIds: setIds,
        exploreHref: `/explore?q=${encodeURIComponent(app.applicationId)}`,
      };
    });
  rows.sort(
    (a, b) =>
      a.appliedForString.localeCompare(b.appliedForString) ||
      a.applicationId.localeCompare(b.applicationId),
  );
  return rows;
}

function buildContentionSummaries(
  document: RegistryApplicationsDocumentV2,
  applicantLegalName: string,
): ApplicantContentionSetSummary[] {
  const setMembers = new Map<string, BrowserApplicationV2[]>();
  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      const list = setMembers.get(setId) ?? [];
      list.push(app);
      setMembers.set(setId, list);
    }
  }

  const out: ApplicantContentionSetSummary[] = [];
  for (const [setId, apps] of setMembers) {
    const applicantApps = apps.filter((a) => a.applicant === applicantLegalName);
    if (applicantApps.length === 0) continue;
    const applicants = new Set(apps.map((a) => a.applicant));
    const strings = [
      ...new Set(apps.map((a) => a.appliedString?.label ?? "").filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const members = [...apps]
      .sort(
        (a, b) =>
          (a.appliedString?.label ?? "").localeCompare(b.appliedString?.label ?? "") ||
          a.applicant.localeCompare(b.applicant) ||
          a.applicationId.localeCompare(b.applicationId),
      )
      .map((a) => ({
        applicationId: a.applicationId,
        appliedForString: a.appliedString?.label ?? "",
        applicantLegalName: a.applicant,
        isFocalApplicant: a.applicant === applicantLegalName,
        exploreHref: `/explore?q=${encodeURIComponent(a.applicationId)}`,
        profileHref: applicantProfileHref(a.applicant),
      }));
    out.push({
      setId,
      appliedForStrings: strings,
      applicationCount: apps.length,
      distinctApplicantCount: applicants.size,
      applicantApplicationIds: applicantApps.map((a) => a.applicationId).sort(),
      includesGodaddy: apps.some((a) => a.applicant === "Registry Services, LLC"),
      contentionSetHref: contentionSetHref(setId),
      members,
    });
  }
  out.sort(
    (a, b) =>
      b.applicationCount - a.applicationCount ||
      a.setId.localeCompare(b.setId),
  );
  return out;
}

/**
 * Build Applicant Intelligence Profile for an exact legal name.
 * Lookup is exact match against represented Applicant names (not fuzzy).
 */
export function buildApplicantIntelligenceProfile(
  document: RegistryApplicationsDocumentV2,
  overlays: ParticipantOverlays | undefined,
  evaluatedRsp: EvaluatedMainRspArtifact,
  applicantLegalName: string,
  options?: { changesHrefBase?: string },
): ApplicantIntelligenceLookup {
  const name = applicantLegalName.trim();
  const href = applicantProfileHref(name);
  if (!name) return { found: false, applicantLegalName: name, profileHref: href };

  const participantIntel = buildParticipantIntelligence(document, overlays, {
    focalApplicantLegalName: name,
  });
  const row = participantIntel.participants.find((p) => p.applicantLegalName === name);
  if (!row) {
    return { found: false, applicantLegalName: name, profileHref: href };
  }

  const rspIntel = buildRspOpportunityIntelligence(participantIntel, evaluatedRsp);
  const rspRow = rspIntel.postures.find((p) => p.applicantLegalName === name)!;

  const portfolio = portfolioRowsForApplicant(document, name);
  const contentionSets = buildContentionSummaries(document, name);

  let organizationContext: ApplicantIntelligenceProfile["organizationContext"] = null;
  if (row.organizationResolutionStatus === "CONFIRMED" && row.confirmedOrganizationId && row.confirmedOrganizationName) {
    const siblings = participantIntel.participants
      .filter(
        (p) =>
          p.applicantLegalName !== name &&
          p.organizationResolutionStatus === "CONFIRMED" &&
          p.confirmedOrganizationId === row.confirmedOrganizationId,
      )
      .map((p) => ({
        applicantLegalName: p.applicantLegalName,
        applicationCount: p.applicationCount,
        profileHref: applicantProfileHref(p.applicantLegalName),
      }))
      .sort(
        (a, b) =>
          b.applicationCount - a.applicationCount ||
          a.applicantLegalName.localeCompare(b.applicantLegalName),
      );
    const family = participantIntel.participants.filter(
      (p) =>
        p.organizationResolutionStatus === "CONFIRMED" &&
        p.confirmedOrganizationId === row.confirmedOrganizationId,
    );
    organizationContext = {
      organizationName: row.confirmedOrganizationName,
      organizationId: row.confirmedOrganizationId,
      siblingApplicants: siblings,
      siblingApplicantCount: siblings.length,
      organizationApplicationCount: family.reduce((n, p) => n + p.applicationCount, 0),
      organizationContentionMemberships: family.reduce((n, p) => n + p.officialContentionMemberships, 0),
    };
  }

  const changesHref = `${options?.changesHrefBase ?? "/changes"}?q=${encodeURIComponent(name)}`;
  const orgKey =
    row.organizationResolutionStatus === "CONFIRMED"
      ? organizationKeyFromOverlays(overlays, row.confirmedOrganizationId)
      : null;

  return {
    found: true,
    applicantLegalName: name,
    profileHref: href,
    countries: row.countries,
    regions: row.regions,
    organizationResolutionStatus: row.organizationResolutionStatus,
    confirmedOrganizationId: row.confirmedOrganizationId,
    confirmedOrganizationName: row.confirmedOrganizationName,
    organizationProfileHref: orgKey ? organizationProfileHref(orgKey) : null,
    identityEvidence: row.identityEvidence,
    brandApplicationCount: row.designationCounts.brand,
    applicationCount: row.applicationCount,
    contestedApplicationCount: row.contestedApplicationCount,
    uniqueContentionSets: row.officialContentionSetsTouched,
    distinctCounterpartApplicants: participantIntel.contentionCounterparts.length,
    rspPosture: rspRow.rspProspectingPosture,
    rspPostureLabel: prospectingPostureLabel(rspRow.rspProspectingPosture),
    rspProspectingReason: rspRow.rspProspectingReason,
    portfolio,
    contentionSets,
    counterparts: participantIntel.contentionCounterparts.map((c) => ({
      applicantLegalName: c.applicantLegalName,
      sharedContentionSets: c.sharedContentionSets,
      organizationResolutionStatus: c.organizationResolutionStatus,
      confirmedOrganizationName: c.confirmedOrganizationName,
      profileHref: applicantProfileHref(c.applicantLegalName),
    })),
    organizationContext,
    confirmedReturning: row.confirmedReturning,
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine:
        "No material public Application or contention changes recorded since monitoring began.",
      changesHref,
    },
    exploreApplicationsHref: exploreApplicantApplicationsHref(row.applicationIds),
    exploreApplicantHref: exploreApplicantHref(name),
    competitiveLandscapeHref: `/competitive-landscape?q=${encodeURIComponent(name)}`,
    contentionHref: `/contention?view=all&q=${encodeURIComponent(name)}`,
    participantRow: row,
    rspRow,
  };
}

/** Sets grouped by Application count for interactive distribution UX. */
export function buildContentionApplicationCountDistribution(
  sets: ReadonlyArray<{ setId: string; totalApplications: number; distinctApplicants: number; appliedForStrings: string[]; includesGodaddy: boolean }>,
): Array<{
  applicationCount: number;
  setCount: number;
  sets: Array<{
    setId: string;
    appliedForStrings: string[];
    applicationCount: number;
    distinctApplicantCount: number;
    includesGodaddy: boolean;
    contentionSetHref: string;
  }>;
}> {
  type DistSet = (typeof sets)[number];
  const bySize = new Map<number, DistSet[]>();
  for (const set of sets) {
    const list = bySize.get(set.totalApplications) ?? [];
    list.push(set);
    bySize.set(set.totalApplications, list);
  }
  return [...bySize.entries()]
    .sort((a, b) => b[0] - a[0] || a[1].length - b[1].length)
    .map(([applicationCount, group]) => ({
      applicationCount,
      setCount: group.length,
      sets: [...group]
        .sort((a, b) => a.setId.localeCompare(b.setId))
        .map((s) => ({
          setId: s.setId,
          appliedForStrings: [...s.appliedForStrings],
          applicationCount: s.totalApplications,
          distinctApplicantCount: s.distinctApplicants,
          includesGodaddy: s.includesGodaddy,
          contentionSetHref: contentionSetHref(s.setId),
        })),
    }));
}

export const CONTENTION_SET_PLAIN_LANGUAGE =
  "A contention set groups Applications that ICANN has identified as competing with one another. A set with 13 Applications means 13 Applications are in that competition group; those Applications may represent fewer than 13 distinct Applicants. These are official initial memberships and may change as the program progresses — not a prediction of final outcome.";
