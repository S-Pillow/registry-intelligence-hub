/**
 * Bounded Command Center intelligence view model for active Browser 2.x.
 * Eligibility-gated; never exposes blocked metrics as ordinary numeric values.
 */

import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2026_ORIENTATION_AGGREGATES } from "@/comparison/approved-2026-orientation-aggregates";
import {
  resolveHubMetricEligibility,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ClaimActualityState,
  type ContentionActualityState,
} from "@/lib/hub-metric-eligibility";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

export type CrossRoundDeltaVm = {
  metricId: "application-count" | "idn-applications";
  baseline2012: number;
  active2026: number;
  difference: number;
  limitationLabel: string;
  disclosureKeys: readonly string[];
};

export type OfficialContentionStructureVm =
  | {
      status: "available";
      terminology: "official-initial-contention";
      setCount: number;
      membershipCount: number;
      largestSetSize: number | null;
      setSizeDistribution: Array<{ size: number; setCount: number }>;
      mayChangeLater: true;
      notExactStringGrouping: true;
    }
  | {
      status: "unavailable";
      reason: string;
      terminology: "official-initial-contention";
      notExactStringGrouping: true;
    };

export type RoundCompositionVm = {
  idn: { value: number; label: string; sourceChannel: "OFFICIAL_AGGREGATE" };
  brand: { value: number; label: string; sourceChannel: "OFFICIAL_AGGREGATE" };
  community: { value: number; label: string; sourceChannel: "OFFICIAL_AGGREGATE"; orientationOnly: true };
  geographic: {
    value: number;
    label: string;
    sourceChannel: "OFFICIAL_AGGREGATE";
    selfIdentified: true;
  };
  variants: { value: number; label: string; sourceChannel: "OFFICIAL_AGGREGATE" };
  replacements: {
    value: number;
    label: string;
    sourceChannel: "ROW_DERIVED";
    relationshipGrain: true;
  };
};

export type CoveragePostureVm = {
  officialApplications: number;
  observedApplicationRecords: number;
  completeness: "partial" | "complete";
  knownExcludedCount: number;
  knownExcludedIsCoverageMetadataOnly: true;
  dataHealthHref: string;
};

export type CommandCenterIntelligenceV2 = {
  roundPosture: {
    officialApplications: number;
    officialApplicants: number;
    officialContentionSets: number | null;
    officialContentionMemberships: number | null;
    applicationsSource: "official-aggregate";
    applicantsSource: "official-aggregate";
  };
  crossRound: {
    applications: CrossRoundDeltaVm | null;
    idn: CrossRoundDeltaVm | null;
    /** Explicitly omitted blocked comparisons — never numeric. */
    omittedBlocked: readonly string[];
  };
  competitiveStructure: OfficialContentionStructureVm;
  roundComposition: RoundCompositionVm | null;
  coverage: CoveragePostureVm;
  drilldown: {
    exploreApplicationsHref: string;
    searchRecordsHref: string;
    exploreContentionHref: string;
    dataHealthHref: string;
  };
};

function contentionActualityFromOverlay(
  document: RegistryApplicationsDocumentV2,
): ContentionActualityState {
  const overlay = document.contentionOverlay;
  if (
    overlay.status === "available"
    && overlay.sidecarContentSha256
    && overlay.applicationPublicationPinHash
  ) {
    return {
      round2026ContentionActuality: "REAL_SOURCE_READY",
      snapshotId: overlay.snapshotId,
      sidecarContentHash: overlay.sidecarContentSha256,
      rawSha256: overlay.rawSha256,
      applicationPublicationPinHash: overlay.applicationPublicationPinHash,
    };
  }
  return DEFAULT_CONTENTION_ACTUALITY_STATE;
}

function buildOfficialAggregateCrossRound(
  metricId: "application-count" | "idn-applications",
  baseline2012: number,
  active2026: number,
  claimActuality: ClaimActualityState,
  limitationLabel: string,
): CrossRoundDeltaVm | null {
  const entry = resolveHubMetricEligibility(metricId, claimActuality);
  if (!entry?.comparisonAllowed) return null;
  if (entry.crossRoundStatus !== "READY_WITH_LIMITATION") return null;
  return {
    metricId,
    baseline2012,
    active2026,
    difference: active2026 - baseline2012,
    limitationLabel,
    disclosureKeys: entry.disclosureKeys ?? [],
  };
}

function countReplacementRelationships(document: RegistryApplicationsDocumentV2): number {
  let count = 0;
  for (const app of document.applications) {
    if (app.replacementString) count += 1;
  }
  return count;
}

/** Derive official-initial set sizes from joined overlay membership on projected rows. */
export function deriveOfficialContentionSetSizeStats(
  document: RegistryApplicationsDocumentV2,
): { largestSetSize: number | null; setSizeDistribution: Array<{ size: number; setCount: number }> } {
  const membersBySet = new Map<string, Set<string>>();
  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      let bucket = membersBySet.get(setId);
      if (!bucket) {
        bucket = new Set();
        membersBySet.set(setId, bucket);
      }
      bucket.add(app.applicationId);
    }
  }
  if (membersBySet.size === 0) {
    return { largestSetSize: null, setSizeDistribution: [] };
  }
  const sizeHistogram = new Map<number, number>();
  let largest = 0;
  for (const members of membersBySet.values()) {
    const size = members.size;
    largest = Math.max(largest, size);
    sizeHistogram.set(size, (sizeHistogram.get(size) ?? 0) + 1);
  }
  const setSizeDistribution = [...sizeHistogram.entries()]
    .map(([size, setCount]) => ({ size, setCount }))
    .sort((a, b) => b.size - a.size || a.setCount - b.setCount);
  return { largestSetSize: largest, setSizeDistribution };
}

function buildCompetitiveStructure(
  document: RegistryApplicationsDocumentV2,
  claimActuality: ClaimActualityState,
  contentionActuality: ContentionActualityState,
): OfficialContentionStructureVm {
  const setsElig = resolveHubMetricEligibility(
    "initial-contention-sets",
    claimActuality,
    contentionActuality,
  );
  const membersElig = resolveHubMetricEligibility(
    "initial-contention-memberships",
    claimActuality,
    contentionActuality,
  );
  const overlay = document.contentionOverlay;
  const eligible =
    setsElig?.claimReadiness.round2026 === "REAL_SOURCE_READY"
    && membersElig?.claimReadiness.round2026 === "REAL_SOURCE_READY"
    && overlay.status === "available"
    && typeof overlay.officialContentionSetCount === "number"
    && typeof overlay.joinedMemberCount === "number";

  if (!eligible) {
    return {
      status: "unavailable",
      reason: overlay.reason ?? "Official initial contention overlay unavailable",
      terminology: "official-initial-contention",
      notExactStringGrouping: true,
    };
  }

  const { largestSetSize, setSizeDistribution } = deriveOfficialContentionSetSizeStats(document);
  return {
    status: "available",
    terminology: "official-initial-contention",
    setCount: overlay.officialContentionSetCount!,
    membershipCount: overlay.joinedMemberCount!,
    largestSetSize,
    setSizeDistribution,
    mayChangeLater: true,
    notExactStringGrouping: true,
  };
}

function buildRoundComposition(
  document: RegistryApplicationsDocumentV2,
  claimActuality: ClaimActualityState,
): RoundCompositionVm | null {
  const brand = resolveHubMetricEligibility("brand-applications", claimActuality);
  const community = resolveHubMetricEligibility("community-applications", claimActuality);
  const geographic = resolveHubMetricEligibility("geographic-applications", claimActuality);
  const variants = resolveHubMetricEligibility("variant-applications", claimActuality);
  const replacements = resolveHubMetricEligibility("replacement-relationships", claimActuality);
  const idn = resolveHubMetricEligibility("idn-applications", claimActuality);

  const orientationReady = (entry: ReturnType<typeof resolveHubMetricEligibility>) =>
    entry?.claimReadiness.round2026 === "REAL_SOURCE_READY"
    && entry.sourceChannel === "OFFICIAL_AGGREGATE";

  if (
    !orientationReady(idn)
    || !orientationReady(brand)
    || !orientationReady(community)
    || !orientationReady(geographic)
    || !orientationReady(variants)
    || replacements?.claimReadiness.round2026 !== "REAL_SOURCE_READY"
  ) {
    return null;
  }

  return {
    idn: {
      value: APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications,
      label: "IDN applications",
      sourceChannel: "OFFICIAL_AGGREGATE",
    },
    brand: {
      value: APPROVED_2026_ORIENTATION_AGGREGATES.brandApplications,
      label: "Brand applications",
      sourceChannel: "OFFICIAL_AGGREGATE",
    },
    community: {
      value: APPROVED_2026_ORIENTATION_AGGREGATES.communityApplications,
      label: "Community applications",
      sourceChannel: "OFFICIAL_AGGREGATE",
      orientationOnly: true,
    },
    geographic: {
      value: APPROVED_2026_ORIENTATION_AGGREGATES.geographicApplicationsSelfIdentified,
      label: "Geographic applications (self-identified)",
      sourceChannel: "OFFICIAL_AGGREGATE",
      selfIdentified: true,
    },
    variants: {
      value: APPROVED_2026_ORIENTATION_AGGREGATES.variantApplications,
      label: "Variant applications",
      sourceChannel: "OFFICIAL_AGGREGATE",
    },
    replacements: {
      value: countReplacementRelationships(document),
      label: "Replacement string relationships",
      sourceChannel: "ROW_DERIVED",
      relationshipGrain: true,
    },
  };
}

const OMITTED_BLOCKED_CROSS_ROUND = [
  "unique-applied-strings",
  "community-applications",
  "geographic-applications",
  "initial-contention-sets",
  "organization-round-count",
  "returning-participant-identity",
  "category-mix",
] as const;

/**
 * Build intelligence-first Command Center view model for active 2.x.
 * Blocked metrics are omitted (not zeroed).
 */
export function buildCommandCenterIntelligenceV2(input: {
  document: RegistryApplicationsDocumentV2;
  claimActuality: ClaimActualityState;
}): CommandCenterIntelligenceV2 {
  const { document, claimActuality } = input;
  const contentionActuality = contentionActualityFromOverlay(document);
  const competitiveStructure = buildCompetitiveStructure(
    document,
    claimActuality,
    contentionActuality,
  );

  const applicationsCrossRound = buildOfficialAggregateCrossRound(
    "application-count",
    APPROVED_2012_BASELINE.applications,
    document.officialApplications,
    claimActuality,
    "Reveal Day application-count comparison (READY_WITH_LIMITATION) — official aggregate, not observed row count",
  );

  const idnCrossRound = buildOfficialAggregateCrossRound(
    "idn-applications",
    APPROVED_2012_BASELINE.idnApplications,
    APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications,
    claimActuality,
    "IDN designation/application comparison (READY_WITH_LIMITATION) — official aggregate",
  );

  return {
    roundPosture: {
      officialApplications: document.officialApplications,
      officialApplicants: document.officialApplicants,
      officialContentionSets:
        competitiveStructure.status === "available" ? competitiveStructure.setCount : null,
      officialContentionMemberships:
        competitiveStructure.status === "available" ? competitiveStructure.membershipCount : null,
      applicationsSource: "official-aggregate",
      applicantsSource: "official-aggregate",
    },
    crossRound: {
      applications: applicationsCrossRound,
      idn: idnCrossRound,
      omittedBlocked: OMITTED_BLOCKED_CROSS_ROUND,
    },
    competitiveStructure,
    roundComposition: buildRoundComposition(document, claimActuality),
    coverage: {
      officialApplications: document.officialApplications,
      observedApplicationRecords: document.observedApplicationRecords,
      completeness: document.applicationRecordCoverage.completeness,
      knownExcludedCount: document.knownExcludedRecords.length,
      knownExcludedIsCoverageMetadataOnly: true,
      dataHealthHref: "/data-health",
    },
    drilldown: {
      exploreApplicationsHref: "/explore",
      searchRecordsHref: "/explore",
      exploreContentionHref: "/explore",
      dataHealthHref: "/data-health",
    },
  };
}
