/**
 * CROSS-ROUND-STRUCT-1 — structural 2012 vs 2026 intelligence.
 *
 * Only surfaces comparisons whose definitions, denominators, and source maturity
 * are defensible. Unmatched ≠ new. Prefer BLOCKED over forced charts.
 */

import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2026_ORIENTATION_AGGREGATES } from "@/comparison/approved-2026-orientation-aggregates";
import {
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012,
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026,
} from "@/cross-round-organization-identity/steward-decision";
import { organizationProfileHref } from "@/lib/organization-intelligence";
import {
  resolveHubMetricEligibility,
  type ClaimActualityState,
} from "@/lib/hub-metric-eligibility";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

export type CompatibilityStatus =
  | "DIRECTLY_COMPARABLE"
  | "COMPARABLE_WITH_LIMITATION"
  | "BLOCKED";

export type CompatibilityDimensionId =
  | "applications"
  | "idn-applications"
  | "applicant-legal-entities"
  | "regional-distribution"
  | "community"
  | "geographic"
  | "unique-applied-strings"
  | "exact-string-repeats"
  | "contention"
  | "organization-count"
  | "multi-application-concentration"
  | "brand";

export type CompatibilityRow = {
  dimensionId: CompatibilityDimensionId;
  label: string;
  status: CompatibilityStatus;
  source2012: string;
  source2026: string;
  grain: string;
  denominator: string;
  fieldDefinition: string;
  sourceCompleteness: string;
  replacementVariantEffect: string;
  identityEffect: string;
  methodologyDifference: string;
  reason: string;
};

/** Authority for what the /cross-round experience may surface as a delta. */
export const CROSS_ROUND_COMPATIBILITY_MATRIX: readonly CompatibilityRow[] = [
  {
    dimensionId: "applications",
    label: "Applications",
    status: "DIRECTLY_COMPARABLE",
    source2012: APPROVED_2012_BASELINE.sourceLabel,
    source2026: "ICANN APS official Application aggregate",
    grain: "Application (official round total)",
    denominator: "Official Application count both rounds",
    fieldDefinition: "Published Application rows / official Application aggregate",
    sourceCompleteness: "Complete official totals both rounds",
    replacementVariantEffect: "2026 replacements are relationship grain — not extra Applications",
    identityEffect: "Applicant vs Organization identity does not change Application totals",
    methodologyDifference: "None material for official Application count",
    reason: "Official Reveal Day Application aggregates share comparable round meaning.",
  },
  {
    dimensionId: "idn-applications",
    label: "IDN Applications",
    status: "DIRECTLY_COMPARABLE",
    source2012: APPROVED_2012_BASELINE.sourceLabel,
    source2026: APPROVED_2026_ORIENTATION_AGGREGATES.asOfLabel,
    grain: "Application with IDN designation (official aggregate)",
    denominator: "Official IDN Application count both rounds",
    fieldDefinition: "IDN Application official/announcement aggregate",
    sourceCompleteness: "Complete official aggregates both rounds",
    replacementVariantEffect: "Does not invent IDN from string shape beyond accepted aggregates",
    identityEffect: "Not dependent on Organization resolution",
    methodologyDifference: "None material for official IDN Application count",
    reason: "Official IDN Application aggregates are accepted for cross-round delta.",
  },
  {
    dimensionId: "applicant-legal-entities",
    label: "Applicant legal entities",
    status: "BLOCKED",
    source2012: "2012 Reveal Day corpus distinct Applicant legal names (1154)",
    source2026: "Official Applicants 481 / represented legal names 480",
    grain: "Applicant legal name",
    denominator: "Mixed official vs observed grains if collapsed",
    fieldDefinition: "Exact published Applicant legal name — not Organization",
    sourceCompleteness: "2026 has official 481 vs represented 480 (WDO gap)",
    replacementVariantEffect: "N/A for Applicant count",
    identityEffect: "Must not convert Applicant count into Organization count",
    methodologyDifference:
      "2012 legal-name distinct count and 2026 official Applicant aggregate are not proven equivalent without further grain work",
    reason:
      "Applicant legal-name grains and completeness differ; RIH does not publish a forced Applicant-count delta.",
  },
  {
    dimensionId: "regional-distribution",
    label: "Regional distribution",
    status: "BLOCKED",
    source2012: "2012 CSV Region codes (NA/EUR/AP/LAC/AF) on Applications",
    source2026: "2026 region metrics split (applicant-by-region vs application-by-region)",
    grain: "Application vs Applicant region (incompatible if mixed)",
    denominator: "Would require represented 1614 disclosure if Application-grain were aligned",
    fieldDefinition: "Region code / location fields — no accepted cross-round remapping",
    sourceCompleteness: "2026 represented coverage is partial vs official 1615",
    replacementVariantEffect: "Replacement rows must not inflate Application region totals",
    identityEffect: "Organization identity does not define region",
    methodologyDifference: "No accepted region-normalization method across rounds",
    reason: "Region definitions and grains are not cleanly aligned for a structural delta.",
  },
  {
    dimensionId: "community",
    label: "Community designation",
    status: "BLOCKED",
    source2012: "2012 CSV Community designation count (84)",
    source2026: "2026 official Community designation aggregate (16)",
    grain: "Application designation",
    denominator: "Official designation counts — semantics not proven equivalent",
    fieldDefinition: "Community flag/designation label",
    sourceCompleteness: "Both publish Community counts, but definitions differ",
    replacementVariantEffect: "Designation grain only",
    identityEffect: "None",
    methodologyDifference: "Shared label is not shared historical methodology",
    reason: "Community fields share a name but not a proven equivalent definition across rounds.",
  },
  {
    dimensionId: "geographic",
    label: "Geographic designation",
    status: "BLOCKED",
    source2012: "2012 CSV Geographic designation count (66)",
    source2026: "2026 self-identified Geographic designation (15)",
    grain: "Application designation",
    denominator: "Not equivalent program treatment",
    fieldDefinition: "2026 is explicitly self-identified Geographic",
    sourceCompleteness: "Official aggregates exist, semantics differ",
    replacementVariantEffect: "Designation grain only",
    identityEffect: "None",
    methodologyDifference: "Self-identified 2026 Geographic ≠ historical Geographic treatment",
    reason: "Geographic designations must not be silently equated across rounds.",
  },
  {
    dimensionId: "unique-applied-strings",
    label: "Unique applied strings",
    status: "BLOCKED",
    source2012: "Accepted exact distinct strings (1409)",
    source2026: "Unique-string headline blocked under partial Application coverage",
    grain: "Exact applied-for string",
    denominator: "Complete Application set required for headline unique-string delta",
    fieldDefinition: "Distinct exact applied-for strings",
    sourceCompleteness: "2026 represented Applications are 1614 of 1615 (WDO gap)",
    replacementVariantEffect: "Replacement/variant relationships complicate string identity",
    identityEffect: "None",
    methodologyDifference: "Coverage incompleteness blocks complete-round unique-string comparison",
    reason: "2026 unique-string completeness is constrained by the WDO coverage gap.",
  },
  {
    dimensionId: "exact-string-repeats",
    label: "Exact-string competition / repeats",
    status: "BLOCKED",
    source2012: "230 repeated exact strings; 751 Applications in repeated exact strings",
    source2026: "Exact-string competition not unlocked for cross-round headline",
    grain: "Exact applied-for string competition groups",
    denominator: "Requires complete Application coverage for round-wide rates",
    fieldDefinition: "Exact-string repeat groups (not official contention)",
    sourceCompleteness: "2026 partial coverage blocks complete-round rates",
    replacementVariantEffect: "Must not treat replacements as separate Applications",
    identityEffect: "None",
    methodologyDifference: "Distinct from official contention publications",
    reason: "Exact-string repeat structure is not published as a 2012→2026 delta under current coverage.",
  },
  {
    dimensionId: "contention",
    label: "Contention",
    status: "BLOCKED",
    source2012: "2012 preliminary contention membership Applications (754); set entities not UI-approved",
    source2026: "Official initial contention 263 sets / 891 memberships",
    grain: "Program-stage contention membership / set",
    denominator: "Different program stages",
    fieldDefinition: "2012 preliminary vs 2026 official initial contention",
    sourceCompleteness: "Both publish contention facts for their stage",
    replacementVariantEffect: "N/A for stage comparison",
    identityEffect: "Organization resolution does not make stages equivalent",
    methodologyDifference: "Different program stages / definitions",
    reason:
      "2012 preliminary and 2026 initial contention states are not treated as an equivalent program-stage measure.",
  },
  {
    dimensionId: "organization-count",
    label: "Organization count",
    status: "BLOCKED",
    source2012: "Confirmed 2012 Organization portfolios are a partial subset",
    source2026: "Confirmed Organizations are a partial evidence-backed subset (89 Confirmed)",
    grain: "Organization (steward-confirmed)",
    denominator: "Incomplete resolution both rounds — not round-wide Organization universe",
    fieldDefinition: "Evidence-backed Organization ≠ Applicant legal name",
    sourceCompleteness: "Strong coverage asymmetry between rounds",
    replacementVariantEffect: "N/A",
    identityEffect: "Organization resolution coverage differs strongly between rounds",
    methodologyDifference: "Confirmed subsets only; unmatched ≠ new",
    reason: "Organization counts are incomplete subsets and must not be presented as round totals.",
  },
  {
    dimensionId: "multi-application-concentration",
    label: "Multi-Application participant concentration",
    status: "BLOCKED",
    source2012: "2012 Applicant concentration derived from corpus",
    source2026: "2026 concentration requires aligned Applicant grain + coverage",
    grain: "Applicant / Organization portfolio concentration",
    denominator: "Depends on identity completeness",
    fieldDefinition: "Share of Applications held by multi-Application participants",
    sourceCompleteness: "Organization resolution incomplete; Applicant grains careful",
    replacementVariantEffect: "Must preserve Application attribution",
    identityEffect: "Organization vs Applicant confusion would distort concentration",
    methodologyDifference: "No accepted cross-round concentration method unlocked",
    reason: "Concentration rates are not unlocked without complete, aligned identity coverage.",
  },
  {
    dimensionId: "brand",
    label: "Brand designation",
    status: "BLOCKED",
    source2012: "No accepted equivalent 2012 Brand classification",
    source2026: "Official Brand Applications (333) — 2026 round context only",
    grain: "Application designation",
    denominator: "2026-only — no cross-round Brand delta",
    fieldDefinition: "2026 Brand designation attribute",
    sourceCompleteness: "2026 official aggregate available",
    replacementVariantEffect: "Designation grain only",
    identityEffect: "Brand strings are not Organizations",
    methodologyDifference: "No historically equivalent accepted Brand classification for 2012",
    reason: "Brand is 2026 round context only — not a cross-round change metric.",
  },
] as const;

export function compatibilityStatusFor(
  dimensionId: CompatibilityDimensionId,
): CompatibilityStatus {
  const row = CROSS_ROUND_COMPATIBILITY_MATRIX.find((r) => r.dimensionId === dimensionId);
  if (!row) throw new Error(`Unknown compatibility dimension: ${dimensionId}`);
  return row.status;
}

export type StructuralComparisonCard = {
  id: "applications" | "idn-applications";
  label: string;
  value2012: number;
  value2026: number;
  delta: number;
  status: CompatibilityStatus;
  limitation: string;
  source2012: string;
  source2026: string;
  exploreHref: string | null;
};

export type ReturningOrganizationCard = {
  organizationKey: string;
  displayName: string;
  applications2012: number;
  applications2026: number;
  delta: number;
  profileHref: string;
  wording: string;
};

export type BlockedComparisonCard = {
  dimensionId: CompatibilityDimensionId;
  label: string;
  reason: string;
};

export type RoundContextFact = {
  id: string;
  label: string;
  value: number;
  note: string;
};

export type CrossRoundStructuralIntelligence = {
  title: string;
  subtitle: string;
  summary: StructuralComparisonCard[];
  confirmedComparisons: StructuralComparisonCard[];
  participationShape: {
    label: string;
    facts: RoundContextFact[];
    note: string;
  };
  returningOrganizations: {
    label: string;
    scopeWording: string;
    unmatchedIsNotNew: string;
    organizations: ReturningOrganizationCard[];
    sample: {
      applications2012: number;
      applications2026: number;
      delta: number;
      label: string;
    };
  };
  blockedComparisons: BlockedComparisonCard[];
  coverage: {
    officialApplications2026: number;
    representedApplications2026: number;
    officialApplicants2026: number;
    representedApplicants2026: number;
    wdoDisclosure: string;
  };
  sources: {
    source2012: string;
    source2026Applications: string;
    source2026Orientation: string;
    returningMethod: string;
    dataHealthHref: string;
    methodologyDocHref: string;
  };
  commandCenterHref: string;
};

export const CONFIRMED_RETURNING_ORGANIZATION_FACTS = [
  {
    organizationKey: "hist-2012-microsoft",
    displayName: "Microsoft",
    applications2012: 11,
    applications2026: 2,
  },
  {
    organizationKey: "hist-2012-google-charleston-road",
    displayName: "Google",
    applications2012: 101,
    applications2026: 39,
  },
] as const;

export function crossRoundStructuralHref(): string {
  return "/cross-round";
}

function buildComparisonCard(args: {
  id: "applications" | "idn-applications";
  label: string;
  value2012: number;
  value2026: number;
  status: CompatibilityStatus;
  limitation: string;
  source2012: string;
  source2026: string;
  exploreHref: string | null;
}): StructuralComparisonCard {
  return {
    ...args,
    delta: args.value2026 - args.value2012,
  };
}

export function buildCrossRoundStructuralIntelligence(input: {
  document: RegistryApplicationsDocumentV2;
  claimActuality: ClaimActualityState;
}): CrossRoundStructuralIntelligence {
  const { document, claimActuality } = input;
  const appsElig = resolveHubMetricEligibility("application-count", claimActuality);
  const idnElig = resolveHubMetricEligibility("idn-applications", claimActuality);
  const appsAllowed =
    !!appsElig?.comparisonAllowed && appsElig.crossRoundStatus === "READY_WITH_LIMITATION";
  const idnAllowed =
    !!idnElig?.comparisonAllowed && idnElig.crossRoundStatus === "READY_WITH_LIMITATION";

  const officialApps = document.officialApplications;
  const observedApps = document.observedApplicationRecords;
  const officialApplicants = document.officialApplicants;
  // Represented Applicant legal names from projected Application rows (never swap for official 481).
  const observedApplicants = new Set(document.applications.map((a) => a.applicant)).size;

  const applicationsCard = appsAllowed
    ? buildComparisonCard({
        id: "applications",
        label: "Applications",
        value2012: APPROVED_2012_BASELINE.applications,
        value2026: officialApps,
        status: "DIRECTLY_COMPARABLE",
        limitation:
          "Official ICANN round Application totals. Not observed/represented Application rows.",
        source2012: APPROVED_2012_BASELINE.sourceLabel,
        source2026: "ICANN APS official Application aggregate",
        exploreHref: "/explore",
      })
    : null;

  const idnCard = idnAllowed
    ? buildComparisonCard({
        id: "idn-applications",
        label: "IDN Applications",
        value2012: APPROVED_2012_BASELINE.idnApplications,
        value2026: APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications,
        status: "DIRECTLY_COMPARABLE",
        limitation: "Official IDN Application aggregates both rounds.",
        source2012: APPROVED_2012_BASELINE.sourceLabel,
        source2026: APPROVED_2026_ORIENTATION_AGGREGATES.asOfLabel,
        exploreHref: "/explore?idn=idn",
      })
    : null;

  const confirmedComparisons = [applicationsCard, idnCard].filter(
    (c): c is StructuralComparisonCard => c != null,
  );

  const returningOrganizations: ReturningOrganizationCard[] =
    CONFIRMED_RETURNING_ORGANIZATION_FACTS.map((org) => ({
      organizationKey: org.organizationKey,
      displayName: org.displayName,
      applications2012: org.applications2012,
      applications2026: org.applications2026,
      delta: org.applications2026 - org.applications2012,
      profileHref: organizationProfileHref(org.organizationKey),
      wording: "Confirmed cross-round Organization relationship",
    }));

  const sample2012 = EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012;
  const sample2026 = EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026;

  const blockedComparisons: BlockedComparisonCard[] = CROSS_ROUND_COMPATIBILITY_MATRIX.filter(
    (row) => row.status === "BLOCKED",
  ).map((row) => ({
    dimensionId: row.dimensionId,
    label: row.label,
    reason: row.reason,
  }));

  return {
    title: "2012 vs 2026",
    subtitle: "Structural comparison across ICANN application rounds",
    summary: confirmedComparisons,
    confirmedComparisons,
    participationShape: {
      label: "2026 round context (not cross-round deltas)",
      facts: [
        {
          id: "brand-2026",
          label: "Brand Applications (2026)",
          value: APPROVED_2026_ORIENTATION_AGGREGATES.brandApplications,
          note: "2026-only — no accepted 2012 Brand equivalent",
        },
        {
          id: "community-2026",
          label: "Community Applications (2026)",
          value: APPROVED_2026_ORIENTATION_AGGREGATES.communityApplications,
          note: "Orientation context — Community cross-round delta blocked",
        },
        {
          id: "geographic-2026",
          label: "Self-identified Geographic (2026)",
          value: APPROVED_2026_ORIENTATION_AGGREGATES.geographicApplicationsSelfIdentified,
          note: "Self-identified — not equated with 2012 Geographic",
        },
        {
          id: "variants-2026",
          label: "Variant Applications (2026)",
          value: APPROVED_2026_ORIENTATION_AGGREGATES.variantApplications,
          note: "2026 orientation context",
        },
      ],
      note:
        "These figures describe the 2026 round. They are not presented as 2012→2026 change metrics.",
    },
    returningOrganizations: {
      label: "Confirmed returning Organizations",
      scopeWording:
        "Confirmed returning Organization sample — steward-confirmed Organization continuity only. Not all returning Organizations, returning-market share, or a whole-round denominator.",
      unmatchedIsNotNew:
        "Unmatched Applicants or Organizations are not labeled new or first-time participants.",
      organizations: returningOrganizations,
      sample: {
        applications2012: sample2012,
        applications2026: sample2026,
        delta: sample2026 - sample2012,
        label: "Confirmed returning Organization sample",
      },
    },
    blockedComparisons,
    coverage: {
      officialApplications2026: officialApps,
      representedApplications2026: observedApps,
      officialApplicants2026: officialApplicants,
      representedApplicants2026: observedApplicants,
      wdoDisclosure:
        "1614 represented normal Application rows of 1615 official Applications. One administrative-check Application (WDO) sits outside the normal list/export and is coverage metadata — not a silent denominator swap.",
    },
    sources: {
      source2012: APPROVED_2012_BASELINE.sourceLabel,
      source2026Applications: "ICANN APS official aggregates + Browser 2.x publication",
      source2026Orientation: APPROVED_2026_ORIENTATION_AGGREGATES.asOfLabel,
      returningMethod:
        "cross-round-organization-identity/1.0.0 + cross-round-participation-intelligence/1.0.0 (confirmed subset)",
      dataHealthHref: "/data-health",
      methodologyDocHref: "/data-health",
    },
    commandCenterHref: "/",
  };
}
