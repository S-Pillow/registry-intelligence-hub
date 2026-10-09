import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "@/normalization/hashes";
import {
  applicationGraphHashInput,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "./constants";
import { runFirstPassOrganizationResolution } from "./run-first-pass";
import { applyStewardApprovalsToSnapshot } from "./apply-steward-approvals";
import {
  APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES,
  EXPECTED_CONFIRMED_APPLICATIONS,
  EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  EXPECTED_CONFIRMED_ORGANIZATIONS,
  POST_STEWARD_SEMANTIC_HASH,
  PRE_STEWARD_SEMANTIC_HASH,
  STEWARD_DECISION_ID,
  stewardDecisionProvenance,
} from "./steward-decision";
import { organizationMetricsProductEligible } from "./eligibility";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";

const workspaceRoot = process.cwd();

describe("ORG-RES-2026-2A steward approvals", () => {
  it("transitions exactly the 14 approved CONFIRM dossiers CANDIDATE → CONFIRMED", async () => {
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: false,
    });
    expect(pre.snapshot.semanticContentSha256).toBe(PRE_STEWARD_SEMANTIC_HASH);
    expect(pre.snapshot.quality.confirmedOrganizationCount).toBe(0);

    const post = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
    });

    expect(post.snapshot.quality.confirmedOrganizationCount).toBe(EXPECTED_CONFIRMED_ORGANIZATIONS);
    expect(post.snapshot.quality.confirmedOrganizationMappings).toBe(14);
    expect(post.snapshot.quality.applicationsCoveredByConfirmedOrganizations).toBe(
      EXPECTED_CONFIRMED_APPLICATIONS,
    );
    expect(post.snapshot.quality.confirmedContentionMemberships).toBe(
      EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
    );
    expect(post.snapshot.quality.officialContentionMemberships).toBe(891);
    expect(post.snapshot.semanticContentSha256).not.toBe(PRE_STEWARD_SEMANTIC_HASH);
    expect(post.snapshot.semanticContentSha256).toBe(POST_STEWARD_SEMANTIC_HASH);
    expect(post.snapshot.stewardDecisionProvenance?.decisionId).toBe(STEWARD_DECISION_ID);
    expect(post.snapshot.stewardDecisionProvenance?.authority).toBe("operator-product-steward");

    for (const name of APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES) {
      const dossier = post.snapshot.stewardReviewDossiers?.find((d) => d.applicantLegalName === name);
      expect(dossier?.reviewRecommendation).toBe("CONFIRM");
      expect(dossier?.resolutionState).toBe("CONFIRMED");
      expect(dossier?.stewardDecision).toBe("APPROVE");
      expect(dossier?.priorResolutionState).toBe("CANDIDATE");
      expect(dossier?.stewardDecisionId).toBe(STEWARD_DECISION_ID);
      expect(dossier?.evidenceIds.length).toBeGreaterThan(0);
      const mapping = post.snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === name);
      expect(mapping?.resolutionState).toBe("CONFIRMED");
      expect(mapping?.organizationId).toBe(dossier?.candidateOrganizationId);
    }
  });

  it("preserves KEEP_CANDIDATE, AMBIGUOUS, and unresolved / no-evidence", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
    });
    expect(snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Oinkadot Inc")?.resolutionState).toBe(
      "CANDIDATE",
    );
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "XRegistry Incorporated")
        ?.resolutionState,
    ).toBe("CANDIDATE");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "101130013 Saskatchewan Ltd.")
        ?.resolutionState,
    ).toBe("CANDIDATE");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Toddler Logic, LLC")?.resolutionState,
    ).toBe("AMBIGUOUS");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Pirin Tablet, LLC")?.resolutionState,
    ).toBe("AMBIGUOUS");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Hair Apparent, LLC")?.resolutionState,
    ).toBe("AMBIGUOUS");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Suffix Inc.")?.resolutionState,
    ).toBe("UNRESOLVED");
    expect(
      snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "NextGEN TLDs GmbH")?.resolutionState,
    ).toBe("UNRESOLVED");
    expect(snapshot.quality.candidateOrganizationMappings).toBe(3);
    expect(snapshot.quality.ambiguousMappings).toBe(3);
    expect(snapshot.quality.unresolvedApplicantLegalNames).toBe(460);
  });

  it("recommendation alone still cannot confirm; missing dossier / wrong org fails closed", async () => {
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: false,
    });
    const publication = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"), "utf8"),
    ) as Registry2026PublicationV2;
    const contention = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"), "utf8"),
    ) as ContentionMembershipSnapshotV1;

    expect(pre.snapshot.quality.confirmedOrganizationCount).toBe(0);

    const missingName = {
      ...pre.snapshot,
      stewardReviewDossiers: (pre.snapshot.stewardReviewDossiers ?? []).filter(
        (d) => d.applicantLegalName !== "Microsoft Corporation",
      ),
    };
    expect(() =>
      applyStewardApprovalsToSnapshot({
        snapshot: { ...missingName, semanticContentSha256: PRE_STEWARD_SEMANTIC_HASH },
        publication,
        contention,
        expectPreSemanticHash: PRE_STEWARD_SEMANTIC_HASH,
      }),
    ).toThrow(/Missing approved dossier/);

    const dossiers = structuredClone(pre.snapshot.stewardReviewDossiers ?? []);
    const msft = dossiers.find((d) => d.applicantLegalName === "Microsoft Corporation")!;
    msft.candidateOrganizationId = "organization:resolved-2026:tampered";
    const tampered = {
      ...pre.snapshot,
      stewardReviewDossiers: dossiers,
      semanticContentSha256: PRE_STEWARD_SEMANTIC_HASH,
    };
    // mapping org id still original — should fail changed organizationId check
    expect(() =>
      applyStewardApprovalsToSnapshot({
        snapshot: tampered,
        publication,
        contention,
        expectPreSemanticHash: PRE_STEWARD_SEMANTIC_HASH,
      }),
    ).toThrow(/Changed candidate organizationId|Missing organization entity/);
  });

  it("candidates/ambiguous do not count toward confirmed coverage; confirmed do", async () => {
    const { snapshot, inventory } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
    });
    expect(snapshot.quality.applicationsCoveredByConfirmedOrganizations).toBe(669);
    expect(organizationMetricsProductEligible(snapshot)).toBe(true);
    expect(inventory.confirmedSubsetReadyWithLimitation).toBe(true);
    // productEligibleOrganizationCount is confirmed subset — not round total
    expect(snapshot.quality.productEligibleOrganizationCount).toBe(14);
    expect(snapshot.quality.observedApplicantLegalNames).toBe(480);
  });

  it("retains research recommendation and steward provenance; no cross-round/returning/category", async () => {
    const { snapshot, inventory } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
    });
    const link = snapshot.stewardReviewDossiers?.find((d) => d.applicantLegalName === "Link Freedom Group Ltd");
    expect(link?.reviewRecommendation).toBe("CONFIRM");
    expect(link?.recommendationReason.length).toBeGreaterThan(10);
    expect(link?.stewardDecision).toBe("APPROVE");
    expect(snapshot.stewardDecisionProvenance).toEqual(stewardDecisionProvenance());
    expect(snapshot.quality.crossRoundIdentitiesCreated).toBe(0);
    expect(snapshot.quality.returningNewClassificationsCreated).toBe(0);
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
    expect(inventory.stewardDecisionId).toBe(STEWARD_DECISION_ID);
  });

  it("semantic hash is decision-sensitive and order-invariant; Application pin exact; publication unchanged", async () => {
    const pubPath = join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
    const before = await readFile(pubPath, "utf8");
    const publication = JSON.parse(before) as Registry2026PublicationV2;
    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);

    const { snapshot } = await runFirstPassOrganizationResolution({ workspaceRoot, writeArtifacts: false });
    expect(snapshot.applicationPublicationPin.applicationGraphContentSha256).toBe(
      PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
    );
    expect(await readFile(pubPath, "utf8")).toBe(before);

    const reordered = {
      schemaVersion: snapshot.schemaVersion,
      methodVersion: snapshot.methodVersion,
      registryVersion: snapshot.registryVersion,
      applicationPublicationPin: snapshot.applicationPublicationPin,
      organizations: [...snapshot.organizations].reverse(),
      applicantIdentityMappings: [...snapshot.applicantIdentityMappings].reverse(),
      candidateClusters: snapshot.candidateClusters,
      evidence: [...snapshot.evidence].reverse(),
      stewardReviewDossiers: [...(snapshot.stewardReviewDossiers ?? [])].reverse(),
      stewardDecisionProvenance: snapshot.stewardDecisionProvenance,
      quality: snapshot.quality,
      limitations: [...snapshot.limitations].reverse(),
    };
    expect(hashOrganizationResolutionSnapshot(reordered)).toBe(snapshot.semanticContentSha256);
  });

  it("keeps round-wide Organization metrics blocked; Command Center does not claim complete org count", () => {
    const orgMetric = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgMetric?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(orgMetric?.methodReadiness).toBe("BLOCKED_SOURCE");
  });
});
