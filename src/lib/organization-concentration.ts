/**
 * Confirmed Organization competitive concentration (ORG-CONCENTRATION-1).
 * Confirmed-subset intelligence only — not a round-wide Organization census.
 */

import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export type OrganizationConcentrationCoverage = {
  officialApplications: number;
  officialApplicants: number;
  representedApplications: number;
  representedApplicantLegalNames: number;
  officialContentionSets: number;
  officialContentionMemberships: number;
  confirmedOrganizations: number;
  confirmedApplicantMappings: number;
  confirmedApplications: number;
  unresolvedApplications: number;
  confirmedBrandApplications: number;
  unresolvedBrandApplications: number;
  confirmedContentionMemberships: number;
  unresolvedContentionMemberships: number;
  setsWithConfirmedOrganizationMembership: number;
  organizationSnapshotHash: string;
};

export type OrganizationConcentrationRow = {
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  confirmedApplicantCount: number;
  applicationCount: number;
  /** Primary share: applications / confirmedApplications. */
  applicationShareOfConfirmedSubset: number;
  /** Optional footprint: applications / representedApplications. */
  applicationShareOfRepresentedRound: number;
  brandApplicationCount: number;
  contentionMembershipCount: number;
  contentionMembershipShareOfConfirmedSubset: number;
  contentionMembershipShareOfOfficialTotal: number;
  distinctContentionSetsTouched: number;
  /** sets touched / officialContentionSets — does not sum to 1 across orgs. */
  officialSetTouchShare: number;
  rankByApplications: number;
  rankByContentionMemberships: number;
  isGodaddyOrganization: boolean;
};

export type CrowdedSetConfirmedStructure =
  | "SINGLE_CONFIRMED_ORG"
  | "MULTI_CONFIRMED_ORG"
  | "NO_CONFIRMED_ORG"
  | "PARTIAL_RESOLUTION";

export type CrowdedOfficialSetRow = {
  contentionSetId: string;
  officialMembershipCount: number;
  confirmedMembershipCount: number;
  unresolvedMembershipCount: number;
  distinctConfirmedOrganizations: number;
  distinctConfirmedApplicants: number;
  godaddyPresent: boolean;
  godaddyMembershipCount: number;
  confirmedOrganizationCoveragePercent: number;
  /**
   * FULLY resolved sets may use SINGLE/MULTI/NO_CONFIRMED_ORG.
   * PARTIAL_RESOLUTION means unresolved memberships remain — never claim
   * the set is definitively single-Organization overall.
   */
  confirmedStructure: CrowdedSetConfirmedStructure;
  confirmedOrganizationsRepresented: number;
  displayStructureLabel: string;
};

export type GodaddyCounterpartOrganization = {
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  sharedSetCountWithGoDaddy: number;
  counterpartMembershipsWithinSharedSets: number;
  distinctCounterpartApplicantNamesWithinSharedSets: number;
  largestSharedSetMembershipCount: number;
};

export type GodaddyRelativeConcentration = {
  godaddyApplicantLegalName: string;
  godaddyOrganizationId: string;
  godaddyOrganizationKey: string;
  godaddyOrganizationName: string;
  applicationCount: number;
  applicationRankAmongConfirmed: number;
  applicationShareOfConfirmedSubset: number;
  contentionMembershipCount: number;
  contentionMembershipRankAmongConfirmed: number;
  contentionMembershipShareOfConfirmedSubset: number;
  distinctOfficialContentionSetsTouched: number;
  sharedOfficialSetsWithCounterparts: number;
  distinctConfirmedCounterpartOrganizations: number;
  totalConfirmedCounterpartMembershipsInSharedSets: number;
  counterparts: GodaddyCounterpartOrganization[];
};

export type OrganizationConcentrationTopShares = {
  top5ApplicationShareOfConfirmedSubset: number;
  top10ApplicationShareOfConfirmedSubset: number;
  top5ContentionMembershipShareOfConfirmedSubset: number;
};

export type OrganizationConcentrationModel = {
  coverage: OrganizationConcentrationCoverage;
  organizations: OrganizationConcentrationRow[];
  applicationConcentration: OrganizationConcentrationRow[];
  contentionConcentration: OrganizationConcentrationRow[];
  crowdedSets: CrowdedOfficialSetRow[];
  godaddyRelative: GodaddyRelativeConcentration | null;
  topShares: OrganizationConcentrationTopShares;
  disclosure: {
    applicationCoverageSentence: string;
    contentionCoverageSentence: string;
    subsetDisclaimer: string;
  };
};

export class OrganizationConcentrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationConcentrationError";
  }
}

function share(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  return numer / denom;
}

function compareAppRank(a: OrganizationConcentrationRow, b: OrganizationConcentrationRow): number {
  return (
    b.applicationCount - a.applicationCount ||
    a.organizationName.localeCompare(b.organizationName) ||
    a.organizationKey.localeCompare(b.organizationKey)
  );
}

function compareContRank(a: OrganizationConcentrationRow, b: OrganizationConcentrationRow): number {
  return (
    b.contentionMembershipCount - a.contentionMembershipCount ||
    b.distinctContentionSetsTouched - a.distinctContentionSetsTouched ||
    a.organizationName.localeCompare(b.organizationName) ||
    a.organizationKey.localeCompare(b.organizationKey)
  );
}

function structureLabel(
  structure: CrowdedSetConfirmedStructure,
  confirmedOrgs: number,
): string {
  switch (structure) {
    case "SINGLE_CONFIRMED_ORG":
      return "1 confirmed Organization (fully resolved set)";
    case "MULTI_CONFIRMED_ORG":
      return `${confirmedOrgs} confirmed Organizations (fully resolved set)`;
    case "NO_CONFIRMED_ORG":
      return "No confirmed Organization represented";
    case "PARTIAL_RESOLUTION":
      return confirmedOrgs === 1
        ? "1 confirmed Organization represented (set not fully resolved)"
        : confirmedOrgs === 0
          ? "No confirmed Organization represented (set not fully resolved)"
          : `${confirmedOrgs} confirmed Organizations represented (set not fully resolved)`;
  }
}

/**
 * Build Confirmed Organization concentration intelligence.
 * Fail-closed on pin / mapping inconsistencies when an Organization snapshot is supplied.
 */
export function buildOrganizationConcentration(
  document: RegistryApplicationsDocumentV2,
  orgSnapshot: OrganizationResolutionSnapshot,
  options?: { crowdedSetLimit?: number },
): OrganizationConcentrationModel {
  const crowdedSetLimit = options?.crowdedSetLimit ?? 10;

  const pinHash = orgSnapshot.applicationPublicationPin.applicationGraphContentSha256;
  const docPin = document.bundleManifest?.applicationGraphContentSha256;
  if (docPin && pinHash && docPin !== pinHash) {
    throw new OrganizationConcentrationError(
      `Organization snapshot Application publication pin mismatch: snapshot=${pinHash} document=${docPin}`,
    );
  }

  const orgById = new Map(orgSnapshot.organizations.map((o) => [o.organizationId, o] as const));
  const confirmedOrgs = orgSnapshot.organizations.filter((o) => o.status === "CONFIRMED");
  const confirmedOrgIds = new Set(confirmedOrgs.map((o) => o.organizationId));

  // Confirmed Applicant legal name → organizationId
  const applicantToOrgId = new Map<string, string>();
  let confirmedApplicantMappings = 0;
  const unresolvedApplicantNames = new Set<string>();
  for (const m of orgSnapshot.applicantIdentityMappings) {
    if (m.resolutionState === "UNRESOLVED") {
      unresolvedApplicantNames.add(m.applicantLegalName);
      continue;
    }
    if (m.resolutionState !== "CONFIRMED") continue;
    confirmedApplicantMappings += 1;
    if (!m.organizationId || !confirmedOrgIds.has(m.organizationId)) {
      throw new OrganizationConcentrationError(
        `CONFIRMED mapping for "${m.applicantLegalName}" points to missing/non-confirmed Organization`,
      );
    }
    if (!orgById.has(m.organizationId)) {
      throw new OrganizationConcentrationError(
        `CONFIRMED mapping for "${m.applicantLegalName}" missing Organization entity ${m.organizationId}`,
      );
    }
    applicantToOrgId.set(m.applicantLegalName, m.organizationId);
  }

  type OrgAcc = {
    organizationId: string;
    organizationKey: string;
    organizationName: string;
    applicantNames: Set<string>;
    applicationIds: Set<string>;
    brandApplicationCount: number;
    membershipKeys: Set<string>;
    setIds: Set<string>;
  };

  const accByOrg = new Map<string, OrgAcc>();
  for (const o of confirmedOrgs) {
    accByOrg.set(o.organizationId, {
      organizationId: o.organizationId,
      organizationKey: o.organizationKey,
      organizationName: o.canonicalName,
      applicantNames: new Set(),
      applicationIds: new Set(),
      brandApplicationCount: 0,
      membershipKeys: new Set(),
      setIds: new Set(),
    });
  }

  // Map applicants onto confirmed orgs from mappings (even if zero apps)
  for (const [name, oid] of applicantToOrgId) {
    accByOrg.get(oid)?.applicantNames.add(name);
  }

  const apps = document.applications;
  let confirmedApplications = 0;
  let unresolvedApplications = 0;
  let confirmedBrandApplications = 0;
  let unresolvedBrandApplications = 0;
  const appById = new Map(apps.map((a) => [a.applicationId, a] as const));

  for (const app of apps) {
    const oid = applicantToOrgId.get(app.applicant);
    const isBrand = Boolean(app.designations?.brand);
    if (oid) {
      confirmedApplications += 1;
      if (isBrand) confirmedBrandApplications += 1;
      const acc = accByOrg.get(oid)!;
      acc.applicationIds.add(app.applicationId);
      if (isBrand) acc.brandApplicationCount += 1;
    } else if (unresolvedApplicantNames.has(app.applicant)) {
      unresolvedApplications += 1;
      if (isBrand) unresolvedBrandApplications += 1;
    }
  }

  // Build set memberships from officialContention on apps (authoritative joined overlay)
  type SetAcc = {
    setId: string;
    applicationIds: string[];
  };
  const setAcc = new Map<string, SetAcc>();
  let officialMemberships = 0;
  for (const app of apps) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      officialMemberships += 1;
      const row = setAcc.get(setId) ?? { setId, applicationIds: [] };
      row.applicationIds.push(app.applicationId);
      setAcc.set(setId, row);

      const oid = applicantToOrgId.get(app.applicant);
      if (oid) {
        const acc = accByOrg.get(oid)!;
        acc.membershipKeys.add(`${setId}::${app.applicationId}`);
        acc.setIds.add(setId);
      }
    }
  }

  const officialContentionSets =
    document.contentionOverlay?.officialContentionSetCount ?? setAcc.size;
  if (document.contentionOverlay?.joinedMemberCount != null) {
    if (document.contentionOverlay.joinedMemberCount !== officialMemberships) {
      throw new OrganizationConcentrationError(
        `Contention membership reconcile failed: overlay joined=${document.contentionOverlay.joinedMemberCount} derived=${officialMemberships}`,
      );
    }
  }

  let confirmedContentionMemberships = 0;
  let unresolvedContentionMemberships = 0;
  let setsWithConfirmed = 0;
  for (const s of setAcc.values()) {
    let hasConfirmed = false;
    for (const aid of s.applicationIds) {
      const app = appById.get(aid);
      if (!app) {
        throw new OrganizationConcentrationError(
          `Contention membership applicationId ${aid} missing from Application universe`,
        );
      }
      if (applicantToOrgId.has(app.applicant)) {
        confirmedContentionMemberships += 1;
        hasConfirmed = true;
      } else if (unresolvedApplicantNames.has(app.applicant)) {
        unresolvedContentionMemberships += 1;
      }
    }
    if (hasConfirmed) setsWithConfirmed += 1;
  }

  const godaddyOrgId = applicantToOrgId.get(GODADDY_FOCAL_APPLICANT_LEGAL_NAME) ?? null;

  const rowsUnranked: OrganizationConcentrationRow[] = [...accByOrg.values()].map((acc) => {
    const applicationCount = acc.applicationIds.size;
    const contentionMembershipCount = acc.membershipKeys.size;
    const distinctContentionSetsTouched = acc.setIds.size;
    return {
      organizationId: acc.organizationId,
      organizationKey: acc.organizationKey,
      organizationName: acc.organizationName,
      confirmedApplicantCount: acc.applicantNames.size,
      applicationCount,
      applicationShareOfConfirmedSubset: share(applicationCount, confirmedApplications),
      applicationShareOfRepresentedRound: share(applicationCount, apps.length),
      brandApplicationCount: acc.brandApplicationCount,
      contentionMembershipCount,
      contentionMembershipShareOfConfirmedSubset: share(
        contentionMembershipCount,
        confirmedContentionMemberships,
      ),
      contentionMembershipShareOfOfficialTotal: share(
        contentionMembershipCount,
        officialMemberships,
      ),
      distinctContentionSetsTouched,
      officialSetTouchShare: share(distinctContentionSetsTouched, officialContentionSets),
      rankByApplications: 0,
      rankByContentionMemberships: 0,
      isGodaddyOrganization: godaddyOrgId === acc.organizationId,
    };
  });

  const applicationConcentration = [...rowsUnranked].sort(compareAppRank).map((row, i) => ({
    ...row,
    rankByApplications: i + 1,
  }));
  const contSorted = [...rowsUnranked].sort(compareContRank);
  const contRankById = new Map(contSorted.map((r, i) => [r.organizationId, i + 1] as const));
  const applicationRankById = new Map(
    applicationConcentration.map((r) => [r.organizationId, r.rankByApplications] as const),
  );

  const organizations = applicationConcentration.map((row) => ({
    ...row,
    rankByApplications: applicationRankById.get(row.organizationId)!,
    rankByContentionMemberships: contRankById.get(row.organizationId)!,
  }));

  const contentionConcentration = [...organizations].sort(compareContRank);

  // Crowded sets
  const crowdedSets: CrowdedOfficialSetRow[] = [...setAcc.values()]
    .map((s) => {
      const confirmedApplicantNames = new Set<string>();
      const confirmedOrgIdsInSet = new Set<string>();
      let confirmedMembershipCount = 0;
      let unresolvedMembershipCount = 0;
      let godaddyMembershipCount = 0;
      for (const aid of s.applicationIds) {
        const app = appById.get(aid)!;
        if (app.applicant === GODADDY_FOCAL_APPLICANT_LEGAL_NAME) {
          godaddyMembershipCount += 1;
        }
        const oid = applicantToOrgId.get(app.applicant);
        if (oid) {
          confirmedMembershipCount += 1;
          confirmedApplicantNames.add(app.applicant);
          confirmedOrgIdsInSet.add(oid);
        } else if (unresolvedApplicantNames.has(app.applicant)) {
          unresolvedMembershipCount += 1;
        }
      }
      const officialMembershipCount = s.applicationIds.length;
      const fullyResolved = confirmedMembershipCount === officialMembershipCount;
      const distinctConfirmedOrganizations = confirmedOrgIdsInSet.size;
      let confirmedStructure: CrowdedSetConfirmedStructure;
      if (!fullyResolved) {
        confirmedStructure = "PARTIAL_RESOLUTION";
      } else if (distinctConfirmedOrganizations === 0) {
        confirmedStructure = "NO_CONFIRMED_ORG";
      } else if (distinctConfirmedOrganizations === 1) {
        confirmedStructure = "SINGLE_CONFIRMED_ORG";
      } else {
        confirmedStructure = "MULTI_CONFIRMED_ORG";
      }
      return {
        contentionSetId: s.setId,
        officialMembershipCount,
        confirmedMembershipCount,
        unresolvedMembershipCount,
        distinctConfirmedOrganizations,
        distinctConfirmedApplicants: confirmedApplicantNames.size,
        godaddyPresent: godaddyMembershipCount > 0,
        godaddyMembershipCount,
        confirmedOrganizationCoveragePercent: share(
          confirmedMembershipCount,
          officialMembershipCount,
        ),
        confirmedStructure,
        confirmedOrganizationsRepresented: distinctConfirmedOrganizations,
        displayStructureLabel: structureLabel(
          confirmedStructure,
          distinctConfirmedOrganizations,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.officialMembershipCount - a.officialMembershipCount ||
        a.contentionSetId.localeCompare(b.contentionSetId, undefined, { numeric: true }),
    )
    .slice(0, crowdedSetLimit);

  // GoDaddy-relative counterparts
  let godaddyRelative: GodaddyRelativeConcentration | null = null;
  if (godaddyOrgId) {
    const gdRow = organizations.find((o) => o.organizationId === godaddyOrgId)!;
    const godaddySets = [...setAcc.values()].filter((s) =>
      s.applicationIds.some((aid) => appById.get(aid)?.applicant === GODADDY_FOCAL_APPLICANT_LEGAL_NAME),
    );

    type CpAcc = {
      organizationId: string;
      sharedSets: Set<string>;
      memberships: number;
      applicants: Set<string>;
      largestShared: number;
    };
    const cp = new Map<string, CpAcc>();

    for (const s of godaddySets) {
      const orgsInSet = new Map<string, { memberships: number; applicants: Set<string> }>();
      for (const aid of s.applicationIds) {
        const app = appById.get(aid)!;
        const oid = applicantToOrgId.get(app.applicant);
        if (!oid || oid === godaddyOrgId) continue; // exclude self Organization
        const bucket = orgsInSet.get(oid) ?? { memberships: 0, applicants: new Set() };
        bucket.memberships += 1;
        bucket.applicants.add(app.applicant);
        orgsInSet.set(oid, bucket);
      }
      for (const [oid, bucket] of orgsInSet) {
        const org = orgById.get(oid)!;
        const row = cp.get(oid) ?? {
          organizationId: oid,
          sharedSets: new Set<string>(),
          memberships: 0,
          applicants: new Set<string>(),
          largestShared: 0,
        };
        row.sharedSets.add(s.setId);
        row.memberships += bucket.memberships;
        for (const n of bucket.applicants) row.applicants.add(n);
        row.largestShared = Math.max(row.largestShared, bucket.memberships);
        cp.set(oid, row);
        void org;
      }
    }

    const counterparts: GodaddyCounterpartOrganization[] = [...cp.values()]
      .map((c) => {
        const org = orgById.get(c.organizationId)!;
        return {
          organizationId: c.organizationId,
          organizationKey: org.organizationKey,
          organizationName: org.canonicalName,
          sharedSetCountWithGoDaddy: c.sharedSets.size,
          counterpartMembershipsWithinSharedSets: c.memberships,
          distinctCounterpartApplicantNamesWithinSharedSets: c.applicants.size,
          largestSharedSetMembershipCount: c.largestShared,
        };
      })
      .sort(
        (a, b) =>
          b.sharedSetCountWithGoDaddy - a.sharedSetCountWithGoDaddy ||
          b.counterpartMembershipsWithinSharedSets - a.counterpartMembershipsWithinSharedSets ||
          a.organizationName.localeCompare(b.organizationName),
      );

    godaddyRelative = {
      godaddyApplicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      godaddyOrganizationId: gdRow.organizationId,
      godaddyOrganizationKey: gdRow.organizationKey,
      godaddyOrganizationName: gdRow.organizationName,
      applicationCount: gdRow.applicationCount,
      applicationRankAmongConfirmed: gdRow.rankByApplications,
      applicationShareOfConfirmedSubset: gdRow.applicationShareOfConfirmedSubset,
      contentionMembershipCount: gdRow.contentionMembershipCount,
      contentionMembershipRankAmongConfirmed: gdRow.rankByContentionMemberships,
      contentionMembershipShareOfConfirmedSubset: gdRow.contentionMembershipShareOfConfirmedSubset,
      distinctOfficialContentionSetsTouched: gdRow.distinctContentionSetsTouched,
      sharedOfficialSetsWithCounterparts: godaddySets.length,
      distinctConfirmedCounterpartOrganizations: counterparts.length,
      totalConfirmedCounterpartMembershipsInSharedSets: counterparts.reduce(
        (n, c) => n + c.counterpartMembershipsWithinSharedSets,
        0,
      ),
      counterparts,
    };
  }

  const top5Apps = applicationConcentration
    .slice(0, 5)
    .reduce((n, r) => n + r.applicationCount, 0);
  const top10Apps = applicationConcentration
    .slice(0, 10)
    .reduce((n, r) => n + r.applicationCount, 0);
  const top5Cont = contentionConcentration
    .slice(0, 5)
    .reduce((n, r) => n + r.contentionMembershipCount, 0);

  const coverage: OrganizationConcentrationCoverage = {
    officialApplications: document.officialApplications,
    officialApplicants: document.officialApplicants,
    representedApplications: apps.length,
    representedApplicantLegalNames: new Set(apps.map((a) => a.applicant)).size,
    officialContentionSets,
    officialContentionMemberships: officialMemberships,
    confirmedOrganizations: confirmedOrgs.length,
    confirmedApplicantMappings,
    confirmedApplications,
    unresolvedApplications,
    confirmedBrandApplications,
    unresolvedBrandApplications,
    confirmedContentionMemberships,
    unresolvedContentionMemberships,
    setsWithConfirmedOrganizationMembership: setsWithConfirmed,
    organizationSnapshotHash: orgSnapshot.semanticContentSha256,
  };

  return {
    coverage,
    organizations,
    applicationConcentration,
    contentionConcentration,
    crowdedSets,
    godaddyRelative,
    topShares: {
      top5ApplicationShareOfConfirmedSubset: share(top5Apps, confirmedApplications),
      top10ApplicationShareOfConfirmedSubset: share(top10Apps, confirmedApplications),
      top5ContentionMembershipShareOfConfirmedSubset: share(
        top5Cont,
        confirmedContentionMemberships,
      ),
    },
    disclosure: {
      applicationCoverageSentence: `Organization metrics cover ${confirmedApplications.toLocaleString("en-US")} of ${apps.length.toLocaleString("en-US")} represented Applications with Confirmed identity resolution. Rankings describe that confirmed subset, not the complete 2026 round.`,
      contentionCoverageSentence: `${confirmedContentionMemberships.toLocaleString("en-US")} of ${officialMemberships.toLocaleString("en-US")} official contention memberships are attributable to Confirmed Organizations.`,
      subsetDisclaimer:
        "Confirmed subset ≠ complete round. Unresolved Applicants remain source Applicants and are not grouped into Organizations.",
    },
  };
}

/** Lookup concentration context for one Confirmed Organization key. */
export function organizationConcentrationContextForKey(
  model: OrganizationConcentrationModel,
  organizationKey: string,
): OrganizationConcentrationRow | null {
  return model.organizations.find((o) => o.organizationKey === organizationKey) ?? null;
}
