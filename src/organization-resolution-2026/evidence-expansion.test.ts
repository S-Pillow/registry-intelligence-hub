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
import {
  buildResearchQueue,
  existingCandidateLegalNamesFromSnapshot,
  RESEARCH_QUEUE_CAP,
} from "./research-queue";
import { validateReviewRecommendation } from "./validate-recommendation";
import { applyResearchPackageToSnapshot } from "./apply-research";
import { buildOrganizationResolutionSnapshot, emptyOrganizationResolutionRegistry } from "./build-resolution";
import { loadConfirmed2012ApplicantAliases } from "./load-2012-confirmed-aliases";
import { runFirstPassOrganizationResolution } from "./run-first-pass";
import { RESEARCH_PACKAGE_2026_2 } from "./fixtures/research-package-2026-2";
import { organizationMetricsProductEligible } from "./eligibility";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";
import type { ResearchEvidenceItem, ResearchPackage } from "./review-types";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";

const workspaceRoot = process.cwd();

function evidence(partial: Partial<ResearchEvidenceItem> & Pick<ResearchEvidenceItem, "evidenceId" | "strength">): ResearchEvidenceItem {
  return {
    evidenceId: partial.evidenceId,
    strength: partial.strength,
    sourceType: partial.sourceType ?? "steward-note",
    sourceIdentifier: partial.sourceIdentifier ?? "https://example.test/ev",
    title: partial.title ?? "test",
    asOf: partial.asOf ?? "2026-10-09",
    retrievedAt: partial.retrievedAt ?? "2026-10-09",
    summary: partial.summary ?? "summary",
    supportsClaim: partial.supportsClaim ?? "claim",
    temporalRelevance: partial.temporalRelevance ?? "test",
    limitations: partial.limitations ?? "none",
  };
}

describe("ORG-RES-2026-2 research queue", () => {
  it("is deterministic, capped, and uses Applicant/application facts not inferred orgs", async () => {
    const publication = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"), "utf8"),
    ) as Registry2026PublicationV2;
    const contention = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"), "utf8"),
    ) as ContentionMembershipSnapshotV1;

    const base = buildOrganizationResolutionSnapshot({
      publication,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: await loadConfirmed2012ApplicantAliases(workspaceRoot),
    });
    const existing = existingCandidateLegalNamesFromSnapshot(base.applicantIdentityMappings);
    expect(existing).toEqual(["Charleston Road Registry Inc.", "Microsoft Corporation"]);

    const a = buildResearchQueue({ publication, contention, existingCandidateLegalNames: existing });
    const b = buildResearchQueue({ publication, contention, existingCandidateLegalNames: existing });
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(RESEARCH_QUEUE_CAP);
    expect(a.length).toBe(22);
    expect(a[0].applicantLegalName).toBe("Charleston Road Registry Inc.");
    expect(a.some((q) => q.queueReasons.includes("top-app-count"))).toBe(true);
    // Priority uses observed application counts / contention memberships, not org inference
    expect(a.every((q) => q.observedApplicationCount >= 1)).toBe(true);
  });
});

describe("ORG-RES-2026-2 recommendations vs confirmation", () => {
  it("rejects CONFIRM recommendation on C/D-only evidence", () => {
    expect(() =>
      validateReviewRecommendation({
        recommendation: "CONFIRM",
        evidence: [evidence({ evidenceId: "d", strength: "D", summary: "name similar" })],
        claimsParentSubsidiaryCollapse: false,
        selfResolution: true,
      }),
    ).toThrow(/A or B/);
  });

  it("allows A or B CONFIRM recommendation without changing mapping to CONFIRMED", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyResearch: true,
    });
    const msft = snapshot.stewardReviewDossiers?.find((d) => d.applicantLegalName === "Microsoft Corporation");
    expect(msft?.reviewRecommendation).toBe("CONFIRM");
    expect(msft?.strongestEvidenceStrength).toBe("A");
    expect(msft?.resolutionState).toBe("CANDIDATE");
    expect(snapshot.quality.confirmedOrganizationCount).toBe(0);
    expect(snapshot.quality.recommendConfirm).toBeGreaterThan(0);
    expect(organizationMetricsProductEligible(snapshot)).toBe(false);
  });

  it("keeps Squarespace B-evidence as CANDIDATE with CONFIRM recommendation", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({ workspaceRoot, writeArtifacts: false });
    const row = snapshot.stewardReviewDossiers?.find((d) => d.applicantLegalName === "Squarespace Registry LLC");
    expect(row?.reviewRecommendation).toBe("CONFIRM");
    expect(row?.strongestEvidenceStrength).toBe("B");
    expect(row?.resolutionState).toBe("CANDIDATE");
  });

  it("does not auto-confirm from 2012 alias; no returning/new", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({ workspaceRoot, writeArtifacts: false });
    const crr = snapshot.applicantIdentityMappings.find(
      (m) => m.applicantLegalName === "Charleston Road Registry Inc.",
    );
    expect(crr?.resolutionState).toBe("CANDIDATE");
    expect(crr?.possible2012OrganizationKey).toBe("google-charleston-road");
    expect(snapshot.quality.returningNewClassificationsCreated).toBe(0);
    expect(snapshot.quality.crossRoundIdentitiesCreated).toBe(0);
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
  });

  it("parent CONFIRM recommendation requires explicit ownership language", () => {
    expect(() =>
      validateReviewRecommendation({
        recommendation: "CONFIRM",
        evidence: [
          evidence({
            evidenceId: "b",
            strength: "B",
            summary: "Same brand homepage",
            supportsClaim: "looks related",
          }),
        ],
        claimsParentSubsidiaryCollapse: true,
        selfResolution: false,
      }),
    ).toThrow(/ownership\/control/);
  });

  it("self-resolution CONFIRM requires evidence", () => {
    expect(() =>
      validateReviewRecommendation({
        recommendation: "CONFIRM",
        evidence: [],
        claimsParentSubsidiaryCollapse: false,
        selfResolution: true,
      }),
    ).toThrow(/requires (evidence|at least one A or B)/);
  });

  it("recommendations do not count in confirmed coverage; pin remains fail-closed", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({ workspaceRoot, writeArtifacts: false });
    expect(snapshot.quality.applicationsCoveredByConfirmedOrganizations).toBe(0);
    expect(snapshot.applicationPublicationPin.applicationGraphContentSha256).toBe(
      PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
    );
    expect(snapshot.quality.dossiersResearched).toBe(22);
  });

  it("duplicate evidence ids are normalized; temporal fields preserved; hash changes with evidence semantics", async () => {
    const publication = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"), "utf8"),
    ) as Registry2026PublicationV2;
    const contention = JSON.parse(
      await readFile(join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"), "utf8"),
    ) as ContentionMembershipSnapshotV1;
    const base = buildOrganizationResolutionSnapshot({
      publication,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: await loadConfirmed2012ApplicantAliases(workspaceRoot),
      generatedAt: "2026-10-09T00:00:00Z",
    });
    const queue = buildResearchQueue({
      publication,
      contention,
      existingCandidateLegalNames: existingCandidateLegalNamesFromSnapshot(base.applicantIdentityMappings),
    });
    const pkg: ResearchPackage = {
      packageVersion: "organization-research-package/1.0.0",
      methodNote: "test",
      researchedAt: "2026-10-09",
      dossiers: [
        {
          applicantLegalName: "Microsoft Corporation",
          candidateOrganizationKey: "hist-2012-microsoft",
          candidateCanonicalName: "Microsoft Corporation",
          resolutionState: "CANDIDATE",
          reviewRecommendation: "CONFIRM",
          recommendationReason: "test",
          requiredStewardAction: "APPROVE",
          temporalNote: "period-2026",
          evidence: [
            evidence({ evidenceId: "dup", strength: "A", summary: "sec", supportsClaim: "Microsoft Corporation entity" }),
            evidence({ evidenceId: "dup", strength: "A", summary: "sec", supportsClaim: "Microsoft Corporation entity" }),
          ],
        },
      ],
    };
    const snap1 = applyResearchPackageToSnapshot({
      snapshot: base,
      queue,
      research: pkg,
      generatedAt: "2026-10-09T00:00:00Z",
    });
    const dossier = snap1.stewardReviewDossiers?.find((d) => d.applicantLegalName === "Microsoft Corporation");
    expect(dossier?.evidenceIds).toEqual(["dup"]);
    expect(dossier?.temporalNote).toBe("period-2026");

    const pkg2: ResearchPackage = {
      ...pkg,
      dossiers: [
        {
          ...pkg.dossiers[0],
          evidence: [evidence({ evidenceId: "dup", strength: "A", summary: "CHANGED", supportsClaim: "changed claim" })],
        },
      ],
    };
    const snap2 = applyResearchPackageToSnapshot({
      snapshot: base,
      queue,
      research: pkg2,
      generatedAt: "2026-10-09T00:00:00Z",
    });
    expect(snap2.semanticContentSha256).not.toBe(snap1.semanticContentSha256);

    const reordered = {
      schemaVersion: snap1.schemaVersion,
      methodVersion: snap1.methodVersion,
      registryVersion: snap1.registryVersion,
      applicationPublicationPin: snap1.applicationPublicationPin,
      organizations: [...snap1.organizations].reverse(),
      applicantIdentityMappings: [...snap1.applicantIdentityMappings].reverse(),
      candidateClusters: snap1.candidateClusters,
      evidence: [...snap1.evidence].reverse(),
      stewardReviewDossiers: [...(snap1.stewardReviewDossiers ?? [])].reverse(),
      quality: snap1.quality,
      limitations: [...snap1.limitations].reverse(),
    };
    expect(hashOrganizationResolutionSnapshot(reordered)).toBe(snap1.semanticContentSha256);
  });

  it("research package cannot set CONFIRMED; steward approval remains required", () => {
    expect(() =>
      applyResearchPackageToSnapshot({
        snapshot: {
          schemaVersion: "organization-resolution-snapshot/1.0.0",
          methodVersion: "organization-resolution-2026/1.0.0",
          registryVersion: "organization-resolution-registry/1.0.0",
          applicationPublicationPin: {
            schemaVersion: "registry-2026-publication/2.0.0",
            snapshotId: "x",
            applicationGraphContentSha256: PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
            normalizedApplicationRecordsObserved: 0,
            applicationRecordCoverageCompleteness: "partial",
          },
          organizations: [],
          applicantIdentityMappings: [],
          candidateClusters: [],
          evidence: [],
          quality: {
            observedApplications: 0,
            officialApplications: 1615,
            applicationCoverage: "PARTIAL",
            observedApplicantLegalNames: 0,
            officialApplicants: 481,
            applicantLegalNamesWithMultipleApplications: 0,
            repeatedExactLegalNameCount: 0,
            candidateOrganizationMappings: 0,
            confirmedOrganizationMappings: 0,
            ambiguousMappings: 0,
            unresolvedApplicantLegalNames: 0,
            applicationsCoveredByConfirmedOrganizations: 0,
            confirmedApplicationCoverageRatio: 0,
            confirmedOrganizationCount: 0,
            candidateOrganizationCount: 0,
            ambiguousOrganizationCount: 0,
            candidateClusterCount: 0,
            productEligibleOrganizationCount: 0,
            returningNewClassificationsCreated: 0,
            crossRoundIdentitiesCreated: 0,
            categoryInferencesCreated: 0,
          },
          limitations: [],
          semanticContentSha256: "",
          generatedAt: "2026-10-09T00:00:00Z",
        },
        queue: [],
        research: {
          packageVersion: "organization-research-package/1.0.0",
          methodNote: "bad",
          researchedAt: "2026-10-09",
          dossiers: [
            {
              applicantLegalName: "X",
              candidateOrganizationKey: "x",
              candidateCanonicalName: "X",
              // @ts-expect-error research must not confirm
              resolutionState: "CONFIRMED",
              reviewRecommendation: "CONFIRM",
              recommendationReason: "bad",
              requiredStewardAction: "none",
              temporalNote: "n/a",
              evidence: [evidence({ evidenceId: "a", strength: "A" })],
            },
          ],
        },
      }),
    ).toThrow(/must not set CONFIRMED/);
  });
});

describe("ORG-RES-2026-2 integration guards", () => {
  it("keeps publication/contention unchanged and metric eligibility blocked", async () => {
    const pubPath = join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
    const contPath = join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");
    const beforePub = await readFile(pubPath, "utf8");
    const beforeCont = await readFile(contPath, "utf8");
    const publication = JSON.parse(beforePub) as Registry2026PublicationV2;
    const contention = JSON.parse(beforeCont) as ContentionMembershipSnapshotV1;

    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);
    expect(publication.applications).toHaveLength(1614);
    expect(contention.contentionSets).toHaveLength(263);
    expect(contention.contentionSets.reduce((n, s) => n + s.members.length, 0)).toBe(891);

    await runFirstPassOrganizationResolution({ workspaceRoot, writeArtifacts: false });

    expect(await readFile(pubPath, "utf8")).toBe(beforePub);
    expect(await readFile(contPath, "utf8")).toBe(beforeCont);

    const member = contention.contentionSets[0]?.members[0] as { publishedOrgName?: string; organization?: unknown };
    expect(member).toHaveProperty("publishedOrgName");
    expect(member).not.toHaveProperty("organization");

    const orgMetric = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgMetric?.claimReadiness.round2026).toBe("NOT_PUBLISHED");

    expect(RESEARCH_PACKAGE_2026_2.dossiers).toHaveLength(22);
  });
});
