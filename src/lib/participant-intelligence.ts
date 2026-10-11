/**
 * Full-coverage Applicant competitive intelligence (PARTICIPANT-INTEL-1).
 * Primary grain: observed Applicant legal name. Organization is optional enrichment.
 */

import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

export const GODADDY_FOCAL_APPLICANT_LEGAL_NAME = "Registry Services, LLC";

export type OrganizationResolutionOverlayStatus = "CONFIRMED" | "CANDIDATE" | "AMBIGUOUS" | "UNRESOLVED";

export type ParticipantIdentityEvidenceOverlay = {
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  evidenceExplanationLines: string[];
};

export type ParticipantOrganizationOverlay = {
  applicantLegalName: string;
  resolutionStatus: OrganizationResolutionOverlayStatus;
  /** Set only when CONFIRMED. */
  confirmedOrganizationId: string | null;
  confirmedOrganizationName: string | null;
  /** ORG-RES-WEB-1 first-party ICANN identity context (optional). */
  identityEvidence?: ParticipantIdentityEvidenceOverlay | null;
};

export type ParticipantReturningOverlay = {
  applicantLegalName: string;
  organization2026Id: string;
  applications2012: number;
  applications2026: number;
  applicationDelta: number;
  portfolioChange: "EXPANDED" | "CONTRACTED" | "UNCHANGED";
};

export type ParticipantOverlays = {
  organizations: ParticipantOrganizationOverlay[];
  returning: ParticipantReturningOverlay[];
};

export type DesignationCounts = {
  idn: number;
  brand: number;
  community: number;
  geographic: number;
};

export type ParticipantRow = {
  applicantLegalName: string;
  applicationCount: number;
  shareOfObservedApplications: number;
  contestedApplicationCount: number;
  officialContentionMemberships: number;
  officialContentionSetsTouched: number;
  contentionRate: number;
  regions: string[];
  countries: string[];
  designationCounts: DesignationCounts;
  applicationIds: string[];
  organizationResolutionStatus: OrganizationResolutionOverlayStatus;
  confirmedOrganizationId: string | null;
  confirmedOrganizationName: string | null;
  identityEvidence: ParticipantIdentityEvidenceOverlay | null;
  confirmedReturning: ParticipantReturningOverlay | null;
  rankByApplications: number;
  rankByContentionExposure: number;
};

export type ContentionCounterpart = {
  applicantLegalName: string;
  sharedContentionSets: number;
  sharedSetApplications: number;
  confirmedOrganizationName: string | null;
  organizationResolutionStatus: OrganizationResolutionOverlayStatus;
  applicantWebsiteHost: string | null;
};

export type ParticipantIntelligenceCoverage = {
  officialApplications: number;
  officialApplicants: number;
  observedApplications: number;
  observedApplicantLegalNames: number;
  officialContentionSets: number;
  officialContentionMemberships: number;
  knownExcludedRecordIds: string[];
  confirmedOrganizationMappings: number;
};

export type FocalApplicantPosition = {
  applicantLegalName: string;
  row: ParticipantRow;
  rankByApplications: number;
  rankByContentionExposure: number;
};

export type ParticipantIntelligence = {
  coverage: ParticipantIntelligenceCoverage;
  participants: ParticipantRow[];
  focalApplicantLegalName: string;
  focal: FocalApplicantPosition | null;
  contentionCounterparts: ContentionCounterpart[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function overlayMaps(overlays?: ParticipantOverlays) {
  const orgByName = new Map<string, ParticipantOrganizationOverlay>();
  for (const o of overlays?.organizations ?? []) {
    orgByName.set(o.applicantLegalName, o);
  }
  const returningByName = new Map<string, ParticipantReturningOverlay>();
  for (const r of overlays?.returning ?? []) {
    returningByName.set(r.applicantLegalName, r);
  }
  return { orgByName, returningByName };
}

type Acc = {
  applicationIds: string[];
  contestedApplicationIds: Set<string>;
  membershipCount: number;
  setIds: Set<string>;
  regions: Set<string>;
  countries: Set<string>;
  designations: DesignationCounts;
};

function emptyAcc(): Acc {
  return {
    applicationIds: [],
    contestedApplicationIds: new Set(),
    membershipCount: 0,
    setIds: new Set(),
    regions: new Set(),
    countries: new Set(),
    designations: { idn: 0, brand: 0, community: 0, geographic: 0 },
  };
}

function accumulate(acc: Acc, app: BrowserApplicationV2): void {
  acc.applicationIds.push(app.applicationId);
  if (app.region) acc.regions.add(app.region);
  if (app.country) acc.countries.add(app.country);
  if (app.designations.idn) acc.designations.idn += 1;
  if (app.designations.brand) acc.designations.brand += 1;
  if (app.designations.community) acc.designations.community += 1;
  if (app.designations.geoSelfDesignated) acc.designations.geographic += 1;

  const oc = app.officialContention;
  if (oc?.membershipPresent) {
    acc.contestedApplicationIds.add(app.applicationId);
    acc.membershipCount += oc.officialContentionSetIds.length;
    for (const id of oc.officialContentionSetIds) acc.setIds.add(id);
  }
}

/**
 * Build full-coverage Applicant competitive intelligence from the active browser document.
 * Does not invent Organizations or new participants.
 */
export function buildParticipantIntelligence(
  document: RegistryApplicationsDocumentV2,
  overlays?: ParticipantOverlays,
  options?: { focalApplicantLegalName?: string },
): ParticipantIntelligence {
  const focalName = options?.focalApplicantLegalName ?? GODADDY_FOCAL_APPLICANT_LEGAL_NAME;
  const { orgByName, returningByName } = overlayMaps(overlays);
  const observedApplications = document.applications.length;
  const byApplicant = new Map<string, Acc>();

  // Contention set → applicant legal names (for counterparts)
  const setToApplicants = new Map<string, Set<string>>();
  const applicantToSets = new Map<string, Set<string>>();

  for (const app of document.applications) {
    const name = app.applicant;
    let acc = byApplicant.get(name);
    if (!acc) {
      acc = emptyAcc();
      byApplicant.set(name, acc);
    }
    accumulate(acc, app);

    const oc = app.officialContention;
    if (oc?.membershipPresent) {
      let sets = applicantToSets.get(name);
      if (!sets) {
        sets = new Set();
        applicantToSets.set(name, sets);
      }
      for (const setId of oc.officialContentionSetIds) {
        sets.add(setId);
        let members = setToApplicants.get(setId);
        if (!members) {
          members = new Set();
          setToApplicants.set(setId, members);
        }
        members.add(name);
      }
    }
  }

  const participantsUnranked: Omit<ParticipantRow, "rankByApplications" | "rankByContentionExposure">[] = [];

  for (const [applicantLegalName, acc] of byApplicant) {
    const applicationCount = acc.applicationIds.length;
    const contestedApplicationCount = acc.contestedApplicationIds.size;
    const org = orgByName.get(applicantLegalName);
    const returning = returningByName.get(applicantLegalName) ?? null;
    const resolutionStatus = org?.resolutionStatus ?? "UNRESOLVED";
    const confirmed =
      resolutionStatus === "CONFIRMED"
        ? {
            confirmedOrganizationId: org?.confirmedOrganizationId ?? null,
            confirmedOrganizationName: org?.confirmedOrganizationName ?? null,
          }
        : { confirmedOrganizationId: null, confirmedOrganizationName: null };

    participantsUnranked.push({
      applicantLegalName,
      applicationCount,
      shareOfObservedApplications: observedApplications === 0 ? 0 : applicationCount / observedApplications,
      contestedApplicationCount,
      officialContentionMemberships: acc.membershipCount,
      officialContentionSetsTouched: acc.setIds.size,
      contentionRate: applicationCount === 0 ? 0 : contestedApplicationCount / applicationCount,
      regions: uniqueSorted(acc.regions),
      countries: uniqueSorted(acc.countries),
      designationCounts: acc.designations,
      applicationIds: [...acc.applicationIds].sort(),
      organizationResolutionStatus: resolutionStatus,
      confirmedOrganizationId: confirmed.confirmedOrganizationId,
      confirmedOrganizationName: confirmed.confirmedOrganizationName,
      identityEvidence: org?.identityEvidence ?? null,
      confirmedReturning: returning,
    });
  }

  // Ranks: dense ranking by metric desc, then name asc for ties in ordering
  const byApps = [...participantsUnranked].sort(
    (a, b) =>
      b.applicationCount - a.applicationCount || a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const byContention = [...participantsUnranked].sort(
    (a, b) =>
      b.contestedApplicationCount - a.contestedApplicationCount ||
      b.officialContentionMemberships - a.officialContentionMemberships ||
      a.applicantLegalName.localeCompare(b.applicantLegalName),
  );

  const appRank = new Map<string, number>();
  const contentionRank = new Map<string, number>();
  let lastApps = -1;
  let rankApps = 0;
  for (let i = 0; i < byApps.length; i++) {
    const row = byApps[i];
    if (row.applicationCount !== lastApps) {
      rankApps = i + 1;
      lastApps = row.applicationCount;
    }
    appRank.set(row.applicantLegalName, rankApps);
  }
  let lastCont = -1;
  let rankCont = 0;
  for (let i = 0; i < byContention.length; i++) {
    const row = byContention[i];
    if (row.contestedApplicationCount !== lastCont) {
      rankCont = i + 1;
      lastCont = row.contestedApplicationCount;
    }
    contentionRank.set(row.applicantLegalName, rankCont);
  }

  const participants: ParticipantRow[] = byApps.map((row) => ({
    ...row,
    rankByApplications: appRank.get(row.applicantLegalName)!,
    rankByContentionExposure: contentionRank.get(row.applicantLegalName)!,
  }));

  const focalRow = participants.find((p) => p.applicantLegalName === focalName) ?? null;
  const focal: FocalApplicantPosition | null = focalRow
    ? {
        applicantLegalName: focalName,
        row: focalRow,
        rankByApplications: focalRow.rankByApplications,
        rankByContentionExposure: focalRow.rankByContentionExposure,
      }
    : null;

  // Counterparts: other applicants in official sets that include the focal applicant
  const counterparts = new Map<string, { sets: Set<string>; apps: number }>();
  if (focalRow) {
    const focalSets = applicantToSets.get(focalName) ?? new Set();
    for (const setId of focalSets) {
      const members = setToApplicants.get(setId) ?? new Set();
      for (const other of members) {
        if (other === focalName) continue;
        let entry = counterparts.get(other);
        if (!entry) {
          entry = { sets: new Set(), apps: 0 };
          counterparts.set(other, entry);
        }
        entry.sets.add(setId);
      }
    }
    // Count counterpart Applications that appear in shared sets
    for (const app of document.applications) {
      if (app.applicant === focalName) continue;
      const entry = counterparts.get(app.applicant);
      if (!entry) continue;
      const oc = app.officialContention;
      if (!oc?.membershipPresent) continue;
      if (oc.officialContentionSetIds.some((id) => entry.sets.has(id))) {
        entry.apps += 1;
      }
    }
  }

  const contentionCounterparts: ContentionCounterpart[] = [...counterparts.entries()]
    .map(([applicantLegalName, entry]) => {
      const org = orgByName.get(applicantLegalName);
      const status = org?.resolutionStatus ?? "UNRESOLVED";
      return {
        applicantLegalName,
        sharedContentionSets: entry.sets.size,
        sharedSetApplications: entry.apps,
        confirmedOrganizationName: status === "CONFIRMED" ? (org?.confirmedOrganizationName ?? null) : null,
        organizationResolutionStatus: status,
        applicantWebsiteHost: org?.identityEvidence?.applicantWebsiteHost ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.sharedContentionSets - a.sharedContentionSets ||
        b.sharedSetApplications - a.sharedSetApplications ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    );

  const confirmedOrganizationMappings = [...orgByName.values()].filter((o) => o.resolutionStatus === "CONFIRMED").length;

  return {
    coverage: {
      officialApplications: document.officialApplications,
      officialApplicants: document.officialApplicants,
      observedApplications,
      observedApplicantLegalNames: participants.length,
      officialContentionSets: document.contentionOverlay.officialContentionSetCount ?? 0,
      officialContentionMemberships: document.contentionOverlay.joinedMemberCount ?? 0,
      knownExcludedRecordIds: document.knownExcludedRecords.map((r) => r.applicationId),
      confirmedOrganizationMappings,
    },
    participants,
    focalApplicantLegalName: focalName,
    focal,
    contentionCounterparts,
  };
}

export type ParticipantSortKey =
  | "applications"
  | "contested"
  | "contention-rate"
  | "contention-sets"
  | "name";

export type ParticipantFilter = {
  q?: string;
  hasOfficialContention?: boolean;
  region?: string;
  confirmedOrganizationOnly?: boolean;
};

export function filterAndSortParticipants(
  participants: ParticipantRow[],
  filter: ParticipantFilter = {},
  sort: ParticipantSortKey = "applications",
): ParticipantRow[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  let rows = participants.filter((p) => {
    if (q && !p.applicantLegalName.toLowerCase().includes(q)) return false;
    if (filter.hasOfficialContention && p.contestedApplicationCount === 0) return false;
    if (filter.region && !p.regions.includes(filter.region)) return false;
    if (filter.confirmedOrganizationOnly && p.organizationResolutionStatus !== "CONFIRMED") return false;
    return true;
  });

  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "contested":
        return (
          b.contestedApplicationCount - a.contestedApplicationCount ||
          a.applicantLegalName.localeCompare(b.applicantLegalName)
        );
      case "contention-rate":
        return b.contentionRate - a.contentionRate || a.applicantLegalName.localeCompare(b.applicantLegalName);
      case "contention-sets":
        return (
          b.officialContentionSetsTouched - a.officialContentionSetsTouched ||
          a.applicantLegalName.localeCompare(b.applicantLegalName)
        );
      case "name":
        return a.applicantLegalName.localeCompare(b.applicantLegalName);
      case "applications":
      default:
        return (
          b.applicationCount - a.applicationCount || a.applicantLegalName.localeCompare(b.applicantLegalName)
        );
    }
  });

  return rows;
}

export function exploreApplicantHref(applicantLegalName: string): string {
  return `/explore?q=${encodeURIComponent(applicantLegalName)}`;
}

export function exploreApplicantApplicationsHref(applicationIds: string[]): string {
  if (applicationIds.length === 0) return "/explore";
  return `/explore?ids=${encodeURIComponent(applicationIds.join(","))}`;
}
