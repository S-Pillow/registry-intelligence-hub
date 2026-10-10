import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "@/normalization/hashes";
import {
  applicationGraphHashInput,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "@/organization-resolution-2026/constants";
import { runCrossRoundOrganizationIdentityPass } from "@/cross-round-organization-identity/run-pass";
import { POST_STEWARD_CROSS_ROUND_SEMANTIC_HASH } from "@/cross-round-organization-identity/steward-decision";
import { buildParticipationIntelligenceSnapshot } from "./build-snapshot";
import {
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
  PINNED_CROSS_ROUND_IDENTITY_SEMANTIC_SHA256,
} from "./constants";
import {
  completeReturningMetricEligible,
  confirmedReturningSubsetReady,
  NEW_ORGANIZATION_BLOCKED_REASON,
  newOrganizationMetricEligible,
} from "./eligibility";
import { runParticipationIntelligencePass } from "./run-pass";
import { hashParticipationIntelligenceSnapshot } from "./semantic-hash";

const workspaceRoot = process.cwd();

describe("RETURNING-NEW-1 confirmed-subset participation intelligence", () => {
  it("only CONFIRMED cross-round mappings contribute; Microsoft and Google are RETURNING/CONTRACTED", async () => {
    const { snapshot } = await runParticipationIntelligencePass({ workspaceRoot });
    expect(snapshot.sourceCrossRoundIdentityHash).toBe(PINNED_CROSS_ROUND_IDENTITY_SEMANTIC_SHA256);
    expect(snapshot.sourceCrossRoundIdentityHash).toBe(POST_STEWARD_CROSS_ROUND_SEMANTIC_HASH);
    expect(snapshot.summary.confirmedReturningOrganizations).toBe(2);
    expect(snapshot.organizationComparisons).toHaveLength(2);
    expect(snapshot.organizationComparisons.every((c) => c.participationStatus === "RETURNING")).toBe(
      true,
    );

    const msft = snapshot.organizationComparisons.find((c) =>
      c.organization2026Id.includes("microsoft"),
    );
    expect(msft?.applications2012).toBe(11);
    expect(msft?.applications2026).toBe(2);
    expect(msft?.applicationDelta).toBe(-9);
    expect(msft?.portfolioChange).toBe("CONTRACTED");

    const google = snapshot.organizationComparisons.find((c) =>
      c.organization2026Id.includes("google-charleston-road"),
    );
    expect(google?.applications2012).toBe(101);
    expect(google?.applications2026).toBe(39);
    expect(google?.applicationDelta).toBe(-62);
    expect(google?.portfolioChange).toBe("CONTRACTED");

    expect(snapshot.summary.expandedConfirmed).toBe(0);
    expect(snapshot.summary.contractedConfirmed).toBe(2);
    expect(snapshot.summary.unchangedConfirmed).toBe(0);
    expect(snapshot.summary.combinedConfirmedSubsetApplicationDelta).toBe(-71);
    expect(snapshot.summary.representedApplications2012).toBe(112);
    expect(snapshot.summary.representedApplications2026).toBe(41);
  });

  it("excludes GoDaddy/Uniregistry, EchoStar/Dish, and unmatched; unmatched ≠ NEW", async () => {
    const { snapshot } = await runParticipationIntelligencePass({ workspaceRoot });
    const godaddy = snapshot.excludedCases.find((e) => e.organization2026Id.includes("godaddy"));
    expect(godaddy?.crossRoundState).toBe("REJECTED");
    expect(godaddy?.relationshipType).toBe("ACQUIRED_AFTER_2012");

    const echo = snapshot.excludedCases.find((e) => e.organization2026Id.includes("echostar"));
    expect(echo?.crossRoundState).toBe("AMBIGUOUS");

    const unmatched = snapshot.excludedCases.filter((e) => e.crossRoundState === "UNMATCHED");
    expect(unmatched).toHaveLength(10);
    expect(unmatched.every((e) => e.label === "No confirmed 2012 Organization match")).toBe(true);
    expect(unmatched.every((e) => !e.label.toLowerCase().includes("new in"))).toBe(true);

    expect(snapshot.summary.newOrganizationMetric.status).toBe("BLOCKED_SOURCE");
    expect(snapshot.summary.newOrganizationMetric.numericCount).toBeNull();
    expect(snapshot.summary.newOrganizationMetric.reason).toBe(NEW_ORGANIZATION_BLOCKED_REASON);
    expect(newOrganizationMetricEligible(snapshot)).toBe(false);
  });

  it("eligibility: confirmed-subset ready with limitation; complete returning/new blocked", async () => {
    const { snapshot } = await runParticipationIntelligencePass({ workspaceRoot });
    expect(confirmedReturningSubsetReady(snapshot)).toBe(true);
    expect(completeReturningMetricEligible(snapshot)).toBe(false);
    expect(snapshot.eligibilityNotes.confirmedReturning).toBe("CONFIRMED_SUBSET_READY_WITH_LIMITATION");
    expect(snapshot.eligibilityNotes.completeReturning).toBe("BLOCKED_SOURCE");
    expect(snapshot.eligibilityNotes.completeNew).toBe("BLOCKED_SOURCE");

    const confirmedReturning = METRIC_ELIGIBILITY_CATALOG.find(
      (m) => m.metricId === "confirmed-returning-organizations",
    );
    expect(confirmedReturning?.methodReadiness).toBe("PARTIAL");
    expect(confirmedReturning?.crossRoundStatus).toBe("READY_WITH_LIMITATION");

    const completeReturning = METRIC_ELIGIBILITY_CATALOG.find(
      (m) => m.metricId === "returning-participant-identity",
    );
    expect(completeReturning?.methodReadiness).toBe("BLOCKED_SOURCE");

    const newOrgs = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "new-organizations");
    expect(newOrgs?.methodReadiness).toBe("BLOCKED_SOURCE");

    const orgRound = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgRound?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
  });

  it("wrong cross-round / org pins fail closed; source layers unchanged", async () => {
    const { snapshot: crossRound } = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      applyStewardApprovals: true,
    });
    expect(() =>
      buildParticipationIntelligenceSnapshot({
        crossRoundSnapshot: { ...crossRound, semanticContentSha256: "0".repeat(64) },
      }),
    ).toThrow(/cross-round hash/);

    expect(() =>
      buildParticipationIntelligenceSnapshot({
        crossRoundSnapshot: {
          ...crossRound,
          pin2012: { ...crossRound.pin2012, contentSha256: "0".repeat(64) },
        },
      }),
    ).toThrow(/2012 Organization pin/);

    expect(() =>
      buildParticipationIntelligenceSnapshot({
        crossRoundSnapshot: {
          ...crossRound,
          pin2026Resolution: { ...crossRound.pin2026Resolution, contentSha256: "0".repeat(64) },
        },
      }),
    ).toThrow(/2026 Organization-resolution pin/);

    const pubPath = join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
    const promoPath = join(
      workspaceRoot,
      "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json",
    );
    const beforePub = await readFile(pubPath, "utf8");
    const beforePromo = await readFile(promoPath, "utf8");
    const beforeCrossHash = crossRound.semanticContentSha256;

    await runParticipationIntelligencePass({ workspaceRoot });
    expect(await readFile(pubPath, "utf8")).toBe(beforePub);
    expect(await readFile(promoPath, "utf8")).toBe(beforePromo);
    const again = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      applyStewardApprovals: true,
    });
    expect(again.snapshot.semanticContentSha256).toBe(beforeCrossHash);

    const publication = JSON.parse(beforePub) as Registry2026PublicationV2;
    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);
    expect(crossRound.pin2012.contentSha256).toBe(PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256);
    expect(crossRound.pin2026Resolution.contentSha256).toBe(PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256);
  });

  it("deterministic and order-invariant semantic hash; count/status changes alter hash", async () => {
    const { snapshot } = await runParticipationIntelligencePass({ workspaceRoot });
    const again = await runParticipationIntelligencePass({ workspaceRoot });
    expect(again.snapshot.semanticContentSha256).toBe(snapshot.semanticContentSha256);

    const reordered = {
      schemaVersion: snapshot.schemaVersion,
      methodVersion: snapshot.methodVersion,
      sourceCrossRoundIdentityHash: snapshot.sourceCrossRoundIdentityHash,
      source2012OrganizationPin: snapshot.source2012OrganizationPin,
      source2026OrganizationPin: snapshot.source2026OrganizationPin,
      source2026ApplicationGraphPin: snapshot.source2026ApplicationGraphPin,
      generatedFromConfirmedSubset: snapshot.generatedFromConfirmedSubset,
      organizationComparisons: [...snapshot.organizationComparisons].reverse(),
      excludedCases: [...snapshot.excludedCases].reverse(),
      summary: snapshot.summary,
      coverage: snapshot.coverage,
      limitations: [...snapshot.limitations].reverse(),
      eligibilityNotes: snapshot.eligibilityNotes,
    };
    expect(hashParticipationIntelligenceSnapshot(reordered)).toBe(snapshot.semanticContentSha256);

    const mutatedCounts = {
      ...reordered,
      organizationComparisons: reordered.organizationComparisons.map((c, i) =>
        i === 0 ? { ...c, applications2026: c.applications2026 + 1, applicationDelta: c.applicationDelta + 1 } : c,
      ),
    };
    expect(hashParticipationIntelligenceSnapshot(mutatedCounts)).not.toBe(snapshot.semanticContentSha256);

    const mutatedStatus = {
      ...reordered,
      summary: {
        ...reordered.summary,
        confirmedReturningOrganizations: reordered.summary.confirmedReturningOrganizations + 1,
      },
    };
    expect(hashParticipationIntelligenceSnapshot(mutatedStatus)).not.toBe(snapshot.semanticContentSha256);

    const mutatedEligibility = {
      ...reordered,
      eligibilityNotes: {
        ...snapshot.eligibilityNotes,
        confirmedReturning: "BLOCKED_SOURCE",
      },
    };
    expect(
      hashParticipationIntelligenceSnapshot(
        mutatedEligibility as unknown as Omit<
          typeof snapshot,
          "semanticContentSha256" | "generatedAt"
        >,
      ),
    ).not.toBe(snapshot.semanticContentSha256);
  });

  it("candidate/ambiguous/rejected mappings do not contribute; no category inference", async () => {
    const { snapshot } = await runParticipationIntelligencePass({ workspaceRoot });
    expect(snapshot.organizationComparisons.every((c) => c.evidenceState === "steward-confirmed-cross-round-identity")).toBe(
      true,
    );
    expect(snapshot.limitations.some((l) => l.toLowerCase().includes("category"))).toBe(true);
    expect(snapshot.coverage.coverageKind).toBe("confirmed-subset-identity-resolution");
  });
});
