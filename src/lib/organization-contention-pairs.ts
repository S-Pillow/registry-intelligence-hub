/**
 * Confirmed Organization official-contention co-membership pairs
 * (ORG-CONTENTION-PAIRS-1). Structural only — not rivalry or opportunity.
 */

import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export type OrganizationContentionPairCoverage = {
  officialContentionSets: number;
  officialContentionMemberships: number;
  confirmedContentionMemberships: number;
  unresolvedContentionMemberships: number;
  candidateAmbiguousContentionMemberships: number;
  setsWithConfirmedOrganizationMembership: number;
  pairableOfficialSets: number;
  pairableConfirmedMemberships: number;
  confirmedOrganizations: number;
  confirmedOrganizationsWithPair: number;
  confirmedOrganizationsWithoutPair: number;
  uniqueConfirmedOrganizationPairs: number;
  recurringConfirmedOrganizationPairs: number;
  organizationSnapshotHash: string;
};

export type OrganizationContentionPairRow = {
  pairKey: string;
  organizationAId: string;
  organizationAKey: string;
  organizationAName: string;
  organizationBId: string;
  organizationBKey: string;
  organizationBName: string;
  sharedSetCount: number;
  membershipInteractions: number;
  /** TOTAL official membership count of the largest co-membered set. */
  largestOfficialSharedSetSize: number;
  sharedSetIds: string[];
};

export type OrganizationCounterpartRow = {
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  sharedSetCount: number;
  membershipInteractions: number;
  largestOfficialSharedSetSize: number;
  sharedSetIds: string[];
};

export type OrganizationCounterpartSummary = {
  organizationId: string;
  organizationKey: string;
  organizationName: string;
  distinctConfirmedCounterpartCount: number;
  sharedSetCountWithAnyConfirmedCounterpart: number;
  recurringCounterpartCount: number;
  counterparts: OrganizationCounterpartRow[];
  isGodaddyOrganization: boolean;
};

export type GodaddyPairSlice = {
  godaddyOrganizationId: string;
  godaddyOrganizationKey: string;
  godaddyOrganizationName: string;
  distinctConfirmedCounterpartCount: number;
  counterparts: OrganizationCounterpartRow[];
};

export type OrganizationContentionPairModel = {
  coverage: OrganizationContentionPairCoverage;
  pairs: OrganizationContentionPairRow[];
  topPairs: OrganizationContentionPairRow[];
  organizationSummaries: OrganizationCounterpartSummary[];
  widestCounterpartBreadth: OrganizationCounterpartSummary[];
  godaddy: GodaddyPairSlice | null;
  disclosure: {
    confirmedOnlySentence: string;
    membershipCoverageSentence: string;
    pairableSetsSentence: string;
    nonConfirmedSentence: string;
  };
};

export class OrganizationContentionPairsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationContentionPairsError";
  }
}

/** Deterministic undirected pair key with organizationAId < organizationBId. */
export function canonicalOrganizationPairKey(
  organizationIdA: string,
  organizationIdB: string,
): { pairKey: string; organizationAId: string; organizationBId: string } {
  if (organizationIdA === organizationIdB) {
    throw new OrganizationContentionPairsError(
      `Self-pair is forbidden: ${organizationIdA}`,
    );
  }
  const [organizationAId, organizationBId] =
    organizationIdA < organizationIdB
      ? [organizationIdA, organizationIdB]
      : [organizationIdB, organizationIdA];
  return {
    pairKey: `${organizationAId}::${organizationBId}`,
    organizationAId,
    organizationBId,
  };
}

function comparePairRows(
  a: OrganizationContentionPairRow,
  b: OrganizationContentionPairRow,
): number {
  return (
    b.sharedSetCount - a.sharedSetCount ||
    b.membershipInteractions - a.membershipInteractions ||
    a.organizationAName.localeCompare(b.organizationAName) ||
    a.organizationBName.localeCompare(b.organizationBName) ||
    a.pairKey.localeCompare(b.pairKey)
  );
}

function compareCounterpartRows(
  a: OrganizationCounterpartRow,
  b: OrganizationCounterpartRow,
): number {
  return (
    b.sharedSetCount - a.sharedSetCount ||
    b.membershipInteractions - a.membershipInteractions ||
    a.organizationName.localeCompare(b.organizationName) ||
    a.organizationKey.localeCompare(b.organizationKey)
  );
}

function compareBreadth(
  a: OrganizationCounterpartSummary,
  b: OrganizationCounterpartSummary,
): number {
  return (
    b.distinctConfirmedCounterpartCount - a.distinctConfirmedCounterpartCount ||
    a.organizationName.localeCompare(b.organizationName) ||
    a.organizationKey.localeCompare(b.organizationKey)
  );
}

/**
 * Build Confirmed Organization official-contention co-membership intelligence.
 */
export function buildOrganizationContentionPairs(
  document: RegistryApplicationsDocumentV2,
  orgSnapshot: OrganizationResolutionSnapshot,
  options?: { topPairLimit?: number; widestBreadthLimit?: number },
): OrganizationContentionPairModel {
  const topPairLimit = options?.topPairLimit ?? 20;
  const widestBreadthLimit = options?.widestBreadthLimit ?? 15;

  const pinHash = orgSnapshot.applicationPublicationPin.applicationGraphContentSha256;
  const docPin = document.bundleManifest?.applicationGraphContentSha256;
  if (docPin && pinHash && docPin !== pinHash) {
    throw new OrganizationContentionPairsError(
      `Organization snapshot Application publication pin mismatch: snapshot=${pinHash} document=${docPin}`,
    );
  }

  const orgById = new Map(orgSnapshot.organizations.map((o) => [o.organizationId, o] as const));
  const confirmedOrgs = orgSnapshot.organizations.filter((o) => o.status === "CONFIRMED");
  const confirmedOrgIds = new Set(confirmedOrgs.map((o) => o.organizationId));

  const applicantToOrgId = new Map<string, string>();
  const unresolvedApplicantNames = new Set<string>();
  const candidateAmbiguousApplicantNames = new Set<string>();

  for (const m of orgSnapshot.applicantIdentityMappings) {
    if (m.resolutionState === "UNRESOLVED") {
      unresolvedApplicantNames.add(m.applicantLegalName);
      continue;
    }
    if (m.resolutionState === "CANDIDATE" || m.resolutionState === "AMBIGUOUS") {
      candidateAmbiguousApplicantNames.add(m.applicantLegalName);
      continue;
    }
    if (m.resolutionState !== "CONFIRMED") continue;
    if (!m.organizationId || !confirmedOrgIds.has(m.organizationId)) {
      throw new OrganizationContentionPairsError(
        `CONFIRMED mapping for "${m.applicantLegalName}" points to missing/non-confirmed Organization`,
      );
    }
    if (!orgById.has(m.organizationId)) {
      throw new OrganizationContentionPairsError(
        `CONFIRMED mapping for "${m.applicantLegalName}" missing Organization entity ${m.organizationId}`,
      );
    }
    applicantToOrgId.set(m.applicantLegalName, m.organizationId);
  }

  const apps = document.applications;
  const appById = new Map(apps.map((a) => [a.applicationId, a] as const));

  type SetAcc = { setId: string; applicationIds: string[] };
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
    }
  }

  const officialContentionSets =
    document.contentionOverlay?.officialContentionSetCount ?? setAcc.size;
  if (document.contentionOverlay?.joinedMemberCount != null) {
    if (document.contentionOverlay.joinedMemberCount !== officialMemberships) {
      throw new OrganizationContentionPairsError(
        `Contention membership reconcile failed: overlay joined=${document.contentionOverlay.joinedMemberCount} derived=${officialMemberships}`,
      );
    }
  }

  let confirmedContentionMemberships = 0;
  let unresolvedContentionMemberships = 0;
  let candidateAmbiguousContentionMemberships = 0;
  let setsWithConfirmed = 0;

  type PairAcc = {
    organizationAId: string;
    organizationBId: string;
    sharedSets: Set<string>;
    membershipInteractions: number;
    largestOfficialSharedSetSize: number;
  };
  const pairAcc = new Map<string, PairAcc>();

  let pairableOfficialSets = 0;
  let pairableConfirmedMemberships = 0;

  for (const s of setAcc.values()) {
    const orgMemberships = new Map<string, number>();
    let confirmedInSet = 0;
    let hasConfirmed = false;

    for (const aid of s.applicationIds) {
      const app = appById.get(aid);
      if (!app) {
        throw new OrganizationContentionPairsError(
          `Contention membership applicationId ${aid} missing from Application universe`,
        );
      }
      const oid = applicantToOrgId.get(app.applicant);
      if (oid) {
        confirmedContentionMemberships += 1;
        confirmedInSet += 1;
        hasConfirmed = true;
        orgMemberships.set(oid, (orgMemberships.get(oid) ?? 0) + 1);
      } else if (unresolvedApplicantNames.has(app.applicant)) {
        unresolvedContentionMemberships += 1;
      } else if (candidateAmbiguousApplicantNames.has(app.applicant)) {
        candidateAmbiguousContentionMemberships += 1;
      } else {
        // Applicant not present in steward mappings — treat as non-Confirmed coverage only.
        candidateAmbiguousContentionMemberships += 1;
      }
    }

    if (hasConfirmed) setsWithConfirmed += 1;

    const orgIds = [...orgMemberships.keys()].sort();
    if (orgIds.length >= 2) {
      pairableOfficialSets += 1;
      pairableConfirmedMemberships += confirmedInSet;
      const officialSize = s.applicationIds.length;

      for (let i = 0; i < orgIds.length; i++) {
        for (let j = i + 1; j < orgIds.length; j++) {
          const left = orgIds[i]!;
          const right = orgIds[j]!;
          const { pairKey, organizationAId, organizationBId } =
            canonicalOrganizationPairKey(left, right);
          const membA = orgMemberships.get(organizationAId)!;
          const membB = orgMemberships.get(organizationBId)!;
          const row =
            pairAcc.get(pairKey) ??
            ({
              organizationAId,
              organizationBId,
              sharedSets: new Set<string>(),
              membershipInteractions: 0,
              largestOfficialSharedSetSize: 0,
            } satisfies PairAcc);
          if (pairAcc.has(pairKey)) {
            // Ensure canonical ids never flip for an existing key.
            if (
              row.organizationAId !== organizationAId ||
              row.organizationBId !== organizationBId
            ) {
              throw new OrganizationContentionPairsError(
                `Corrupt pair identity for ${pairKey}`,
              );
            }
          }
          row.sharedSets.add(s.setId);
          row.membershipInteractions += membA * membB;
          row.largestOfficialSharedSetSize = Math.max(
            row.largestOfficialSharedSetSize,
            officialSize,
          );
          pairAcc.set(pairKey, row);
        }
      }
    }
  }

  if (
    confirmedContentionMemberships +
      unresolvedContentionMemberships +
      candidateAmbiguousContentionMemberships !==
    officialMemberships
  ) {
    throw new OrganizationContentionPairsError(
      `Membership class reconcile failed: confirmed=${confirmedContentionMemberships} unresolved=${unresolvedContentionMemberships} candidateAmbiguous=${candidateAmbiguousContentionMemberships} official=${officialMemberships}`,
    );
  }

  const pairs: OrganizationContentionPairRow[] = [...pairAcc.entries()]
    .map(([pairKey, row]) => {
      const orgA = orgById.get(row.organizationAId)!;
      const orgB = orgById.get(row.organizationBId)!;
      return {
        pairKey,
        organizationAId: row.organizationAId,
        organizationAKey: orgA.organizationKey,
        organizationAName: orgA.canonicalName,
        organizationBId: row.organizationBId,
        organizationBKey: orgB.organizationKey,
        organizationBName: orgB.canonicalName,
        sharedSetCount: row.sharedSets.size,
        membershipInteractions: row.membershipInteractions,
        largestOfficialSharedSetSize: row.largestOfficialSharedSetSize,
        sharedSetIds: [...row.sharedSets].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        ),
      };
    })
    .sort(comparePairRows);

  // Per-organization counterpart summaries
  type CpBucket = {
    sharedSets: Set<string>;
    membershipInteractions: number;
    largestOfficialSharedSetSize: number;
  };
  const byOrgCounterparts = new Map<string, Map<string, CpBucket>>();

  for (const pair of pairs) {
    const sides: Array<[string, string]> = [
      [pair.organizationAId, pair.organizationBId],
      [pair.organizationBId, pair.organizationAId],
    ];
    for (const [selfId, otherId] of sides) {
      const map = byOrgCounterparts.get(selfId) ?? new Map<string, CpBucket>();
      map.set(otherId, {
        sharedSets: new Set(pair.sharedSetIds),
        membershipInteractions: pair.membershipInteractions,
        largestOfficialSharedSetSize: pair.largestOfficialSharedSetSize,
      });
      byOrgCounterparts.set(selfId, map);
    }
  }

  const godaddyOrgId = applicantToOrgId.get(GODADDY_FOCAL_APPLICANT_LEGAL_NAME) ?? null;

  const organizationSummaries: OrganizationCounterpartSummary[] = confirmedOrgs
    .map((org) => {
      const cps = byOrgCounterparts.get(org.organizationId) ?? new Map();
      const counterparts: OrganizationCounterpartRow[] = [...cps.entries()]
        .map(([oid, bucket]) => {
          const other = orgById.get(oid)!;
          return {
            organizationId: oid,
            organizationKey: other.organizationKey,
            organizationName: other.canonicalName,
            sharedSetCount: bucket.sharedSets.size,
            membershipInteractions: bucket.membershipInteractions,
            largestOfficialSharedSetSize: bucket.largestOfficialSharedSetSize,
            sharedSetIds: [...bucket.sharedSets].sort((a, b) =>
              a.localeCompare(b, undefined, { numeric: true }),
            ),
          };
        })
        .sort(compareCounterpartRows);

      const sharedSetCountWithAnyConfirmedCounterpart = new Set(
        counterparts.flatMap((c) => c.sharedSetIds),
      ).size;

      return {
        organizationId: org.organizationId,
        organizationKey: org.organizationKey,
        organizationName: org.canonicalName,
        distinctConfirmedCounterpartCount: counterparts.length,
        sharedSetCountWithAnyConfirmedCounterpart,
        recurringCounterpartCount: counterparts.filter((c) => c.sharedSetCount > 1).length,
        counterparts,
        isGodaddyOrganization: godaddyOrgId === org.organizationId,
      };
    })
    .sort(
      (a, b) =>
        a.organizationName.localeCompare(b.organizationName) ||
        a.organizationKey.localeCompare(b.organizationKey),
    );

  const widestCounterpartBreadth = [...organizationSummaries]
    .filter((o) => o.distinctConfirmedCounterpartCount > 0)
    .sort(compareBreadth)
    .slice(0, widestBreadthLimit);

  const withPair = organizationSummaries.filter((o) => o.distinctConfirmedCounterpartCount > 0);
  const recurringPairs = pairs.filter((p) => p.sharedSetCount > 1).length;

  let godaddy: GodaddyPairSlice | null = null;
  if (godaddyOrgId) {
    const gd = organizationSummaries.find((o) => o.organizationId === godaddyOrgId)!;
    godaddy = {
      godaddyOrganizationId: gd.organizationId,
      godaddyOrganizationKey: gd.organizationKey,
      godaddyOrganizationName: gd.organizationName,
      distinctConfirmedCounterpartCount: gd.distinctConfirmedCounterpartCount,
      counterparts: gd.counterparts,
    };
  }

  const coverage: OrganizationContentionPairCoverage = {
    officialContentionSets,
    officialContentionMemberships: officialMemberships,
    confirmedContentionMemberships,
    unresolvedContentionMemberships,
    candidateAmbiguousContentionMemberships,
    setsWithConfirmedOrganizationMembership: setsWithConfirmed,
    pairableOfficialSets,
    pairableConfirmedMemberships,
    confirmedOrganizations: confirmedOrgs.length,
    confirmedOrganizationsWithPair: withPair.length,
    confirmedOrganizationsWithoutPair: confirmedOrgs.length - withPair.length,
    uniqueConfirmedOrganizationPairs: pairs.length,
    recurringConfirmedOrganizationPairs: recurringPairs,
    organizationSnapshotHash: orgSnapshot.semanticContentSha256,
  };

  return {
    coverage,
    pairs,
    topPairs: pairs.slice(0, topPairLimit),
    organizationSummaries,
    widestCounterpartBreadth,
    godaddy,
    disclosure: {
      confirmedOnlySentence:
        "Confirmed-Organization pairings describe co-membership among steward-Confirmed Organizations only.",
      membershipCoverageSentence: `${confirmedContentionMemberships.toLocaleString("en-US")} of ${officialMemberships.toLocaleString("en-US")} official contention memberships are attributable to Confirmed Organizations.`,
      pairableSetsSentence: `${pairableOfficialSets.toLocaleString("en-US")} of ${officialContentionSets.toLocaleString("en-US")} official contention sets contain at least two distinct Confirmed Organizations and are pairable at Organization grain.`,
      nonConfirmedSentence: `${unresolvedContentionMemberships.toLocaleString("en-US")} memberships are UNRESOLVED. ${candidateAmbiguousContentionMemberships.toLocaleString("en-US")} memberships belong to Candidate/Ambiguous mappings and are excluded from Confirmed pair intelligence.`,
    },
  };
}

export function organizationCounterpartSummaryForKey(
  model: OrganizationContentionPairModel,
  organizationKey: string,
): OrganizationCounterpartSummary | null {
  return model.organizationSummaries.find((o) => o.organizationKey === organizationKey) ?? null;
}
