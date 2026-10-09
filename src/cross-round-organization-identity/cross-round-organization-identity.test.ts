import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "@/normalization/hashes";
import {
  applicationGraphHashInput,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";
import { runFirstPassOrganizationResolution } from "@/organization-resolution-2026/run-first-pass";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "@/organization-resolution-2026/constants";
import { POST_STEWARD_SEMANTIC_HASH } from "@/organization-resolution-2026/steward-decision";
import { loadConfirmed2012ApplicantAliases } from "@/organization-resolution-2026/load-2012-confirmed-aliases";
import {
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
} from "./constants";
import { buildCrossRoundOrganizationIdentitySnapshot } from "./build-snapshot";
import { discoverCrossRoundCandidates } from "./discover-candidates";
import {
  crossRoundPortfolioConcentrationEligible,
  expandedContractedProductEligible,
  returningNewProductEligible,
  unmatchedDoesNotImplyNewDisclosure,
} from "./eligibility";
import { RESEARCH_PACKAGE_CROSS_ROUND_1 } from "./fixtures/research-package-cross-round-1";
import { loadConfirmed2012OrganizationUniverse } from "./load-2012-confirmed";
import { runCrossRoundOrganizationIdentityPass } from "./run-pass";
import { hashCrossRoundOrganizationIdentitySnapshot } from "./semantic-hash";
import type { CrossRoundResearchPackage } from "./types";

const workspaceRoot = process.cwd();

describe("CROSS-ROUND-ID-1 organization identity", () => {
  it("loads only CONFIRMED 2012 Organizations into the historical universe", async () => {
    const universe = await loadConfirmed2012OrganizationUniverse(workspaceRoot);
    expect(universe.pin.contentSha256).toBe(PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256);
    expect(universe.organizations).toHaveLength(16);
    expect(universe.pin.confirmedApplicationCount).toBe(466);
    expect(universe.excludedCandidateOrganizationKeys.length).toBe(2);
    expect(universe.excludedAmbiguousOrganizationKeys.length).toBe(1);
    expect(universe.offlinePromotedOrganizationCount).toBe(19);
    expect(universe.offlinePromotedApplicationCount).toBe(501);
    for (const org of universe.organizations) {
      expect(org.organizationId.startsWith("organization:promoted:")).toBe(true);
      expect(org.reviewState).toBe("steward-approved");
    }
  });

  it("only CONFIRMED 2026 Organizations enter the cross-round universe; pins required", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: false,
    });
    expect(snapshot.quality.examined2026ConfirmedOrganizations).toBe(14);
    expect(snapshot.pin2026Resolution.contentSha256).toBe(PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256);
    expect(snapshot.pin2026Resolution.contentSha256).toBe(POST_STEWARD_SEMANTIC_HASH);
    expect(snapshot.pin2026Resolution.applicationGraphContentSha256).toBe(
      PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256,
    );
    expect(snapshot.pin2026Resolution.confirmedApplicationCount).toBe(669);
    expect(snapshot.mappings).toHaveLength(14);
  });

  it("exact alias / key lineage creates candidates, not confirmation", async () => {
    const universe = await loadConfirmed2012OrganizationUniverse(workspaceRoot);
    const { snapshot: snap2026 } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
    });
    const aliases = await loadConfirmed2012ApplicantAliases(workspaceRoot);
    const discovery = discoverCrossRoundCandidates({
      confirmed2026: snap2026.organizations.filter((o) => o.status === "CONFIRMED"),
      confirmed2012: universe.organizations,
      confirmed2012ApplicantAliases: aliases,
    });
    expect(discovery.some((d) => d.organization2012Key === "microsoft")).toBe(true);
    expect(discovery.some((d) => d.organization2012Key === "google-charleston-road")).toBe(true);
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    const msft = snapshot.mappings.find((m) => m.organization2026Key === "hist-2012-microsoft");
    expect(msft?.reviewRecommendation).toBe("CONFIRM");
    expect(msft?.state).toBe("CANDIDATE");
    expect(msft?.stewardDecision).toBeNull();
    expect(snapshot.quality.crossRoundConfirmed).toBe(0);
  });

  it("name similarity alone cannot confirm; acquisition-after-2012 is not SAME", async () => {
    const universe = await loadConfirmed2012OrganizationUniverse(workspaceRoot);
    const { snapshot: snap2026 } = await runFirstPassOrganizationResolution({ workspaceRoot });
    const bad: CrossRoundResearchPackage = {
      ...RESEARCH_PACKAGE_CROSS_ROUND_1,
      dossiers: RESEARCH_PACKAGE_CROSS_ROUND_1.dossiers.map((d) =>
        d.organization2026Key === "hist-2012-microsoft"
          ? {
              ...d,
              evidence: [
                {
                  evidenceId: "xri-ev-name-only",
                  strength: "D",
                  sourceType: "steward-note",
                  sourceIdentifier: "name-similarity",
                  evidenceAsOf: "2026-10-09",
                  retrievedAt: "2026-10-09",
                  summary: "Names look alike",
                  supportsClaim: "string similarity only",
                  temporalRelevance: "n/a",
                  limitations: "D only",
                },
              ],
            }
          : d,
      ),
    };
    expect(() =>
      buildCrossRoundOrganizationIdentitySnapshot({
        universe2012: universe,
        snapshot2026: snap2026,
        research: bad,
      }),
    ).toThrow(/A\/B evidence|D-only/);

    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    const godaddy = snapshot.mappings.find((m) => m.organization2026Key === "godaddy-registry-services");
    expect(godaddy?.relationshipType).toBe("ACQUIRED_AFTER_2012");
    expect(godaddy?.reviewRecommendation).toBe("REJECT");
    expect(godaddy?.state).toBe("REJECTED");
    expect(godaddy?.temporalAssessment.acquisitionAfter2012).toBe(true);
  });

  it("rename continuity may be represented; related entities can be REJECTED; multi-plausible → AMBIGUOUS", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    expect(snapshot.mappings.some((m) => m.relationshipType === "RENAMED_ENTITY")).toBe(false);
    expect(
      snapshot.mappings.some(
        (m) =>
          m.relationshipType === "ACQUIRED_AFTER_2012" && m.reviewRecommendation === "REJECT",
      ),
    ).toBe(true);
    const echo = snapshot.mappings.find((m) => m.organization2026Key === "echostar");
    expect(echo?.reviewRecommendation).toBe("AMBIGUOUS");
    expect(echo?.state).toBe("AMBIGUOUS");
    expect(echo?.relationshipType).toBe("SUCCESSOR_ENTITY_REVIEW_REQUIRED");
  });

  it("no candidate does not imply NEW; recommendation ≠ steward approval; returning/new blocked", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    expect(snapshot.quality.noPlausibleConfirmed2012Match).toBe(10);
    expect(snapshot.quality.newClassificationsFinalized).toBe(0);
    expect(snapshot.quality.returningClassificationsFinalized).toBe(0);
    expect(snapshot.quality.expandedClassificationsFinalized).toBe(0);
    expect(snapshot.quality.contractedClassificationsFinalized).toBe(0);
    expect(snapshot.limitations.some((l) => l.includes(unmatchedDoesNotImplyNewDisclosure().slice(0, 40)))).toBe(
      true,
    );
    expect(snapshot.mappings.every((m) => m.stewardDecision === null)).toBe(true);
    expect(snapshot.quality.crossRoundConfirmed).toBe(0);
    expect(returningNewProductEligible(snapshot)).toBe(false);
    expect(expandedContractedProductEligible(snapshot)).toBe(false);
    expect(crossRoundPortfolioConcentrationEligible(snapshot)).toBe(false);

    const returning = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "returning-participant-identity");
    expect(returning?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(returning?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
  });

  it("candidate identity does not alter 2012 or 2026 source layers; Organization IDs are canonical keys", async () => {
    const pubPath = join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
    const contentionPath = join(
      workspaceRoot,
      ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
    );
    const promoPath = join(
      workspaceRoot,
      "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json",
    );
    const beforePub = await readFile(pubPath, "utf8");
    const beforeContention = await readFile(contentionPath, "utf8");
    const beforePromo = await readFile(promoPath, "utf8");

    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    expect(await readFile(pubPath, "utf8")).toBe(beforePub);
    expect(await readFile(contentionPath, "utf8")).toBe(beforeContention);
    expect(await readFile(promoPath, "utf8")).toBe(beforePromo);

    for (const m of snapshot.mappings) {
      expect(m.organization2026Id.startsWith("organization:resolved-2026:")).toBe(true);
      if (m.organization2012Id) {
        expect(m.organization2012Id.startsWith("organization:promoted:")).toBe(true);
      }
      expect(m.crossRoundIdentityId.includes(m.organization2026CanonicalName)).toBe(false);
    }
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
  });

  it("wrong pins fail closed; Application/contention actuality unchanged", async () => {
    const universe = await loadConfirmed2012OrganizationUniverse(workspaceRoot);
    const { snapshot: snap2026 } = await runFirstPassOrganizationResolution({ workspaceRoot });
    expect(() =>
      buildCrossRoundOrganizationIdentitySnapshot({
        universe2012: universe,
        snapshot2026: {
          ...snap2026,
          semanticContentSha256: "0".repeat(64),
        },
        research: RESEARCH_PACKAGE_CROSS_ROUND_1,
      }),
    ).toThrow(/2026 Organization-resolution pin mismatch/);

    const publication = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"), "utf8"),
    ) as Registry2026PublicationV2;
    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);

    const contention = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"), "utf8"),
    ) as ContentionMembershipSnapshotV1;
    expect(contention.schemaVersion).toBeTruthy();
  });

  it("deterministic and order-invariant semantic hash; identity change alters hash", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    const again = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    expect(again.snapshot.semanticContentSha256).toBe(snapshot.semanticContentSha256);

    const reordered = {
      schemaVersion: snapshot.schemaVersion,
      methodVersion: snapshot.methodVersion,
      registryVersion: snapshot.registryVersion,
      pin2012: snapshot.pin2012,
      pin2026Resolution: snapshot.pin2026Resolution,
      evidence: [...snapshot.evidence].reverse(),
      mappings: [...snapshot.mappings].reverse(),
      quality: snapshot.quality,
      limitations: [...snapshot.limitations].reverse(),
    };
    expect(hashCrossRoundOrganizationIdentitySnapshot(reordered)).toBe(snapshot.semanticContentSha256);

    const mutated = {
      ...reordered,
      mappings: reordered.mappings.map((m, i) =>
        i === 0 ? { ...m, notes: `${m.notes} | mutated` } : m,
      ),
    };
    expect(hashCrossRoundOrganizationIdentitySnapshot(mutated)).not.toBe(snapshot.semanticContentSha256);
  });

  it("quality summary and research results match expected research package", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot, applyStewardApprovals: false });
    expect(snapshot.quality.recommendConfirm).toBe(2);
    expect(snapshot.quality.recommendReject).toBe(1);
    expect(snapshot.quality.recommendAmbiguous).toBe(1);
    expect(snapshot.quality.noPlausibleConfirmed2012Match).toBe(10);
    expect(snapshot.quality.crossRoundCandidate).toBe(2);
    expect(snapshot.quality.crossRoundRejected).toBe(1);
    expect(snapshot.quality.crossRoundAmbiguous).toBe(1);
    expect(snapshot.quality.unmatched2026Organizations).toBe(10);
    // Microsoft 2 + Charleston Road 39
    expect(snapshot.quality.applicationsInRecommendConfirmMappings).toBe(41);
  });

  it("Command Center round-wide org metrics remain blocked", () => {
    const orgMetric = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgMetric?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(orgMetric?.methodReadiness).toBe("BLOCKED_SOURCE");
  });
});
