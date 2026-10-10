import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "../normalization/hashes";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  evaluateApplicationActualityPromotion,
  resolveMetricEligibilityWithActuality,
} from "./claim-actuality";
import { readClaimActualityState } from "./claim-actuality-persistence";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  contentionSidecarHashInput,
  type ContentionMembershipSnapshotV1,
} from "./contention-membership-types";
import { runDryRunIngestion } from "./dry-run";
import { evaluateHumanApprovals } from "./human-approval";
import {
  evaluateApplicationPublicationV2PromotionCandidate,
  evaluateContentionMembershipPromotionCandidate,
  refuseActualApplicationV2Promotion,
  runRevealDayPromotion2xDryRun,
  PROMOTION_CONTRACT_2X_VERSION,
  type ApplicationV2PromotionExpectedPins,
  type ContentionPromotionExpectedPins,
} from "./promotion-contract-2x";
import {
  loadContentionMembershipFromPath,
  loadPublicationV2FromPath,
} from "./promotion-contract-2x-io";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "./publication-v2-types";
import {
  NORMALIZER_VERSION,
  PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION_V11,
  type Registry2026PublicationSnapshot,
} from "./types";

const REVEAL_APP_PATH = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const REVEAL_CONTENTION_PATH = join(
  process.cwd(),
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
);
const DEFAULT_STATE = join(process.cwd(), ".data/reveal-2026/claim-actuality-state.json");

const EXPECTED_APP: ApplicationV2PromotionExpectedPins = {
  schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
  snapshotId: "snap-aps-2026-applications-reveal-day-v1",
  applicationGraphContentSha256: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
  rawSha256: "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b",
  officialAggregatesContentSha256: "5b986331ab1f1c9f46dd2148177bf380f48563d52ece03aebd5a4742df0f4abc",
  coverageDescriptorSha256: "d0b309f98e837df74dce602d9c44a3f327b16e65e4ac3ef35d8eb0d0606a04a9",
  normalizedApplicationRecordsObserved: 1614,
  officialApplicationCount: 1615,
  officialApplicantCount: 481,
  coverageCompleteness: "partial",
  knownExcludedApplicationIds: ["WDO2627T-T45217"],
};

const EXPECTED_CONTENTION: ContentionPromotionExpectedPins = {
  schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  snapshotId: "snap-aps-2026-contention-reveal-day-v1",
  sidecarContentSha256: "480b378bab0b4d643e86d9b967f91777dcab147566747df577b469cb209825e7",
  rawSha256: "86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf",
  applicationGraphContentSha256: EXPECTED_APP.applicationGraphContentSha256,
  officialContentionSetCount: 263,
  joinedMemberCount: 891,
};

async function revealArtifactsPresent(): Promise<boolean> {
  try {
    await access(REVEAL_APP_PATH);
    await access(REVEAL_CONTENTION_PATH);
    return true;
  } catch {
    return false;
  }
}

function stubApp(applicationId: string, label: string): Registry2026ApplicationV2 {
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

function makePartialPublication(opts?: {
  snapshotId?: string;
  observed?: number;
  official?: number;
  rawSha256?: string;
  excludeWdo?: boolean;
}): Registry2026PublicationV2 {
  const observed = opts?.observed ?? 2;
  const official = opts?.official ?? 3;
  const apps = Array.from({ length: observed }, (_, i) =>
    stubApp(`SYN${1000 + i}T-T${10001 + i}`, `string-${i}`),
  );
  return sealPublication({
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publicationKind: "immutable-publication",
    snapshotId: opts?.snapshotId ?? "snap-synthetic-promotion-candidate",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    parserVersion: "aps-2026-application-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-application-csv-normalizer/1.0.0",
    source: { name: "synthetic", url: "https://example.test/apps.csv", evidenceClass: "synthetic" },
    limitations: ["synthetic promotion-contract fixture"],
    officialAggregates: {
      officialApplicationCount: official,
      officialApplicantCount: official,
      provenance: {
        sourceName: "synthetic stats",
        sourceUrl: "https://example.test/stats",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    },
    coverage: {
      sourceRowCount: observed,
      normalizedApplicationRecordsObserved: observed,
      applicationRecordCoverage: {
        observed,
        official,
        completeness: observed < official ? "partial" : "complete",
        knownExcludedRecords: opts?.excludeWdo === false
          ? []
          : observed < official
          ? [{
              applicationId: "WDO2627T-T45217",
              primaryString: "wdo",
              applicant: "World Data Organization",
              location: "CN",
              region: "AP",
              applicationStatus: "Undergoing administrative check",
              sourceUrl: "https://example.test/wdo",
              retrievedAt: "2026-10-08T00:00:00Z",
              notes: "coverage exclusion",
            }]
          : [],
      },
    },
    lineage: {
      intakeAdapterVersion: "aps-2026-application-csv-parser/1.0.0",
      artifactRole: "aps-2026-application-export",
      rawSha256: opts?.rawSha256 ?? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pipelineSourceId: "synthetic",
      pipelineSourceVersion: 1,
      manifestAttemptId: "capture-synthetic",
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

function makeContention(
  applicationGraphContentSha256: string,
  opts?: {
    snapshotId?: string;
    rawSha256?: string;
    mutateSemantic?: boolean;
  },
): ContentionMembershipSnapshotV1 {
  const draft: ContentionMembershipSnapshotV1 = {
    schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
    snapshotKind: "official-contention-membership-sidecar",
    snapshotId: opts?.snapshotId ?? "snap-synthetic-contention",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    parserVersion: "aps-2026-contention-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-contention-csv-normalizer/1.0.0",
    source: { name: "synthetic contention", url: "https://example.test/contention.csv", evidenceClass: "synthetic" },
    limitations: ["synthetic"],
    lineage: {
      intakeAdapterVersion: "aps-2026-contention-csv-parser/1.0.0",
      artifactRole: "aps-2026-reveal-day-contention-export",
      rawSha256: opts?.rawSha256 ?? "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      pipelineSourceId: "synthetic-contention",
      pipelineSourceVersion: 1,
      manifestAttemptId: "capture-contention",
      fetchUrl: "https://example.test/contention.csv",
      retrievedAt: "2026-10-08T00:00:00Z",
      httpStatus: 200,
      adapterId: "local-artifact",
      adapterSchemaVersion: "local-artifact-adapter/1.0.0",
      redirectChain: [],
      responseHeaderDigest: null,
    },
    applicationPublicationPin: {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
      snapshotId: "snap-synthetic-promotion-candidate",
      applicationGraphContentSha256,
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
            appliedForStringsAsPublished: "string-0",
            sourceRowIndex: opts?.mutateSemantic ? 99 : 1,
          },
          {
            applicationId: "SYN1001T-T10002",
            publishedOrgName: "Org B",
            appliedForStringsAsPublished: "string-1",
            sourceRowIndex: 2,
          },
        ],
      },
    ],
    bundleManifest: {
      rawSourceSha256: opts?.rawSha256 ?? "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      sidecarContentSha256: "",
      applicationPublicationPinSha256: contentHash({ applicationGraphContentSha256 }),
    },
  };
  draft.bundleManifest.sidecarContentSha256 = contentHash(contentionSidecarHashInput(draft));
  return draft;
}

describe("promotion contract 2x — Application candidate", () => {
  it("1 — valid Application 2.0 promotion candidate accepted", () => {
    const publication = makePartialPublication({ excludeWdo: true });
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication);
    expect(result.status).toBe("PROMOTABLE");
    expect(result.actualityIfApplied).toBe("REAL_SOURCE_READY");
    expect(result.requiresApplicationsLengthEqualsOfficial).toBe(false);
  });

  it("2 — wrong Application content hash rejected", () => {
    const publication = makePartialPublication();
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      applicationGraphContentSha256: "0".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /content hash rejected/i.test(e))).toBe(true);
  });

  it("3 — wrong Application raw SHA rejected", () => {
    const publication = makePartialPublication();
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      rawSha256: "1".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /raw SHA rejected/i.test(e))).toBe(true);
  });

  it("4 — wrong aggregate pin rejected", () => {
    const publication = makePartialPublication();
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      officialAggregatesContentSha256: "2".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /aggregate pin rejected/i.test(e))).toBe(true);
  });

  it("5 — wrong coverage pin rejected", () => {
    const publication = makePartialPublication();
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      coverageDescriptorSha256: "3".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /coverage pin rejected/i.test(e))).toBe(true);
  });

  it("6 — wrong snapshot ID rejected", () => {
    const publication = makePartialPublication({ snapshotId: "snap-wrong" });
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      snapshotId: "snap-expected",
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /snapshotId mismatch/i.test(e))).toBe(true);
  });

  it("7 — partial 1614/1615 coverage accepted as declared partial (synthetic shape)", () => {
    const publication = makePartialPublication({ observed: 2, official: 3, excludeWdo: true });
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication, {
      normalizedApplicationRecordsObserved: 2,
      officialApplicationCount: 3,
      coverageCompleteness: "partial",
      knownExcludedApplicationIds: ["WDO2627T-T45217"],
    });
    expect(result.status).toBe("PROMOTABLE");
    expect(result.coverage.completeness).toBe("partial");
    expect(result.coverage.observed).toBe(2);
    expect(result.coverage.official).toBe(3);
  });

  it("8 — no applications.length == official count requirement", () => {
    const publication = makePartialPublication({ observed: 2, official: 3 });
    const result = evaluateApplicationPublicationV2PromotionCandidate(publication);
    expect(result.requiresApplicationsLengthEqualsOfficial).toBe(false);
    expect(result.status).toBe("PROMOTABLE");
    expect(publication.applications.length).not.toBe(publication.officialAggregates.officialApplicationCount);
  });
});

describe("promotion contract 2x — metric interaction after Application actuality", () => {
  it("9-13 — Application REAL does not unlock unique/org/returning/category; aggregates remain channel-backed", () => {
    const publication = makePartialPublication();
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.summary.uniqueStrings).toBe("STILL_BLOCKED");
    expect(report.summary.organizations).toBe("STILL_BLOCKED");
    expect(report.summary.returningNew).toBe("STILL_BLOCKED");
    expect(report.summary.category).toBe("STILL_BLOCKED");

    const appState = report.application.nextStateIfApplied!;
    expect(appState.round2026ApplicationActuality).toBe("REAL_SOURCE_READY");

    const apps = resolveMetricEligibilityWithActuality("application-count", appState);
    expect(apps?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(apps?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");

    const unique = resolveMetricEligibilityWithActuality("unique-applied-strings", appState);
    expect(unique?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(unique?.methodReadiness).toBe("BLOCKED_COVERAGE");

    for (const id of [
      "organization-round-count",
      "returning-participant-identity",
      "category-mix",
      "exact-applied-string-competition",
    ] as const) {
      const resolved = resolveMetricEligibilityWithActuality(id, appState);
      expect(resolved?.claimReadiness.round2026).not.toBe("REAL_SOURCE_READY");
      expect(resolved?.comparisonAllowed).toBe(false);
    }

    const idn = resolveMetricEligibilityWithActuality("idn-applications", appState);
    expect(idn?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(idn?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
  });
});

describe("promotion contract 2x — contention independence", () => {
  it("14 — valid contention candidate accepted independently", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const contention = makeContention(appHash);
    const result = evaluateContentionMembershipPromotionCandidate(contention, appHash);
    expect(result.status).toBe("PROMOTABLE");
    expect(result.actualityIfApplied).toBe("REAL_SOURCE_READY");
  });

  it("15 — Application actuality alone does not activate contention", () => {
    const publication = makePartialPublication();
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.contention).toBeNull();
    const appState = report.application.nextStateIfApplied!;
    const sets = resolveMetricEligibilityWithActuality("initial-contention-sets", appState);
    expect(sets?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
  });

  it("16 — wrong contention semantic hash rejected", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const contention = makeContention(appHash);
    const result = evaluateContentionMembershipPromotionCandidate(contention, appHash, {
      sidecarContentSha256: "4".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /semantic hash rejected/i.test(e))).toBe(true);
  });

  it("17 — wrong contention raw SHA rejected", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const contention = makeContention(appHash);
    const result = evaluateContentionMembershipPromotionCandidate(contention, appHash, {
      rawSha256: "5".repeat(64),
    });
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /raw SHA rejected/i.test(e))).toBe(true);
  });

  it("18 — wrong contention Application pin rejected", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const contention = makeContention(appHash);
    const result = evaluateContentionMembershipPromotionCandidate(contention, "6".repeat(64));
    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => /Application pin rejected/i.test(e))).toBe(true);
  });

  it("19 — contention rejection does not invalidate Application candidate", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const badContention = makeContention(appHash);
    const report = runRevealDayPromotion2xDryRun({
      publication,
      contention: badContention,
      expectedContention: { sidecarContentSha256: "7".repeat(64) },
    });
    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.contention?.status).toBe("REJECTED");
    expect(report.applicationIndependentOfContention).toBe(true);
  });

  it("20 — valid Application-only candidate allowed", () => {
    const publication = makePartialPublication();
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.summary.contention).toBe("ABSENT");
  });

  it("21 — valid Application + contention candidate allowed", () => {
    const publication = makePartialPublication();
    const appHash = publication.bundleManifest.applicationGraphContentSha256;
    const contention = makeContention(appHash);
    const report = runRevealDayPromotion2xDryRun({ publication, contention });
    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.contention?.status).toBe("PROMOTABLE");
  });
});

describe("promotion contract 2x — dry-run mutation + 1.1 compatibility", () => {
  it("22 — dry-run causes zero active-state mutation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "promo-2x-"));
    const statePath = join(dir, "claim-actuality-state.json");
    await writeFile(statePath, `${JSON.stringify(DEFAULT_CLAIM_ACTUALITY_STATE, null, 2)}\n`);
    const before = await readClaimActualityState(statePath);
    const publication = makePartialPublication();
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    expect(report.activeStateMutation).toBe(false);
    expect(report.actualPromotionPerformed).toBe(false);
    expect(report.browserProjectionGenerated).toBe(false);
    const after = await readClaimActualityState(statePath);
    expect(after).toEqual(before);
    expect(after.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
  });

  it("23 — existing 1.1 valid candidate remains supported", () => {
    const applications = Array.from({ length: 100 }, (_, i) => ({
      id: `APP-${90000 + i}`,
      string: `str${i}`,
      applicant: `Applicant ${i} LLC`,
      organization: `Org ${i}`,
      country: "US",
      region: "North America",
      category: "Technology",
      type: "Generic",
      returning: false,
      idn: false,
      replacement: null,
      contentionSet: null,
      confidence: 1,
    }));
    const withLineage: Registry2026PublicationSnapshot = {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
      publicationKind: "immutable-publication",
      snapshotId: "snap-immutable-1-1-compat",
      publishedAt: "2026-06-01T12:00:00Z",
      retrievedAt: "2026-06-01T12:05:00Z",
      parserVersion: PARSER_VERSION,
      normalizerVersion: NORMALIZER_VERSION,
      source: { name: "ICANN", url: "https://newgtldprogram.icann.org/", evidenceClass: "authoritative" },
      limitations: [],
      applications,
      lineage: {
        intakeAdapterVersion: "registry-2026-intake-adapter/1.0.0",
        wireSchemaVersion: "registry-2026-intake-wire/1.0.0",
        rawSha256: "a".repeat(64),
        pipelineSourceId: "icann-2026-reveal-day-drill-ndjson",
        pipelineSourceVersion: 1,
        manifestAttemptId: "attempt-test",
        fetchUrl: "https://example.com/drill.ndjson",
        retrievedAt: "2026-06-01T12:05:00Z",
        httpStatus: 200,
        adapterId: "fixture",
        adapterSchemaVersion: "fixture-adapter/1.0.0",
        redirectChain: [],
        responseHeaderDigest: null,
      },
    };
    const diagnostics = runDryRunIngestion(withLineage);
    const result = evaluateApplicationActualityPromotion(
      withLineage,
      diagnostics,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "stew-1", productApprovalId: "prod-1" }),
    );
    expect(result.errors, result.errors.join("\n")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.nextState.round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
    expect(result.errors.join("\n")).not.toMatch(/dry-run-promotion-2x|2\.0\.0/);
  });

  it("24 — existing 1.1 fail-closed behavior remains supported", () => {
    const snap: Registry2026PublicationSnapshot = {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
      publicationKind: "immutable-publication",
      snapshotId: "snap-no-lineage",
      publishedAt: "2026-01-01T00:00:00Z",
      retrievedAt: "2026-01-01T00:00:00Z",
      parserVersion: PARSER_VERSION,
      normalizerVersion: NORMALIZER_VERSION,
      source: { name: "test", url: "https://example.test", evidenceClass: "test" },
      limitations: [],
      applications: Array.from({ length: 100 }, (_, i) => ({
        id: `APP-${i}`,
        string: `s${i}`,
        applicant: `A${i}`,
        organization: `O${i}`,
        country: "US",
        region: "NA",
        category: "x",
        type: "Generic",
        returning: false,
        idn: false,
        replacement: null,
        contentionSet: null,
        confidence: 1,
      })),
    };
    const diagnostics = runDryRunIngestion(snap);
    const result = evaluateApplicationActualityPromotion(
      snap,
      diagnostics,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "stew-1", productApprovalId: "prod-1" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /lineage/i.test(e))).toBe(true);
  });

  it("25 — claim/eligibility regression: Application REAL leaves unique strings blocked", () => {
    const publication = makePartialPublication();
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    const state = report.application.nextStateIfApplied!;
    expect(resolveMetricEligibilityWithActuality("unique-applied-strings", state)?.claimReadiness.round2026)
      .toBe("NOT_PUBLISHED");
    expect(resolveMetricEligibilityWithActuality("application-count", state)?.sourceChannel)
      .toBe("OFFICIAL_AGGREGATE");
  });
});

describe("promotion contract 2x — Reveal Day artifacts (when present)", () => {
  it("accepted Reveal Day Application + contention dry-run is PROMOTABLE without mutation", async () => {
    if (!(await revealArtifactsPresent())) return;

    try {
      const active = await readFile(DEFAULT_STATE, "utf8");
      expect(JSON.parse(active).round2026ApplicationActuality).not.toBe("REAL_SOURCE_READY");
    } catch {
      // absent state file = not promoted
    }

    const publication = await loadPublicationV2FromPath(REVEAL_APP_PATH);
    const contention = await loadContentionMembershipFromPath(REVEAL_CONTENTION_PATH);
    const report = runRevealDayPromotion2xDryRun({
      publication,
      contention,
      expectedApplication: EXPECTED_APP,
      expectedContention: EXPECTED_CONTENTION,
    });

    expect(report.application.status).toBe("PROMOTABLE");
    expect(report.application.actualityIfApplied).toBe("REAL_SOURCE_READY");
    expect(report.application.coverage).toMatchObject({
      observed: 1614,
      official: 1615,
      completeness: "partial",
    });
    expect(report.application.coverage.knownExcludedApplicationIds).toContain("WDO2627T-T45217");
    expect(report.contention?.status).toBe("PROMOTABLE");
    expect(report.contention?.actualityIfApplied).toBe("REAL_SOURCE_READY");
    expect(report.summary.uniqueStrings).toBe("STILL_BLOCKED");
    expect(report.summary.organizations).toBe("STILL_BLOCKED");
    expect(report.summary.returningNew).toBe("STILL_BLOCKED");
    expect(report.summary.category).toBe("STILL_BLOCKED");
    expect(report.actualPromotionPerformed).toBe(false);
    expect(report.activeStateMutation).toBe(false);
    expect(report.browserProjectionGenerated).toBe(false);

    // Application-only still PROMOTABLE with same artifact
    const appOnly = runRevealDayPromotion2xDryRun({
      publication,
      applicationOnly: true,
      expectedApplication: EXPECTED_APP,
    });
    expect(appOnly.application.status).toBe("PROMOTABLE");
    expect(appOnly.summary.contention).toBe("ABSENT");
  });
});
