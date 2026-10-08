import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "@/normalization/hashes";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  resolveMetricEligibilityWithActuality,
  type ClaimActualityState,
  type ContentionActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { readClaimActualityState } from "@/reveal-day-2026/claim-actuality-persistence";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  contentionSidecarHashInput,
  type ContentionMembershipSnapshotV1,
} from "@/reveal-day-2026/contention-membership-types";
import {
  loadContentionMembershipFromPath,
  loadPublicationV2FromPath,
} from "@/reveal-day-2026/promotion-contract-2x-io";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import {
  buildBrowserApplicationPayloadFromPublication,
  resolveActiveRegistryApplicationsDocument,
} from "@/lib/registry-application-payload";
import {
  assertDocumentCompatibleWithBriefingsOrSaved,
  buildBrowserApplicationPayloadFromPublicationV2,
  coverageDisclosureForDocumentV2,
  dataHealthMetadataFromBrowserV2,
  DEFAULT_EXPLORE_FILTERS_V2,
  filterBrowserApplicationsV2,
  FORBIDDEN_BROWSER_V2_APPLICATION_KEYS,
  localResultCountV2,
  metricEligibilityProbeForBrowserV2,
  UNSUPPORTED_EXPLORE_FACETS_V2,
} from "@/lib/registry-application-payload-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";
import { loadPublicationSnapshotFromPath } from "@/reveal-day-2026/dry-run";
import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import { hubCompareDimensionAllowsComparableValue } from "@/lib/hub-metric-eligibility";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const REVEAL_CONTENTION = join(
  process.cwd(),
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
);
const DEFAULT_STATE = join(process.cwd(), ".data/reveal-2026/claim-actuality-state.json");
const DRILL_1_1 = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json",
);

async function revealPresent(): Promise<boolean> {
  try {
    await access(REVEAL_APP);
    await access(REVEAL_CONTENTION);
    return true;
  } catch {
    return false;
  }
}

function stubApp(applicationId: string, label: string, opts?: Partial<Registry2026ApplicationV2>): Registry2026ApplicationV2 {
  return {
    applicationId,
    applicant: `Applicant ${applicationId}`,
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "Evaluation",
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
    appliedString: { sourceRowId: applicationId, label },
    ...opts,
  };
}

function sealPublication(draft: Registry2026PublicationV2): Registry2026PublicationV2 {
  const sealed: Registry2026PublicationV2 = {
    ...draft,
    bundleManifest: {
      officialAggregatesContentSha256: contentHash(draft.officialAggregates),
      coverageDescriptorSha256: contentHash(draft.coverage),
      applicationGraphContentSha256: "",
    },
  };
  sealed.bundleManifest.applicationGraphContentSha256 = contentHash(applicationGraphHashInput(sealed));
  return sealed;
}

function makePublication(): Registry2026PublicationV2 {
  const apps = [
    stubApp("SYN1000T-T10001", "alpha", {
      designations: {
        brand: true,
        community: false,
        geoSelfDesignated: false,
        geoStringReviewConfirmed: false,
        idn: false,
      },
      replacementString: {
        sourceRowId: "SYN1000T-T10001-R",
        label: "alpha-r",
        applicationStatus: "Withdrawn",
        processingStage: "N/A",
        applicationType: "Standard",
      },
      appliedString: {
        sourceRowId: "SYN1000T-T10001",
        label: "alpha",
        unicodeLabel: "alpha",
        tldVariants: "alpha1",
      },
    }),
    stubApp("SYN1001T-T10002", "beta", {
      designations: {
        brand: false,
        community: false,
        geoSelfDesignated: true,
        geoStringReviewConfirmed: false,
        idn: true,
      },
      appliedString: { sourceRowId: "SYN1001T-T10002", label: "beta", unicodeLabel: "β" },
      labels: {
        ...stubApp("x", "x").labels,
        variantIncluded: true,
      },
    }),
  ];
  return sealPublication({
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publicationKind: "immutable-publication",
    snapshotId: "snap-synthetic-browser-2x",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    parserVersion: "aps-2026-application-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-application-csv-normalizer/1.0.0",
    source: { name: "synthetic", url: "https://example.test/apps.csv", evidenceClass: "synthetic" },
    limitations: ["synthetic"],
    officialAggregates: {
      officialApplicationCount: 3,
      officialApplicantCount: 3,
      provenance: {
        sourceName: "stats",
        sourceUrl: "https://example.test/stats",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "a".repeat(64),
      },
    },
    coverage: {
      sourceRowCount: 2,
      normalizedApplicationRecordsObserved: 2,
      applicationRecordCoverage: {
        observed: 2,
        official: 3,
        completeness: "partial",
        knownExcludedRecords: [
          {
            applicationId: "WDO2627T-T45217",
            primaryString: "wdo",
            applicant: "World Data Organization",
            location: "CN",
            region: "AP",
            applicationStatus: "Undergoing administrative check",
            sourceUrl: "https://example.test/wdo",
            retrievedAt: "2026-10-08T00:00:00Z",
            notes: "coverage exclusion only",
          },
        ],
      },
    },
    lineage: {
      intakeAdapterVersion: "aps-2026-application-csv-parser/1.0.0",
      artifactRole: "aps-2026-application-export",
      rawSha256: "b".repeat(64),
      pipelineSourceId: "synthetic",
      pipelineSourceVersion: 1,
      manifestAttemptId: "capture",
      fetchUrl: "https://example.test/apps.csv",
      retrievedAt: "2026-10-08T00:00:00Z",
      httpStatus: 200,
      adapterId: "local-artifact",
      adapterSchemaVersion: "local-artifact-adapter/1.0.0",
      redirectChain: [],
      responseHeaderDigest: null,
    },
    supplementalArtifactPins: {
      contentionMembershipSchema: "registry-2026-contention-membership/1.0.0",
      contentionMembershipPin: null,
    },
    bundleManifest: {
      officialAggregatesContentSha256: "",
      coverageDescriptorSha256: "",
      applicationGraphContentSha256: "",
    },
    applications: apps,
  });
}

function makeContention(appHash: string, opts?: { badPin?: boolean }): ContentionMembershipSnapshotV1 {
  const pin = opts?.badPin ? "f".repeat(64) : appHash;
  const draft: ContentionMembershipSnapshotV1 = {
    schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
    snapshotKind: "official-contention-membership-sidecar",
    snapshotId: "snap-synthetic-contention-browser",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    parserVersion: "aps-2026-contention-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-contention-csv-normalizer/1.0.0",
    source: { name: "contention", url: "https://example.test/c.csv", evidenceClass: "synthetic" },
    limitations: ["synthetic"],
    lineage: {
      intakeAdapterVersion: "aps-2026-contention-csv-parser/1.0.0",
      artifactRole: "aps-2026-reveal-day-contention-export",
      rawSha256: "c".repeat(64),
      pipelineSourceId: "c",
      pipelineSourceVersion: 1,
      manifestAttemptId: "c",
      fetchUrl: "https://example.test/c.csv",
      retrievedAt: "2026-10-08T00:00:00Z",
      httpStatus: 200,
      adapterId: "local-artifact",
      adapterSchemaVersion: "local-artifact-adapter/1.0.0",
      redirectChain: [],
      responseHeaderDigest: null,
    },
    applicationPublicationPin: {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
      snapshotId: "snap-synthetic-browser-2x",
      applicationGraphContentSha256: pin,
      normalizedApplicationRecordsObserved: 2,
      applicationRecordCoverageCompleteness: "partial",
    },
    quality: {
      sourceMembershipRowCount: 2,
      officialContentionSetCount: 1,
      joinedMemberCount: 2,
      unjoinedMemberCount: 0,
      replacementIdCount: 0,
      minSetSize: 2,
      maxSetSize: 2,
      applicationsAppearingInMultipleSets: 0,
      wdoPresentInContentionSource: false,
      evidenceSeparationNote: "OFFICIAL CONTENTION MEMBERSHIP != RIH EXACT-STRING GROUPING",
      applicationCoverageUnchangedByContentionJoin: true,
    },
    contentionSets: [
      {
        officialContentionSetId: "1",
        members: [
          {
            applicationId: "SYN1000T-T10001",
            publishedOrgName: "Org A",
            appliedForStringsAsPublished: "alpha",
            sourceRowIndex: 1,
          },
          {
            applicationId: "SYN1001T-T10002",
            publishedOrgName: "Org B",
            appliedForStringsAsPublished: "beta",
            sourceRowIndex: 2,
          },
        ],
      },
    ],
    bundleManifest: {
      rawSourceSha256: "c".repeat(64),
      sidecarContentSha256: "",
      applicationPublicationPinSha256: contentHash({ pin }),
    },
  };
  draft.bundleManifest.sidecarContentSha256 = contentHash(contentionSidecarHashInput(draft));
  return draft;
}

describe("registry-browser-applications/2.0.0 projection", () => {
  it("1-14 — converts 2.0 publication honestly with coverage metadata and no fabricated 1.1 fields", () => {
    const publication = makePublication();
    const doc = buildBrowserApplicationPayloadFromPublicationV2(publication);
    expect(doc.payloadVersion).toBe(REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20);
    expect(doc.payloadMode).toBe("inactive-2x");
    expect(doc.applications).toHaveLength(2);
    expect(doc.observedApplicationRecords).toBe(2);
    expect(doc.officialApplications).toBe(3);
    expect(doc.officialApplicants).toBe(3);
    expect(doc.officialApplications).not.toBe(doc.observedApplicationRecords);
    expect(doc.knownExcludedRecords.map((r) => r.applicationId)).toEqual(["WDO2627T-T45217"]);
    expect(doc.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);

    for (const app of doc.applications) {
      const raw = app as unknown as Record<string, unknown>;
      for (const key of FORBIDDEN_BROWSER_V2_APPLICATION_KEYS) {
        expect(Object.hasOwn(raw, key), key).toBe(false);
      }
    }

    const alpha = doc.applications.find((a) => a.applicationId === "SYN1000T-T10001")!;
    expect(alpha.appliedString.label).toBe("alpha");
    expect(alpha.appliedString.tldVariants).toBe("alpha1");
    expect(alpha.replacementString?.sourceRowId).toBe("SYN1000T-T10001-R");
    expect(alpha.designations.brand).toBe(true);
    expect(alpha.designations.idn).toBe(false);

    const beta = doc.applications.find((a) => a.applicationId === "SYN1001T-T10002")!;
    expect(beta.designations.idn).toBe(true);
    expect(beta.labels.variantIncluded).toBe(true);
    expect(beta.labels.inContentionExportLabel).toBe(false);

    const disclosure = coverageDisclosureForDocumentV2(doc);
    expect(disclosure.userMustNotReadObservedAsOfficialTotal).toBe(true);
    expect(disclosure.completeness).toBe("partial");
    expect(disclosure.disclosureKeys).toContain("not-official-round-total");
  });

  it("15-18 — Search/Explore work on honest 2.x fields; counts are local records", () => {
    const doc = buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    expect(UNSUPPORTED_EXPLORE_FACETS_V2).toEqual(
      expect.arrayContaining(["organization", "category", "returning", "confidence"]),
    );
    const matches = filterBrowserApplicationsV2(doc.applications, {
      ...DEFAULT_EXPLORE_FILTERS_V2,
      q: "alpha",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.applicationId).toBe("SYN1000T-T10001");
    const count = localResultCountV2(matches);
    expect(count.matchingObservedRecords).toBe(1);
    expect(count.notOfficialRoundTotal).toBe(true);
    expect(count.matchingObservedRecords).not.toBe(doc.officialApplications);

    const idnOnly = filterBrowserApplicationsV2(doc.applications, {
      ...DEFAULT_EXPLORE_FILTERS_V2,
      idn: "idn",
    });
    expect(idnOnly).toHaveLength(1);
    expect(idnOnly[0]?.designations.idn).toBe(true);

    // Explore does not require fake 1.1 fields to filter
    expect(() =>
      filterBrowserApplicationsV2(doc.applications, { ...DEFAULT_EXPLORE_FILTERS_V2, region: "NA" }),
    ).not.toThrow();
  });

  it("19-21 — metric eligibility: official aggregate vs blocked capabilities", () => {
    const doc = buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    const promotedApp: ClaimActualityState = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY",
      snapshotId: doc.snapshotId,
      snapshotContentHash: doc.snapshotContentHash,
      rawSha256: doc.rawSha256,
    };
    const probe = metricEligibilityProbeForBrowserV2(doc, promotedApp);
    expect(probe["application-count"].sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(probe["application-count"].claimReadiness2026).toBe("REAL_SOURCE_READY");
    expect(probe["application-count"].documentOfficialApplications).toBe(3);
    expect(probe["unique-applied-strings"].claimReadiness2026).toBe("NOT_PUBLISHED");
    expect(probe["unique-applied-strings"].methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(probe["organization-round-count"].methodReadiness).toBe("BLOCKED_SOURCE");
    expect(probe["returning-participant-identity"].methodReadiness).toBe("BLOCKED_SOURCE");
    expect(probe["category-mix"].methodReadiness).toBe("BLOCKED_SOURCE");
    expect(probe["idn-applications"].sourceChannel).toBe("OFFICIAL_AGGREGATE");
  });

  it("22-25 — contention overlay joins independently; pin mismatch disables only contention", () => {
    const publication = makePublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const withContention = buildBrowserApplicationPayloadFromPublicationV2(publication, {
      contention: makeContention(appHash),
    });
    expect(withContention.contentionOverlay.status).toBe("available");
    expect(withContention.contentionOverlay.officialContentionSetCount).toBe(1);
    expect(withContention.applications[0]?.officialContention?.membershipPresent).toBe(true);
    expect(withContention.applications[0]?.officialContention?.terminology).toBe(
      "official-initial-contention",
    );
    expect(withContention.applications[0]?.officialContention?.officialContentionSetIds).toEqual(["1"]);

    const without = buildBrowserApplicationPayloadFromPublicationV2(publication);
    expect(without.applications).toHaveLength(2);
    expect(without.contentionOverlay.status).toBe("unavailable");
    expect(without.applications.every((a) => a.officialContention === undefined)).toBe(true);

    const badPin = buildBrowserApplicationPayloadFromPublicationV2(publication, {
      contention: makeContention(appHash, { badPin: true }),
    });
    expect(badPin.applications).toHaveLength(2);
    expect(badPin.contentionOverlay.status).toBe("unavailable");
    expect(badPin.applications.every((a) => a.officialContention === undefined)).toBe(true);
    expect(badPin.contentionOverlay.reason).toMatch(/pin|Application/i);

    // No exact-string fallback field
    for (const app of withContention.applications) {
      expect(Object.hasOwn(app as object, "contentionSet")).toBe(false);
    }
  });

  it("26-27 — 1.1 browser projection unchanged; NOT_PUBLISHED keeps 2.x inactive (rehearsal)", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_1_1);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    expect(payload.payloadVersion).toBe(REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION);
    expect(payload.applications).toHaveLength(100);
    expect(payload.applications[0]).toHaveProperty("organization");

    const v2 = buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    const resolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, v2);
    expect(resolution.mode).toBe("rehearsal");
    expect(resolution.selectionReason).toBe("claim-not-promoted");
    expect(resolution.document?.applications[0]?.id).toBe(rehearsalFixture.applications[0]?.id);

    expect(() =>
      buildBrowserApplicationPayloadFromPublication({
        ...(publication as object),
        schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
      } as never),
    ).toThrow(/2\.0\.0 cannot be projected through the 1\.1 browser builder/);
  });

  it("28 — Saved/Briefings do not silently accept incompatible 2.x shape", () => {
    const v2 = buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    expect(() => assertDocumentCompatibleWithBriefingsOrSaved(v2)).toThrow(/not compatible with Saved\/Briefings/);
  });

  it("29 — Compare remains gated according to eligibility", () => {
    expect(hubCompareDimensionAllowsComparableValue("participation-status-identity")).toBe(false);
    const promoted: ClaimActualityState = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY",
    };
    expect(
      resolveMetricEligibilityWithActuality("organization-round-count", promoted)?.comparisonAllowed,
    ).toBe(false);
    expect(
      resolveMetricEligibilityWithActuality("unique-applied-strings", promoted)?.comparisonAllowed,
    ).toBe(false);
  });

  it("31-32 — zero claim-actuality / promotion mutation from inactive projection", async () => {
    const dir = await mkdtemp(join(tmpdir(), "browser-2x-"));
    const statePath = join(dir, "claim-actuality-state.json");
    await writeFile(statePath, `${JSON.stringify(DEFAULT_CLAIM_ACTUALITY_STATE, null, 2)}\n`);
    const before = await readClaimActualityState(statePath);
    buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    const after = await readClaimActualityState(statePath);
    expect(after).toEqual(before);
    expect(after.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
  });

  it("Data Health metadata exposes coverage and contention pin state", () => {
    const doc = buildBrowserApplicationPayloadFromPublicationV2(makePublication());
    const meta = dataHealthMetadataFromBrowserV2(doc);
    expect(meta.officialApplications).toBe(3);
    expect(meta.observedApplicationRecords).toBe(2);
    expect(meta.coverageCompleteness).toBe("partial");
    expect(meta.knownExcludedApplicationIds).toContain("WDO2627T-T45217");
    expect(meta.contentionOverlayStatus).toBe("unavailable");
    expect(meta.payloadMode).toBe("inactive-2x");
  });
});

describe("inactive real-source 2.x browser projection", () => {
  it("30 — dry/inactive real-source projection succeeds with honest counts", async () => {
    if (!(await revealPresent())) return;

    try {
      const active = JSON.parse(await readFile(DEFAULT_STATE, "utf8")) as ClaimActualityState;
      expect(active.round2026ApplicationActuality).not.toBe("REAL_SOURCE_READY");
    } catch {
      // absent = not promoted
    }

    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const contention = await loadContentionMembershipFromPath(REVEAL_CONTENTION);

    const withoutContention = buildBrowserApplicationPayloadFromPublicationV2(publication);
    expect(withoutContention.applications).toHaveLength(1614);
    expect(withoutContention.observedApplicationRecords).toBe(1614);
    expect(withoutContention.officialApplications).toBe(1615);
    expect(withoutContention.officialApplicants).toBe(481);
    expect(withoutContention.applicationRecordCoverage.completeness).toBe("partial");
    expect(withoutContention.knownExcludedRecords.map((r) => r.applicationId)).toContain("WDO2627T-T45217");
    expect(withoutContention.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);
    expect(withoutContention.contentionOverlay.status).toBe("unavailable");

    for (const app of withoutContention.applications.slice(0, 25)) {
      const raw = app as unknown as Record<string, unknown>;
      for (const key of FORBIDDEN_BROWSER_V2_APPLICATION_KEYS) {
        expect(Object.hasOwn(raw, key)).toBe(false);
      }
    }

    const withContention = buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
    expect(withContention.applications).toHaveLength(1614);
    expect(withContention.contentionOverlay.status).toBe("available");
    expect(withContention.contentionOverlay.officialContentionSetCount).toBe(263);
    expect(withContention.contentionOverlay.joinedMemberCount).toBe(891);
    expect(
      withContention.applications.filter((a) => a.officialContention?.membershipPresent).length,
    ).toBe(891);

    const serializedBytes = Buffer.byteLength(JSON.stringify(withContention), "utf8");
    expect(serializedBytes).toBeGreaterThan(100_000);
    // Not embedded into the main JS bundle by this ticket — inactive artifact only.
    expect(withContention.payloadMode).toBe("inactive-2x");

    const activeResolution = resolveActiveRegistryApplicationsDocument(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      withContention,
    );
    expect(activeResolution.mode).toBe("rehearsal");
    expect(activeResolution.selectionReason).toBe("claim-not-promoted");

    const contentionActuality: ContentionActualityState = {
      ...DEFAULT_CONTENTION_ACTUALITY_STATE,
      round2026ContentionActuality: "REAL_SOURCE_READY",
      snapshotId: contention.snapshotId,
      sidecarContentHash: withContention.contentionOverlay.sidecarContentSha256,
      rawSha256: withContention.contentionOverlay.rawSha256,
      applicationPublicationPinHash: withContention.contentionOverlay.applicationPublicationPinHash,
    };
    const appActuality: ClaimActualityState = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY",
      snapshotId: withContention.snapshotId,
      snapshotContentHash: withContention.snapshotContentHash,
      rawSha256: withContention.rawSha256,
    };
    expect(
      resolveMetricEligibilityWithActuality("initial-contention-sets", appActuality, contentionActuality)
        ?.claimReadiness.round2026,
    ).toBe("REAL_SOURCE_READY");
    expect(
      resolveMetricEligibilityWithActuality("initial-contention-sets", appActuality)
        ?.claimReadiness.round2026,
    ).toBe("NOT_PUBLISHED");
  });
});
