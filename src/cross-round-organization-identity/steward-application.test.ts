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
import { applyCrossRoundStewardApprovalsToSnapshot } from "./apply-steward-approvals";
import {
  confirmedSubsetCrossRoundIdentityReady,
  crossRoundPortfolioConcentrationEligible,
  expandedContractedProductEligible,
  returningNewProductEligible,
} from "./eligibility";
import { runCrossRoundOrganizationIdentityPass } from "./run-pass";
import { hashCrossRoundOrganizationIdentitySnapshot } from "./semantic-hash";
import {
  APPROVED_CROSS_ROUND_PAIRS,
  CROSS_ROUND_STEWARD_DECISION_ID,
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012,
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026,
  EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS,
  POST_STEWARD_CROSS_ROUND_SEMANTIC_HASH,
  PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH,
  crossRoundStewardDecisionProvenance,
} from "./steward-decision";
import {
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
} from "./constants";

const workspaceRoot = process.cwd();

describe("CROSS-ROUND-ID-1A steward approvals", () => {
  it("transitions exactly the two approved CONFIRM mappings CANDIDATE → CONFIRMED", async () => {
    const pre = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: false,
    });
    expect(pre.snapshot.semanticContentSha256).toBe(PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH);
    expect(pre.snapshot.quality.crossRoundConfirmed).toBe(0);
    expect(pre.snapshot.quality.crossRoundCandidate).toBe(2);

    const post = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
    });

    expect(post.snapshot.quality.crossRoundConfirmed).toBe(EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS);
    expect(post.snapshot.quality.crossRoundCandidate).toBe(0);
    expect(post.snapshot.quality.crossRoundAmbiguous).toBe(1);
    expect(post.snapshot.quality.crossRoundRejected).toBe(1);
    expect(post.snapshot.quality.unmatched2026Organizations).toBe(10);
    expect(post.snapshot.quality.applicationsRepresentedByConfirmedCrossRound2026).toBe(
      EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026,
    );
    expect(post.snapshot.quality.applicationsRepresentedByConfirmedCrossRound2012).toBe(
      EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012,
    );
    expect(post.snapshot.semanticContentSha256).not.toBe(PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH);
    expect(post.snapshot.semanticContentSha256).toBe(POST_STEWARD_CROSS_ROUND_SEMANTIC_HASH);
    expect(post.snapshot.stewardDecisionProvenance?.decisionId).toBe(CROSS_ROUND_STEWARD_DECISION_ID);
    expect(post.snapshot.stewardDecisionProvenance).toEqual(crossRoundStewardDecisionProvenance());

    for (const pair of APPROVED_CROSS_ROUND_PAIRS) {
      const mapping = post.snapshot.mappings.find(
        (m) =>
          m.organization2026Id === pair.organization2026Id &&
          m.organization2012Id === pair.organization2012Id,
      );
      expect(mapping?.reviewRecommendation).toBe("CONFIRM");
      expect(mapping?.state).toBe("CONFIRMED");
      expect(mapping?.relationshipType).toBe("SAME_ORGANIZATION");
      expect(mapping?.stewardDecision?.decision).toBe("APPROVE");
      expect(mapping?.stewardDecision?.priorState).toBe("CANDIDATE");
      expect(mapping?.stewardDecision?.decisionId).toBe(CROSS_ROUND_STEWARD_DECISION_ID);
      expect(mapping?.evidenceRefIds.length).toBeGreaterThan(0);
      expect(mapping?.temporalAssessment.continuityClaim.length).toBeGreaterThan(0);
    }
  });

  it("preserves REJECTED GoDaddy, AMBIGUOUS EchoStar, and 10 UNMATCHED; unmatched ≠ NEW", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot });
    const godaddy = snapshot.mappings.find((m) => m.organization2026Key === "godaddy-registry-services");
    expect(godaddy?.state).toBe("REJECTED");
    expect(godaddy?.relationshipType).toBe("ACQUIRED_AFTER_2012");
    const echo = snapshot.mappings.find((m) => m.organization2026Key === "echostar");
    expect(echo?.state).toBe("AMBIGUOUS");
    expect(echo?.relationshipType).toBe("SUCCESSOR_ENTITY_REVIEW_REQUIRED");
    expect(snapshot.mappings.filter((m) => m.state === "UNMATCHED")).toHaveLength(10);
    expect(snapshot.quality.newClassificationsFinalized).toBe(0);
    expect(snapshot.quality.returningClassificationsFinalized).toBe(0);
    expect(snapshot.quality.expandedClassificationsFinalized).toBe(0);
    expect(snapshot.quality.contractedClassificationsFinalized).toBe(0);
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
  });

  it("recommendation alone remains insufficient; wrong pin / missing pair fails closed", async () => {
    const pre = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      applyStewardApprovals: false,
    });
    expect(pre.snapshot.quality.crossRoundConfirmed).toBe(0);

    expect(() =>
      applyCrossRoundStewardApprovalsToSnapshot({
        snapshot: { ...pre.snapshot, semanticContentSha256: "0".repeat(64) },
      }),
    ).toThrow(/pre-state hash/);

    expect(() =>
      applyCrossRoundStewardApprovalsToSnapshot({
        snapshot: {
          ...pre.snapshot,
          pin2026Resolution: { ...pre.snapshot.pin2026Resolution, contentSha256: "0".repeat(64) },
        },
      }),
    ).toThrow(/2026 resolution pin/);
  });

  it("pins exact; source layers and Application publication unchanged", async () => {
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

    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot });
    expect(snapshot.pin2012.contentSha256).toBe(PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256);
    expect(snapshot.pin2026Resolution.contentSha256).toBe(PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256);
    expect(await readFile(pubPath, "utf8")).toBe(beforePub);
    expect(await readFile(contentionPath, "utf8")).toBe(beforeContention);
    expect(await readFile(promoPath, "utf8")).toBe(beforePromo);

    const publication = JSON.parse(beforePub) as Registry2026PublicationV2;
    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);
  });

  it("semantic hash is decision-sensitive and order-invariant; product gates stay blocked", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({ workspaceRoot });
    expect(confirmedSubsetCrossRoundIdentityReady(snapshot)).toBe(true);
    expect(returningNewProductEligible(snapshot)).toBe(false);
    expect(expandedContractedProductEligible(snapshot)).toBe(false);
    expect(crossRoundPortfolioConcentrationEligible(snapshot)).toBe(false);

    const returning = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "returning-participant-identity");
    expect(returning?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(returning?.claimReadiness.round2026).toBe("NOT_PUBLISHED");

    const orgMetric = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgMetric?.claimReadiness.round2026).toBe("NOT_PUBLISHED");

    const reordered = {
      schemaVersion: snapshot.schemaVersion,
      methodVersion: snapshot.methodVersion,
      registryVersion: snapshot.registryVersion,
      pin2012: snapshot.pin2012,
      pin2026Resolution: snapshot.pin2026Resolution,
      evidence: [...snapshot.evidence].reverse(),
      mappings: [...snapshot.mappings].reverse(),
      stewardDecisionProvenance: snapshot.stewardDecisionProvenance,
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
});
