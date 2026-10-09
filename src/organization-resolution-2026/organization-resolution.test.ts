import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "@/normalization/hashes";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";
import {
  assertApplicationPublicationPin,
  buildOrganizationResolutionSnapshot,
  emptyOrganizationResolutionRegistry,
} from "./build-resolution";
import {
  confirmedPortfolioSizes,
  confirmedResolutionCoverageDisclosure,
  organizationMetricsProductEligible,
  productEligibleOrganizationCount,
} from "./eligibility";
import { loadConfirmed2012ApplicantAliases } from "./load-2012-confirmed-aliases";
import {
  normalizeApplicantNameForCandidateDiscovery,
} from "./normalize-applicant-name";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";
import { runFirstPassOrganizationResolution } from "./run-first-pass";
import {
  assertNotUnsupportedParentCollapse,
  validateOrganizationResolutionRegistry,
} from "./validate-registry";
import {
  ORGANIZATION_RESOLUTION_METHOD_VERSION,
  ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
  PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
} from "./constants";
import type {
  OrganizationEvidenceRef,
  OrganizationResolutionOperation,
  OrganizationResolutionRegistry,
} from "./types";

const workspaceRoot = process.cwd();
const REAL_PUB_PATH = join(
  workspaceRoot,
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json",
);

function baseApp(overrides: Partial<Registry2026ApplicationV2> & { applicationId: string; applicant: string }): Registry2026ApplicationV2 {
  return {
    applicationId: overrides.applicationId,
    applicant: overrides.applicant,
    country: overrides.country ?? "US",
    region: overrides.region ?? "NA",
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    designations: {
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
      idn: false,
    },
    labels: {
      gacEarlyWarning: false,
      gacAdvice: false,
      highRiskString: false,
      objection: false,
      safeguard: false,
      inContentionExportLabel: false,
      clarifyingQuestions: false,
      changeRequest: false,
      openCommentPeriod: false,
      comments: false,
      rvc: false,
      applicantSupport: false,
      variantOnlyExistingTld: false,
      variantIncluded: false,
      cocExemption: false,
      reservedName: false,
      cpe: false,
      singularPlural: false,
    },
    appliedString: {
      sourceRowId: overrides.applicationId,
      label: overrides.appliedString?.label ?? "example",
    },
  };
}

function syntheticPublication(apps: Registry2026ApplicationV2[]): Registry2026PublicationV2 {
  const draft: Registry2026PublicationV2 = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publicationKind: "immutable-publication",
    snapshotId: "snap-synthetic-org-res-test",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T04:11:53Z",
    parserVersion: "aps-2026-application-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-application-csv-normalizer/1.0.0",
    source: { name: "test", url: "https://example.test", evidenceClass: "test" },
    limitations: [],
    officialAggregates: {
      officialApplicationCount: 1615,
      officialApplicantCount: 481,
      provenance: {
        sourceName: "test",
        sourceUrl: "https://example.test",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "a".repeat(64),
      },
    },
    coverage: {
      sourceRowCount: apps.length,
      normalizedApplicationRecordsObserved: apps.length,
      applicationRecordCoverage: {
        observed: apps.length,
        official: 1615,
        completeness: "partial",
        knownExcludedRecords: [],
      },
    },
    lineage: {
      intakeAdapterVersion: "test",
      artifactRole: "aps-2026-application-export",
      rawSha256: "b".repeat(64),
      pipelineSourceId: "test",
      pipelineSourceVersion: 1,
      manifestAttemptId: "test",
      fetchUrl: "https://example.test",
      retrievedAt: "2026-10-08T04:11:53Z",
      httpStatus: 200,
      adapterId: "test",
      adapterSchemaVersion: "1",
      redirectChain: [],
      responseHeaderDigest: null,
    },
    supplementalArtifactPins: {
      contentionMembershipSchema: "registry-2026-contention-membership/1.0.0",
      contentionMembershipPin: null,
    },
    bundleManifest: {
      officialAggregatesContentSha256: "c".repeat(64),
      coverageDescriptorSha256: "d".repeat(64),
      applicationGraphContentSha256: "",
    },
    applications: apps,
  };
  draft.bundleManifest.applicationGraphContentSha256 = contentHash(applicationGraphHashInput(draft));
  return draft;
}

function evidence(partial: Partial<OrganizationEvidenceRef> & Pick<OrganizationEvidenceRef, "evidenceId" | "strength">): OrganizationEvidenceRef {
  return {
    evidenceId: partial.evidenceId,
    strength: partial.strength,
    sourceType: partial.sourceType ?? "steward-note",
    sourceIdentifier: partial.sourceIdentifier ?? "steward-note:test",
    asOf: partial.asOf ?? "2026-10-09",
    summary: partial.summary ?? "test evidence",
    supportsClaim: partial.supportsClaim ?? "test claim",
  };
}

function confirmedOp(overrides: Partial<OrganizationResolutionOperation>): OrganizationResolutionOperation {
  return {
    opId: overrides.opId ?? "op-test-confirmed",
    opVersion: 1,
    organizationKey: overrides.organizationKey ?? "test-org",
    canonicalOrganizationName: overrides.canonicalOrganizationName ?? "Test Org",
    resolutionState: overrides.resolutionState ?? "CONFIRMED",
    confidence: overrides.confidence ?? "high",
    reviewState: overrides.reviewState ?? "steward-approved",
    methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
    evidenceRefIds: overrides.evidenceRefIds ?? ["ev-a"],
    applicantLegalNames: overrides.applicantLegalNames ?? ["Foo LLC"],
    reason: overrides.reason ?? "steward confirmed",
    createdAt: overrides.createdAt ?? "2026-10-09T00:00:00Z",
    ...overrides,
  };
}

describe("organization-resolution-2026 name normalization", () => {
  it("preserves exact legal names while normalizing for candidate discovery only", () => {
    const a = "Foo LLC";
    const b = "FOO, L.L.C.";
    expect(normalizeApplicantNameForCandidateDiscovery(a)).toBe(
      normalizeApplicantNameForCandidateDiscovery(b),
    );
    expect(a).not.toBe(b);
  });

  it("does not collapse Holdings vs Registry Services without evidence", () => {
    const a = normalizeApplicantNameForCandidateDiscovery("Foo Holdings LLC");
    const b = normalizeApplicantNameForCandidateDiscovery("Foo Registry Services LLC");
    expect(a).not.toBe(b);
  });
});

describe("organization-resolution-2026 registry validation", () => {
  it("rejects CONFIRMED without A/B evidence", () => {
    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [evidence({ evidenceId: "ev-d", strength: "D" })],
      operations: [confirmedOp({ evidenceRefIds: ["ev-d"] })],
    };
    expect(() => validateOrganizationResolutionRegistry(registry)).toThrow(/A\/B evidence/);
  });

  it("rejects CONFIRMED without steward-approved review", () => {
    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [evidence({ evidenceId: "ev-a", strength: "A" })],
      operations: [confirmedOp({ reviewState: "pending-steward", evidenceRefIds: ["ev-a"] })],
    };
    expect(() => validateOrganizationResolutionRegistry(registry)).toThrow(/steward-approved/);
  });

  it("rejects unsupported parent/subsidiary collapse without A/B evidence", () => {
    expect(() =>
      assertNotUnsupportedParentCollapse({
        opId: "op-parent",
        applicantLegalNames: ["Sub A", "Parent B"],
        evidence: [evidence({ evidenceId: "ev-d", strength: "D" })],
        claimsParentSubsidiaryCollapse: true,
      }),
    ).toThrow(/parent\/subsidiary/);
  });

  it("blocks silent merge of the same applicant legal name across ops", () => {
    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [evidence({ evidenceId: "ev-a", strength: "A" })],
      operations: [
        confirmedOp({ opId: "a", organizationKey: "a", applicantLegalNames: ["Foo LLC"] }),
        confirmedOp({ opId: "b", organizationKey: "b", applicantLegalNames: ["Foo LLC"] }),
      ],
    };
    expect(() => validateOrganizationResolutionRegistry(registry)).toThrow(/Silent merge blocked/);
  });
});

describe("organization-resolution-2026 builder (synthetic)", () => {
  it("keeps identical legal names as Applicant groups without auto Organization confirmation", () => {
    const pub = syntheticPublication([
      baseApp({ applicationId: "A1", applicant: "Same Name Inc" }),
      baseApp({ applicationId: "A2", applicant: "Same Name Inc" }),
    ]);
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    const mapping = snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === "Same Name Inc");
    expect(mapping?.applicationIds).toEqual(["A1", "A2"]);
    expect(mapping?.resolutionState).toBe("UNRESOLVED");
    expect(mapping?.organizationId).toBeNull();
    expect(snapshot.quality.confirmedOrganizationCount).toBe(0);
    expect(organizationMetricsProductEligible(snapshot)).toBe(false);
  });

  it("normalization cluster yields CANDIDATE not CONFIRMED", () => {
    const pub = syntheticPublication([
      baseApp({ applicationId: "A1", applicant: "Foo LLC" }),
      baseApp({ applicationId: "A2", applicant: "FOO, L.L.C." }),
    ]);
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snapshot.candidateClusters).toHaveLength(1);
    expect(snapshot.quality.candidateOrganizationCount).toBe(1);
    expect(snapshot.quality.confirmedOrganizationCount).toBe(0);
    expect(snapshot.applicantIdentityMappings.every((m) => m.resolutionState === "CANDIDATE")).toBe(true);
    expect(productEligibleOrganizationCount(snapshot)).toBe(0);
  });

  it("confirmed mapping requires evidence and stable organizationId; multi-name with A/B evidence", () => {
    const pub = syntheticPublication([
      baseApp({ applicationId: "A1", applicant: "Alpha Domains Ltd" }),
      baseApp({ applicationId: "A2", applicant: "Alpha Domains No. 1 Ltd" }),
    ]);
    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [
        evidence({
          evidenceId: "ev-a",
          strength: "A",
          sourceType: "first-party-corporate",
          sourceIdentifier: "https://example.test/ownership",
          summary: "First-party ownership disclosure",
          supportsClaim: "Alpha Domains No. 1 Ltd is wholly owned by Alpha Domains Ltd",
        }),
      ],
      operations: [
        confirmedOp({
          organizationKey: "alpha-domains",
          canonicalOrganizationName: "Alpha Domains",
          applicantLegalNames: ["Alpha Domains Ltd", "Alpha Domains No. 1 Ltd"],
          evidenceRefIds: ["ev-a"],
        }),
      ],
    };
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry,
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snapshot.quality.confirmedOrganizationCount).toBe(1);
    const org = snapshot.organizations.find((o) => o.status === "CONFIRMED")!;
    expect(org.organizationId).toBe("organization:resolved-2026:alpha-domains");
    expect(org.applicantLegalNames).toEqual(["Alpha Domains Ltd", "Alpha Domains No. 1 Ltd"]);
    expect(org.evidenceRefIds).toContain("ev-a");
    expect(confirmedPortfolioSizes(snapshot)[0]?.applicationCount).toBe(2);
  });

  it("candidate and ambiguous do not count as confirmed", () => {
    const pub = syntheticPublication([
      baseApp({ applicationId: "A1", applicant: "Cand Co" }),
      baseApp({ applicationId: "A2", applicant: "Amb Co" }),
    ]);
    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [
        evidence({ evidenceId: "ev-c", strength: "C" }),
        evidence({ evidenceId: "ev-b", strength: "B" }),
      ],
      operations: [
        {
          ...confirmedOp({
            opId: "cand",
            organizationKey: "cand",
            resolutionState: "CANDIDATE",
            reviewState: "pending-steward",
            confidence: "medium",
            applicantLegalNames: ["Cand Co"],
            evidenceRefIds: ["ev-c"],
          }),
        },
        {
          ...confirmedOp({
            opId: "amb",
            organizationKey: "amb",
            resolutionState: "AMBIGUOUS",
            reviewState: "pending-steward",
            confidence: "low",
            applicantLegalNames: ["Amb Co"],
            evidenceRefIds: ["ev-b"],
            notes: "related but ultimate portfolio unclear",
          }),
        },
      ],
    };
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry,
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snapshot.quality.confirmedOrganizationCount).toBe(0);
    expect(snapshot.quality.candidateOrganizationCount).toBe(1);
    expect(snapshot.quality.ambiguousOrganizationCount).toBe(1);
    expect(organizationMetricsProductEligible(snapshot)).toBe(false);
  });

  it("requires Application publication pin and rejects wrong hash", () => {
    const pub = syntheticPublication([baseApp({ applicationId: "A1", applicant: "X" })]);
    expect(() => assertApplicationPublicationPin(pub, "0".repeat(64))).toThrow(/pin mismatch/);
    expect(() =>
      buildOrganizationResolutionSnapshot({
        publication: pub,
        registry: emptyOrganizationResolutionRegistry(),
        confirmed2012Aliases: new Map(),
        expectApplicationGraphHash: "0".repeat(64),
      }),
    ).toThrow(/pin mismatch/);
  });

  it("semantic hash is order-invariant and changes with mapping semantics", () => {
    const apps = [
      baseApp({ applicationId: "A2", applicant: "B Co" }),
      baseApp({ applicationId: "A1", applicant: "A Co" }),
    ];
    const pub = syntheticPublication(apps);
    const snap1 = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
      generatedAt: "2026-10-09T00:00:00Z",
    });
    const pubReordered = syntheticPublication([...apps].reverse());
    // Reordering apps changes publication graph hash — pin must match each pub.
    // Order invariance is within the resolution snapshot arrays, not the publication.
    const snap2 = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
      generatedAt: "2099-01-01T00:00:00Z",
    });
    expect(snap1.semanticContentSha256).toBe(snap2.semanticContentSha256);
    expect(snap1.generatedAt).not.toBe(snap2.generatedAt);

    const rest = {
      schemaVersion: snap1.schemaVersion,
      methodVersion: snap1.methodVersion,
      registryVersion: snap1.registryVersion,
      applicationPublicationPin: snap1.applicationPublicationPin,
      organizations: [...snap1.organizations].reverse(),
      applicantIdentityMappings: [...snap1.applicantIdentityMappings].reverse(),
      candidateClusters: [...snap1.candidateClusters].reverse(),
      evidence: [...snap1.evidence].reverse(),
      quality: snap1.quality,
      limitations: [...snap1.limitations].reverse(),
    };
    expect(hashOrganizationResolutionSnapshot(rest)).toBe(snap1.semanticContentSha256);

    const registry: OrganizationResolutionRegistry = {
      registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      evidence: [evidence({ evidenceId: "ev-a", strength: "A" })],
      operations: [
        confirmedOp({
          applicantLegalNames: ["A Co"],
          organizationKey: "a-co",
          evidenceRefIds: ["ev-a"],
        }),
      ],
    };
    const snap3 = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry,
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snap3.semanticContentSha256).not.toBe(snap1.semanticContentSha256);
    void pubReordered;
  });

  it("2012 historical match is candidate only — no returning/new or cross-round identity", () => {
    const pub = syntheticPublication([
      baseApp({ applicationId: "A1", applicant: "Microsoft Corporation" }),
    ]);
    const aliases = new Map([
      [
        "Microsoft Corporation",
        {
          applicantLegalName: "Microsoft Corporation",
          organizationKey: "microsoft",
          canonicalOrganizationName: "Microsoft Corporation",
          promotionState: "CONFIRMED" as const,
        },
      ],
    ]);
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: aliases,
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    const mapping = snapshot.applicantIdentityMappings[0];
    expect(mapping.resolutionState).toBe("CANDIDATE");
    expect(mapping.possible2012OrganizationKey).toBe("microsoft");
    expect(snapshot.quality.confirmedOrganizationCount).toBe(0);
    expect(snapshot.quality.returningNewClassificationsCreated).toBe(0);
    expect(snapshot.quality.crossRoundIdentitiesCreated).toBe(0);
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
  });

  it("unresolved stays unresolved — not Unknown Organization", () => {
    const pub = syntheticPublication([baseApp({ applicationId: "A1", applicant: "Lone Applicant LLC" })]);
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snapshot.applicantIdentityMappings[0].resolutionState).toBe("UNRESOLVED");
    expect(snapshot.applicantIdentityMappings[0].organizationId).toBeNull();
    expect(JSON.stringify(snapshot)).not.toMatch(/Unknown Organization/i);
  });

  it("partial coverage is explicit and quality counts only confirmed as resolved", () => {
    const pub = syntheticPublication([baseApp({ applicationId: "A1", applicant: "X" })]);
    const snapshot = buildOrganizationResolutionSnapshot({
      publication: pub,
      registry: emptyOrganizationResolutionRegistry(),
      confirmed2012Aliases: new Map(),
      expectApplicationGraphHash: pub.bundleManifest.applicationGraphContentSha256,
    });
    expect(snapshot.quality.applicationCoverage).toBe("PARTIAL");
    expect(snapshot.applicationPublicationPin.applicationRecordCoverageCompleteness).toBe("partial");
    const disclosure = confirmedResolutionCoverageDisclosure(snapshot);
    expect(disclosure.confirmedOrganizations).toBe(0);
    expect(disclosure.disclosure).toMatch(/blocked/i);
  });
});

describe("organization-resolution-2026 real 1614 first pass", () => {
  it("inventories Reveal Day publication without fabricating confirmations", async () => {
    const publicationText = await readFile(REAL_PUB_PATH, "utf8");
    const publication = JSON.parse(publicationText) as Registry2026PublicationV2;
    expect(publication.applications).toHaveLength(1614);
    expect(contentHash(applicationGraphHashInput(publication))).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);

    const { snapshot, inventory } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
    });

    expect(inventory.applications).toBe(1614);
    expect(inventory.applicantLegalNames).toBe(480);
    expect(inventory.confirmedOrganizations).toBe(0);
    expect(inventory.productEligible).toBe(false);
    expect(inventory.applicationPin).toBe(PINNED_APPLICATION_GRAPH_CONTENT_SHA256);
    expect(snapshot.schemaVersion).toBe("organization-resolution-snapshot/1.0.0");

    // Applicant names preserved exactly on mappings
    const publishedNames = new Set(publication.applications.map((a) => a.applicant));
    for (const m of snapshot.applicantIdentityMappings) {
      expect(publishedNames.has(m.applicantLegalName)).toBe(true);
    }

    // Sidecar separate from Publication 2.0 — no organization field written onto apps
    expect(publication.applications.every((a) => !("organization" in a))).toBe(true);

    // Historical candidates for exact 2012 CONFIRMED aliases
    const histKeys = new Set(
      inventory.candidateHistoricalMatches.map((c) => c.possible2012OrganizationKey),
    );
    expect(histKeys.has("google-charleston-road")).toBe(true);
    expect(histKeys.has("microsoft")).toBe(true);

    expect(snapshot.quality.returningNewClassificationsCreated).toBe(0);
    expect(snapshot.quality.crossRoundIdentitiesCreated).toBe(0);
    expect(snapshot.quality.categoryInferencesCreated).toBe(0);
  });

  it("loads 2012 confirmed aliases for exact-name cross-reference", async () => {
    const aliases = await loadConfirmed2012ApplicantAliases(workspaceRoot);
    expect(aliases.get("Charleston Road Registry Inc.")?.organizationKey).toBe("google-charleston-road");
    expect(aliases.get("Microsoft Corporation")?.organizationKey).toBe("microsoft");
  });
});

describe("organization-resolution-2026 product / contention / eligibility guards", () => {
  it("metric eligibility remains blocked when no confirmed mappings exist", () => {
    const orgMetric = METRIC_ELIGIBILITY_CATALOG.find((m) => m.metricId === "organization-round-count");
    expect(orgMetric?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(orgMetric?.methodReadiness).toBe("BLOCKED_SOURCE");
  });

  it("does not treat contention Org Name as resolved Organization (type contract)", async () => {
    const contentionPath = join(
      workspaceRoot,
      ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
    );
    const contention = JSON.parse(await readFile(contentionPath, "utf8")) as {
      contentionSets: Array<{ members: Array<{ publishedOrgName: string; organization?: unknown }> }>;
    };
    const member = contention.contentionSets[0]?.members[0];
    expect(member).toBeDefined();
    expect(member).toHaveProperty("publishedOrgName");
    expect(member).not.toHaveProperty("organization");
    expect(member).not.toHaveProperty("resolvedOrganizationId");
  });
});
