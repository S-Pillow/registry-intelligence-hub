/**
 * Organization Intelligence Profiles (ORG-INTEL-1).
 * Confirmed-only steward Organizations. Reuses participant / contention / RSP overlays.
 * Organization ≠ Applicant. Aggregation never replaces legal Applicant attribution.
 */

import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  type ParticipantOverlays,
  type ParticipantReturningOverlay,
  type ParticipantRow,
  type ParticipantIdentityEvidenceOverlay,
} from "@/lib/participant-intelligence";

function applicantHref(applicantLegalName: string): string {
  return `/applicant?name=${encodeURIComponent(applicantLegalName)}`;
}
import {
  buildRspOpportunityIntelligence,
  prospectingPostureLabel,
  type RspProspectingPosture,
} from "@/lib/rsp-opportunity-intelligence";
import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { contentionSetHref } from "@/lib/contention-intelligence";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export type OrganizationApplicantMember = {
  applicantLegalName: string;
  applicationCount: number;
  brandApplicationCount: number;
  contentionMemberships: number;
  contestedApplicationCount: number;
  countries: string[];
  regions: string[];
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  profileHref: string;
  identityEvidence: ParticipantIdentityEvidenceOverlay | null;
};

export type OrganizationPortfolioRow = {
  applicationId: string;
  appliedForString: string;
  applicantLegalName: string;
  brand: boolean;
  applicationStatus: string | null;
  inInitialContention: boolean;
  officialContentionSetIds: string[];
  exploreHref: string;
  applicantProfileHref: string;
};

export type OrganizationContentionSetSummary = {
  setId: string;
  appliedForStrings: string[];
  applicationCount: number;
  distinctApplicantCount: number;
  organizationApplicationIds: string[];
  organizationApplicantNames: string[];
  organizationApplicationCount: number;
  organizationApplicantCount: number;
  includesGodaddy: boolean;
  contentionSetHref: string;
};

export type OrganizationCounterpart = {
  applicantLegalName: string;
  sharedContentionSets: number;
  sharedApplicationMemberships: number;
  organizationResolutionStatus: string;
  confirmedOrganizationName: string | null;
  confirmedOrganizationKey: string | null;
  profileHref: string;
  organizationProfileHref: string | null;
};

export type OrganizationIntelligenceProfile = {
  found: true;
  organizationKey: string;
  organizationId: string;
  canonicalName: string;
  profileHref: string;
  applicantEntityCount: number;
  applicationCount: number;
  brandApplicationCount: number;
  contestedApplicationCount: number;
  contentionMemberships: number;
  uniqueContentionSets: number;
  distinctExternalCounterpartApplicants: number;
  applicants: OrganizationApplicantMember[];
  portfolio: OrganizationPortfolioRow[];
  contentionSets: OrganizationContentionSetSummary[];
  counterparts: OrganizationCounterpart[];
  evidenceSummary: {
    mappingCount: number;
    evidenceTypeLabels: string[];
  };
  confirmedReturning: {
    applications2012: number;
    applications2026: number;
    applicationDelta: number;
    portfolioChange: string;
  } | null;
  rspAmongMappedApplicants: {
    publicMainRspCapableCount: number;
    noPublicMainRspCount: number;
    viaConfirmedOrganizationCount: number;
    identityReviewCount: number;
    postures: Array<{
      applicantLegalName: string;
      posture: RspProspectingPosture;
      label: string;
    }>;
  };
  changeSummary: {
    hasMaterialChanges: boolean;
    summaryLine: string;
    changesHref: string;
  };
  exploreApplicationsHref: string;
  competitiveLandscapeHref: string;
  contentionHref: string;
};

export type OrganizationIntelligenceLookup =
  | OrganizationIntelligenceProfile
  | { found: false; organizationKey: string; profileHref: string; reason: "unknown" | "not-confirmed" };

/** Shareable Confirmed Organization profile route (canonical key is the stable identity). */
export function organizationProfileHref(organizationKey: string): string {
  return `/organization?key=${encodeURIComponent(organizationKey)}`;
}

export function decodeOrganizationProfileKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed).trim() || null;
  } catch {
    return trimmed;
  }
}

export function organizationKeyFromOverlays(
  overlays: ParticipantOverlays | undefined,
  organizationId: string | null | undefined,
): string | null {
  if (!organizationId || !overlays) return null;
  for (const o of overlays.organizations) {
    if (o.confirmedOrganizationId === organizationId && o.confirmedOrganizationKey) {
      return o.confirmedOrganizationKey;
    }
  }
  return null;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function evidenceTypeLabelsFromLines(lines: string[]): string[] {
  const labels = new Set<string>();
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("applicant website") || lower.includes("website:")) {
      labels.add("shared Applicant Website");
    } else if (lower.includes("affiliate")) {
      labels.add("explicit Affiliate disclosures");
    } else if (lower.includes("direct parent") || lower.includes("ultimate parent") || lower.includes("ultimate control")) {
      labels.add("parent/control disclosures");
    } else if (lower.includes("self-identity") || lower.includes("brand")) {
      labels.add("self-identity / Brand evidence");
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

/**
 * Build Organization Intelligence Profile for a canonical Organization key.
 * Only steward-CONFIRMED Organizations are eligible.
 */
export function buildOrganizationIntelligenceProfile(
  document: RegistryApplicationsDocumentV2,
  overlays: ParticipantOverlays | undefined,
  evaluatedRsp: EvaluatedMainRspArtifact,
  orgSnapshot: OrganizationResolutionSnapshot,
  organizationKey: string,
  options?: { changesHrefBase?: string },
): OrganizationIntelligenceLookup {
  const key = organizationKey.trim();
  const href = organizationProfileHref(key);
  if (!key) return { found: false, organizationKey: key, profileHref: href, reason: "unknown" };

  const org = orgSnapshot.organizations.find((o) => o.organizationKey === key);
  if (!org) return { found: false, organizationKey: key, profileHref: href, reason: "unknown" };
  if (org.status !== "CONFIRMED") {
    return { found: false, organizationKey: key, profileHref: href, reason: "not-confirmed" };
  }

  const participantIntel = buildParticipantIntelligence(document, overlays);
  const memberRows = participantIntel.participants.filter(
    (p) =>
      p.organizationResolutionStatus === "CONFIRMED" &&
      p.confirmedOrganizationId === org.organizationId,
  );
  const memberNames = new Set(memberRows.map((p) => p.applicantLegalName));

  const overlayByName = new Map((overlays?.organizations ?? []).map((o) => [o.applicantLegalName, o]));
  const applicants: OrganizationApplicantMember[] = memberRows
    .map((row: ParticipantRow) => {
      const overlay = overlayByName.get(row.applicantLegalName);
      const evidence = row.identityEvidence ?? overlay?.identityEvidence ?? null;
      return {
        applicantLegalName: row.applicantLegalName,
        applicationCount: row.applicationCount,
        brandApplicationCount: row.designationCounts.brand,
        contentionMemberships: row.officialContentionMemberships,
        contestedApplicationCount: row.contestedApplicationCount,
        countries: row.countries,
        regions: row.regions,
        applicantWebsiteHost: evidence?.applicantWebsiteHost ?? null,
        applicantWebsiteUrl: evidence?.applicantWebsiteUrl ?? null,
        profileHref: applicantHref(row.applicantLegalName),
        identityEvidence: evidence,
      };
    })
    .sort(
      (a, b) =>
        b.applicationCount - a.applicationCount ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    );

  const portfolio: OrganizationPortfolioRow[] = document.applications
    .filter((a) => memberNames.has(a.applicant))
    .map((app: BrowserApplicationV2) => {
      const oc = app.officialContention;
      const setIds = oc?.membershipPresent ? [...oc.officialContentionSetIds].sort() : [];
      return {
        applicationId: app.applicationId,
        appliedForString: app.appliedString?.label ?? "",
        applicantLegalName: app.applicant,
        brand: Boolean(app.designations.brand),
        applicationStatus: app.applicationStatus ?? null,
        inInitialContention: Boolean(oc?.membershipPresent),
        officialContentionSetIds: setIds,
        exploreHref: `/explore?q=${encodeURIComponent(app.applicationId)}`,
        applicantProfileHref: applicantHref(app.applicant),
      };
    })
    .sort(
      (a, b) =>
        a.appliedForString.localeCompare(b.appliedForString) ||
        a.applicationId.localeCompare(b.applicationId),
    );

  const brandApplicationCount = portfolio.filter((p) => p.brand).length;
  const contestedApplicationCount = portfolio.filter((p) => p.inInitialContention).length;
  const contentionMemberships = memberRows.reduce((n, p) => n + p.officialContentionMemberships, 0);

  // Contention sets involving any Organization Application
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

  const contentionSets: OrganizationContentionSetSummary[] = [];
  const counterpartAcc = new Map<
    string,
    { sets: Set<string>; memberships: number }
  >();

  for (const [setId, apps] of setMembers) {
    const orgApps = apps.filter((a) => memberNames.has(a.applicant));
    if (orgApps.length === 0) continue;
    const allApplicants = new Set(apps.map((a) => a.applicant));
    const orgApplicantNames = uniqueSorted(orgApps.map((a) => a.applicant));
    const strings = uniqueSorted(apps.map((a) => a.appliedString?.label ?? ""));
    contentionSets.push({
      setId,
      appliedForStrings: strings,
      applicationCount: apps.length,
      distinctApplicantCount: allApplicants.size,
      organizationApplicationIds: orgApps.map((a) => a.applicationId).sort(),
      organizationApplicantNames: orgApplicantNames,
      organizationApplicationCount: orgApps.length,
      organizationApplicantCount: orgApplicantNames.length,
      includesGodaddy: apps.some((a) => a.applicant === "Registry Services, LLC"),
      contentionSetHref: contentionSetHref(setId),
    });

    for (const app of apps) {
      if (memberNames.has(app.applicant)) continue;
      const entry = counterpartAcc.get(app.applicant) ?? { sets: new Set(), memberships: 0 };
      entry.sets.add(setId);
      entry.memberships += 1;
      counterpartAcc.set(app.applicant, entry);
    }
  }

  contentionSets.sort(
    (a, b) =>
      b.organizationApplicationCount - a.organizationApplicationCount ||
      b.applicationCount - a.applicationCount ||
      a.setId.localeCompare(b.setId),
  );

  const keyByOrgId = new Map(
    (overlays?.organizations ?? [])
      .filter((o) => o.confirmedOrganizationId && o.confirmedOrganizationKey)
      .map((o) => [o.confirmedOrganizationId!, o.confirmedOrganizationKey!] as const),
  );

  const counterparts: OrganizationCounterpart[] = [...counterpartAcc.entries()]
    .map(([name, acc]) => {
      const row = participantIntel.participants.find((p) => p.applicantLegalName === name);
      const status = row?.organizationResolutionStatus ?? "UNRESOLVED";
      const orgName = status === "CONFIRMED" ? row?.confirmedOrganizationName ?? null : null;
      const orgKey =
        status === "CONFIRMED" && row?.confirmedOrganizationId
          ? keyByOrgId.get(row.confirmedOrganizationId) ?? null
          : null;
      return {
        applicantLegalName: name,
        sharedContentionSets: acc.sets.size,
        sharedApplicationMemberships: acc.memberships,
        organizationResolutionStatus: status,
        confirmedOrganizationName: orgName,
        confirmedOrganizationKey: orgKey,
        profileHref: applicantHref(name),
        organizationProfileHref: orgKey ? organizationProfileHref(orgKey) : null,
      };
    })
    .sort(
      (a, b) =>
        b.sharedContentionSets - a.sharedContentionSets ||
        b.sharedApplicationMemberships - a.sharedApplicationMemberships ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    );

  const evidenceLines = applicants.flatMap((a) => a.identityEvidence?.evidenceExplanationLines ?? []);
  const evidenceSummary = {
    mappingCount: applicants.length,
    evidenceTypeLabels: evidenceTypeLabelsFromLines(evidenceLines),
  };

  let confirmedReturning: OrganizationIntelligenceProfile["confirmedReturning"] = null;
  const returningSample = (overlays?.returning ?? []).find(
    (r: ParticipantReturningOverlay) => r.organization2026Id === org.organizationId,
  );
  if (returningSample) {
    confirmedReturning = {
      applications2012: returningSample.applications2012,
      applications2026: returningSample.applications2026,
      applicationDelta: returningSample.applicationDelta,
      portfolioChange: returningSample.portfolioChange,
    };
  }

  const rspIntel = buildRspOpportunityIntelligence(participantIntel, evaluatedRsp);
  const memberPostures = rspIntel.postures.filter((p) => memberNames.has(p.applicantLegalName));
  const rspAmongMappedApplicants = {
    publicMainRspCapableCount: memberPostures.filter(
      (p) => p.rspProspectingPosture === "PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
    ).length,
    noPublicMainRspCount: memberPostures.filter(
      (p) => p.rspProspectingPosture === "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
    ).length,
    viaConfirmedOrganizationCount: memberPostures.filter(
      (p) => p.rspProspectingPosture === "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION",
    ).length,
    identityReviewCount: memberPostures.filter(
      (p) => p.rspProspectingPosture === "IDENTITY_REVIEW_NEEDED",
    ).length,
    postures: memberPostures.map((p) => ({
      applicantLegalName: p.applicantLegalName,
      posture: p.rspProspectingPosture,
      label: prospectingPostureLabel(p.rspProspectingPosture),
    })),
  };

  const allApplicationIds = portfolio.map((p) => p.applicationId);
  const changesHref = `${options?.changesHrefBase ?? "/changes"}?q=${encodeURIComponent(org.canonicalName)}`;

  return {
    found: true,
    organizationKey: org.organizationKey,
    organizationId: org.organizationId,
    canonicalName: org.canonicalName,
    profileHref: href,
    applicantEntityCount: applicants.length,
    applicationCount: portfolio.length,
    brandApplicationCount,
    contestedApplicationCount,
    contentionMemberships,
    uniqueContentionSets: contentionSets.length,
    distinctExternalCounterpartApplicants: counterparts.length,
    applicants,
    portfolio,
    contentionSets,
    counterparts,
    evidenceSummary,
    confirmedReturning,
    rspAmongMappedApplicants,
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine:
        "No material public Application or contention changes recorded for this Organization since monitoring began.",
      changesHref,
    },
    exploreApplicationsHref: exploreApplicantApplicationsHref(allApplicationIds),
    competitiveLandscapeHref: `/competitive-landscape?q=${encodeURIComponent(org.canonicalName)}`,
    contentionHref: `/contention?view=all&q=${encodeURIComponent(org.canonicalName)}`,
  };
}
