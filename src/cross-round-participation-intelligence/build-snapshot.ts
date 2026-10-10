import type { CrossRoundOrganizationIdentitySnapshot } from "@/cross-round-organization-identity/types";
import {
  EXPECTED_2012_CONFIRMED_APPLICATIONS,
  EXPECTED_2012_CONFIRMED_ORGANIZATIONS,
  EXPECTED_2026_CONFIRMED_APPLICATIONS,
  EXPECTED_2026_CONFIRMED_ORGANIZATIONS,
  PARTICIPATION_INTELLIGENCE_METHOD_VERSION,
  PARTICIPATION_INTELLIGENCE_SCHEMA_VERSION,
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
  PINNED_CROSS_ROUND_IDENTITY_SEMANTIC_SHA256,
} from "./constants";
import { NEW_ORGANIZATION_BLOCKED_REASON } from "./eligibility";
import {
  applicationDelta,
  applicationPercentDelta,
  classifyPortfolioChange,
  portfolioChangeDisclosureSentence,
} from "./portfolio-change";
import { hashParticipationIntelligenceSnapshot } from "./semantic-hash";
import type {
  CrossRoundParticipationIntelligenceSnapshot,
  ExcludedCrossRoundCase,
  OrganizationParticipationComparison,
} from "./types";

const CONTINUITY_RELATIONSHIPS = new Set([
  "SAME_ORGANIZATION",
  "RENAMED_ENTITY",
  "CONTINUOUS_PARENT_IDENTITY",
]);

/**
 * Derive confirmed-subset returning + portfolio-change intelligence from steward-confirmed
 * cross-round identities only. Never infers NEW from unmatched.
 */
export function buildParticipationIntelligenceSnapshot(input: {
  crossRoundSnapshot: CrossRoundOrganizationIdentitySnapshot;
  generatedAt?: string;
}): CrossRoundParticipationIntelligenceSnapshot {
  const src = input.crossRoundSnapshot;

  if (src.semanticContentSha256 !== PINNED_CROSS_ROUND_IDENTITY_SEMANTIC_SHA256) {
    throw new Error(
      `Participation intelligence fail-closed: expected cross-round hash ${PINNED_CROSS_ROUND_IDENTITY_SEMANTIC_SHA256}, got ${src.semanticContentSha256}`,
    );
  }
  if (src.pin2012.contentSha256 !== PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256) {
    throw new Error("Participation intelligence fail-closed: 2012 Organization pin mismatch");
  }
  if (src.pin2026Resolution.contentSha256 !== PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256) {
    throw new Error("Participation intelligence fail-closed: 2026 Organization-resolution pin mismatch");
  }
  if (
    src.pin2026Resolution.applicationGraphContentSha256 !== PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error("Participation intelligence fail-closed: Application graph pin mismatch");
  }

  if (src.pin2012.confirmedOrganizationCount !== EXPECTED_2012_CONFIRMED_ORGANIZATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2012_CONFIRMED_ORGANIZATIONS} confirmed 2012 Organizations, got ${src.pin2012.confirmedOrganizationCount}`,
    );
  }
  if (src.pin2012.confirmedApplicationCount !== EXPECTED_2012_CONFIRMED_APPLICATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2012_CONFIRMED_APPLICATIONS} confirmed 2012 Applications, got ${src.pin2012.confirmedApplicationCount}`,
    );
  }
  if (src.pin2026Resolution.confirmedOrganizationCount !== EXPECTED_2026_CONFIRMED_ORGANIZATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2026_CONFIRMED_ORGANIZATIONS} confirmed 2026 Organizations, got ${src.pin2026Resolution.confirmedOrganizationCount}`,
    );
  }
  if (src.pin2026Resolution.confirmedApplicationCount !== EXPECTED_2026_CONFIRMED_APPLICATIONS) {
    throw new Error(
      `Expected ${EXPECTED_2026_CONFIRMED_APPLICATIONS} confirmed 2026 Applications, got ${src.pin2026Resolution.confirmedApplicationCount}`,
    );
  }

  const confirmedMappings = src.mappings.filter((m) => m.state === "CONFIRMED");
  if (confirmedMappings.length !== 2) {
    throw new Error(`Expected exactly 2 CONFIRMED cross-round mappings, got ${confirmedMappings.length}`);
  }

  const organizationComparisons: OrganizationParticipationComparison[] = [];

  for (const m of confirmedMappings) {
    if (!m.organization2012Id || !m.stewardDecision) {
      throw new Error(`CONFIRMED mapping ${m.crossRoundIdentityId} missing 2012 id or steward decision`);
    }
    if (!CONTINUITY_RELATIONSHIPS.has(m.relationshipType)) {
      throw new Error(
        `CONFIRMED mapping ${m.crossRoundIdentityId} relationship ${m.relationshipType} does not support returning continuity`,
      );
    }
    if (m.evidenceRefIds.length === 0) {
      throw new Error(`CONFIRMED mapping ${m.crossRoundIdentityId} requires evidence refs`);
    }

    const apps2012 = m.organization2012ApplicationCount;
    const apps2026 = m.organization2026ApplicationCount;
    const delta = applicationDelta(apps2012, apps2026);
    const pct = applicationPercentDelta(apps2012, apps2026);
    const portfolioChange = classifyPortfolioChange(apps2012, apps2026);
    const displayName = m.organization2026CanonicalName;

    organizationComparisons.push({
      crossRoundIdentityId: m.crossRoundIdentityId,
      organization2012Id: m.organization2012Id,
      organization2026Id: m.organization2026Id,
      canonicalDisplayName: displayName,
      participationStatus: "RETURNING",
      relationshipType: m.relationshipType,
      applications2012: apps2012,
      applications2026: apps2026,
      applicationDelta: delta,
      applicationPercentDelta: pct,
      portfolioChange,
      evidenceState: "steward-confirmed-cross-round-identity",
      disclosureKeys: [
        "confirmed-subset-returning",
        "application-portfolio-change-not-business-performance",
        "not-complete-round-returning-count",
      ],
    });

    // Guard wording helpers exist for review artifacts
    void portfolioChangeDisclosureSentence(displayName, apps2012, apps2026);
  }

  organizationComparisons.sort((a, b) => a.crossRoundIdentityId.localeCompare(b.crossRoundIdentityId));

  const excludedCases: ExcludedCrossRoundCase[] = src.mappings
    .filter((m) => m.state !== "CONFIRMED")
    .map((m) => {
      if (m.state === "REJECTED") {
        return {
          organization2026Id: m.organization2026Id,
          organization2026CanonicalName: m.organization2026CanonicalName,
          organization2012Id: m.organization2012Id,
          organization2012CanonicalName: m.organization2012CanonicalName,
          crossRoundState: "REJECTED" as const,
          relationshipType: m.relationshipType,
          exclusionReason:
            "Rejected continuity (e.g. ACQUIRED_AFTER_2012) — not the same analytical participant; excluded from returning/portfolio-change.",
          label: "Rejected continuity — not returning",
        };
      }
      if (m.state === "AMBIGUOUS") {
        return {
          organization2026Id: m.organization2026Id,
          organization2026CanonicalName: m.organization2026CanonicalName,
          organization2012Id: m.organization2012Id,
          organization2012CanonicalName: m.organization2012CanonicalName,
          crossRoundState: "AMBIGUOUS" as const,
          relationshipType: m.relationshipType,
          exclusionReason:
            "Ambiguous successor/reorganization path — excluded from returning/new/expanded/contracted until resolved.",
          label: "Ambiguous — historical status unresolved",
        };
      }
      return {
        organization2026Id: m.organization2026Id,
        organization2026CanonicalName: m.organization2026CanonicalName,
        organization2012Id: null,
        organization2012CanonicalName: null,
        crossRoundState: "UNMATCHED" as const,
        relationshipType: m.relationshipType,
        exclusionReason: NEW_ORGANIZATION_BLOCKED_REASON,
        label: "No confirmed 2012 Organization match",
      };
    })
    .sort((a, b) => a.organization2026Id.localeCompare(b.organization2026Id));

  // Safety: never invent NEW counts from exclusions
  if (excludedCases.some((e) => e.label.toLowerCase().includes("new in 2026"))) {
    throw new Error("Excluded cases must not be labeled as new");
  }

  const represented2012 = organizationComparisons.reduce((s, c) => s + c.applications2012, 0);
  const represented2026 = organizationComparisons.reduce((s, c) => s + c.applications2026, 0);
  const expandedConfirmed = organizationComparisons.filter((c) => c.portfolioChange === "EXPANDED").length;
  const contractedConfirmed = organizationComparisons.filter((c) => c.portfolioChange === "CONTRACTED").length;
  const unchangedConfirmed = organizationComparisons.filter((c) => c.portfolioChange === "UNCHANGED").length;
  const combinedDelta = organizationComparisons.reduce((s, c) => s + c.applicationDelta, 0);

  const coverage = {
    confirmed2012Organizations: EXPECTED_2012_CONFIRMED_ORGANIZATIONS,
    confirmed2012Applications: EXPECTED_2012_CONFIRMED_APPLICATIONS,
    confirmed2026Organizations: EXPECTED_2026_CONFIRMED_ORGANIZATIONS,
    confirmed2026Applications: EXPECTED_2026_CONFIRMED_APPLICATIONS,
    confirmedCrossRoundIdentities: organizationComparisons.length,
    representedApplications2012: represented2012,
    representedApplications2026: represented2026,
    crossRoundIdentityCoverageOf2026ConfirmedOrganizations:
      organizationComparisons.length / EXPECTED_2026_CONFIRMED_ORGANIZATIONS,
    crossRoundIdentityCoverageOf2026ConfirmedApplications:
      represented2026 / EXPECTED_2026_CONFIRMED_APPLICATIONS,
    crossRoundIdentityCoverageOf2012ConfirmedOrganizations:
      organizationComparisons.length / EXPECTED_2012_CONFIRMED_ORGANIZATIONS,
    crossRoundIdentityCoverageOf2012ConfirmedApplications:
      represented2012 / EXPECTED_2012_CONFIRMED_APPLICATIONS,
    coverageKind: "confirmed-subset-identity-resolution" as const,
  };

  const draft: Omit<CrossRoundParticipationIntelligenceSnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: PARTICIPATION_INTELLIGENCE_SCHEMA_VERSION,
    methodVersion: PARTICIPATION_INTELLIGENCE_METHOD_VERSION,
    sourceCrossRoundIdentityHash: src.semanticContentSha256,
    source2012OrganizationPin: src.pin2012.contentSha256,
    source2026OrganizationPin: src.pin2026Resolution.contentSha256,
    source2026ApplicationGraphPin: src.pin2026Resolution.applicationGraphContentSha256,
    generatedFromConfirmedSubset: true,
    organizationComparisons,
    excludedCases,
    summary: {
      confirmedReturningOrganizations: organizationComparisons.length,
      returningApplications2026: represented2026,
      representedApplications2012: represented2012,
      representedApplications2026: represented2026,
      expandedConfirmed,
      contractedConfirmed,
      unchangedConfirmed,
      combinedConfirmedSubsetApplicationDelta: combinedDelta,
      newOrganizationMetric: {
        status: "BLOCKED_SOURCE",
        numericCount: null,
        reason: NEW_ORGANIZATION_BLOCKED_REASON,
      },
      generatedFromConfirmedSubset: true,
    },
    coverage,
    limitations: [
      NEW_ORGANIZATION_BLOCKED_REASON,
      "Confirmed returning count is steward-confirmed continuity only — not a complete round-wide returning Organization count.",
      "UNMATCHED, AMBIGUOUS, and REJECTED mappings do not contribute to returning or portfolio-change metrics.",
      "Application-count portfolio change describes Application portfolios, not company performance or strategy.",
      "Combined confirmed-subset Application delta is not a round-wide change.",
      "Both 2012 and 2026 Organization-resolution universes remain partial confirmed subsets.",
      "GoDaddy/Uniregistry ACQUIRED_AFTER_2012 is excluded from returning/portfolio-change.",
      "EchoStar/Dish SUCCESSOR_ENTITY_REVIEW_REQUIRED remains ambiguous and excluded.",
      "Category/sector inference is out of scope.",
    ],
    eligibilityNotes: {
      confirmedReturning: "CONFIRMED_SUBSET_READY_WITH_LIMITATION",
      confirmedExpanded: "CONFIRMED_SUBSET_READY_WITH_LIMITATION",
      confirmedContracted: "CONFIRMED_SUBSET_READY_WITH_LIMITATION",
      confirmedUnchanged: "CONFIRMED_SUBSET_READY_WITH_LIMITATION",
      completeReturning: "BLOCKED_SOURCE",
      completeNew: "BLOCKED_SOURCE",
      completeExpandedContracted: "BLOCKED_SOURCE",
    },
  };

  return {
    ...draft,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    semanticContentSha256: hashParticipationIntelligenceSnapshot(draft),
  };
}
