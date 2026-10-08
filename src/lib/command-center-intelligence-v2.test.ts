import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2026_ORIENTATION_AGGREGATES } from "@/comparison/approved-2026-orientation-aggregates";
import {
  buildCommandCenterIntelligenceV2,
  deriveOfficialContentionSetSizeStats,
} from "@/lib/command-center-intelligence-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";

function emptyLabels() {
  return {
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
  };
}

function app(
  id: string,
  opts?: {
    setIds?: string[];
    replacement?: boolean;
  },
): RegistryApplicationsDocumentV2["applications"][number] {
  const setIds = opts?.setIds ?? [];
  return {
    applicationId: id,
    applicant: `Applicant ${id}`,
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
    labels: emptyLabels(),
    appliedString: { sourceRowId: id, label: id.toLowerCase() },
    ...(opts?.replacement
      ? {
          replacementString: {
            sourceRowId: `${id}-R`,
            label: `${id}-r`,
            applicationStatus: "Withdrawn",
            processingStage: "N/A",
            applicationType: "Standard",
          },
        }
      : {}),
    officialContention:
      setIds.length > 0
        ? {
            membershipPresent: true,
            officialContentionSetIds: setIds,
            terminology: "official-initial-contention",
          }
        : {
            membershipPresent: false,
            officialContentionSetIds: [],
            terminology: "official-initial-contention",
          },
  };
}

function makeDocument(opts?: {
  contentionAvailable?: boolean;
  officialApps?: number;
  observed?: number;
}): RegistryApplicationsDocumentV2 {
  const contentionAvailable = opts?.contentionAvailable !== false;
  const applications = [
    app("A1", { setIds: ["1"], replacement: true }),
    app("A2", { setIds: ["1"] }),
    app("A3", { setIds: ["1"] }),
    app("B1", { setIds: ["2"] }),
    app("C1"),
  ];
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "promoted-2026",
    snapshotId: "snap-aps-2026-applications-reveal-day-v1",
    snapshotContentHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: "2026-10-07T15:41:26.522Z",
    retrievedAt: "2026-10-08T04:12:50Z",
    checkedAt: "2026-10-08T11:00:00Z",
    parserVersion: "aps-2026-application-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-application-csv-normalizer/1.0.0",
    source: {
      name: "ICANN APS",
      url: "https://example.test",
      evidenceClass: "authoritative",
    },
    limitations: [],
    disclosureKeys: ["not-official-round-total"],
    officialAggregates: {
      officialApplicationCount: opts?.officialApps ?? 1615,
      officialApplicantCount: 481,
      provenance: {
        sourceName: "ICANN APS Statistics",
        sourceUrl: "https://example.test/stats",
        retrievedAt: "2026-10-08T04:12:50Z",
        contentSha256: "5b986331ab1f1c9f46dd2148177bf380f48563d52ece03aebd5a4742df0f4abc",
      },
    },
    applicationRecordCoverage: {
      observed: opts?.observed ?? 1614,
      official: opts?.officialApps ?? 1615,
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
          retrievedAt: "2026-10-08T04:12:50Z",
          notes: "coverage exclusion only",
        },
      ],
    },
    officialApplications: opts?.officialApps ?? 1615,
    observedApplicationRecords: opts?.observed ?? 1614,
    officialApplicants: 481,
    knownExcludedRecords: [
      {
        applicationId: "WDO2627T-T45217",
        primaryString: "wdo",
        applicant: "World Data Organization",
        location: "CN",
        region: "AP",
        applicationStatus: "Undergoing administrative check",
        sourceUrl: "https://example.test/wdo",
        retrievedAt: "2026-10-08T04:12:50Z",
        notes: "coverage exclusion only",
      },
    ],
    bundleManifest: {
      officialAggregatesContentSha256: "5".repeat(64),
      coverageDescriptorSha256: "d".repeat(64),
      applicationGraphContentSha256: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    },
    rawSha256: "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b",
    contentionOverlay: contentionAvailable
      ? {
          status: "available",
          schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
          snapshotId: "snap-aps-2026-contention-reveal-day-v1",
          sidecarContentSha256: "480b378bab0b4d643e86d9b967f91777dcab147566747df577b469cb209825e7",
          rawSha256: "86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf",
          applicationPublicationPinHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
          officialContentionSetCount: 263,
          joinedMemberCount: 891,
        }
      : {
          status: "unavailable",
          schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
          snapshotId: null,
          sidecarContentSha256: null,
          rawSha256: null,
          applicationPublicationPinHash: null,
          officialContentionSetCount: null,
          joinedMemberCount: null,
          reason: "pin mismatch",
        },
    applications,
  };
}

function promotedClaim(): ClaimActualityState {
  return {
    ...DEFAULT_CLAIM_ACTUALITY_STATE,
    round2026ApplicationActuality: "REAL_SOURCE_READY",
    promotedAt: "2026-10-08T11:15:41.522Z",
    snapshotId: "snap-aps-2026-applications-reveal-day-v1",
    snapshotContentHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    rawSha256: "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b",
    stewardApprovalId: "stew",
    productApprovalId: "prod",
    promotionGates: {
      snapshotValidated: true,
      parserPassed: true,
      normalizationPassed: true,
      provenanceRecorded: true,
      validationPassed: true,
      contaminationClear: true,
    },
  };
}

describe("buildCommandCenterIntelligenceV2", () => {
  it("uses official 1615 / 481 for round posture — never observed 1614 as Application headline", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(vm.roundPosture.officialApplications).toBe(1615);
    expect(vm.roundPosture.officialApplicants).toBe(481);
    expect(vm.roundPosture.officialApplications).not.toBe(vm.coverage.observedApplicationRecords);
    expect(vm.coverage.observedApplicationRecords).toBe(1614);
    expect(vm.roundPosture.applicationsSource).toBe("official-aggregate");
  });

  it("surfaces official initial contention 263 / 891 when overlay available", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument({ contentionAvailable: true }),
      claimActuality: promotedClaim(),
    });
    expect(vm.competitiveStructure.status).toBe("available");
    if (vm.competitiveStructure.status !== "available") throw new Error("expected available");
    expect(vm.competitiveStructure.setCount).toBe(263);
    expect(vm.competitiveStructure.membershipCount).toBe(891);
    expect(vm.competitiveStructure.terminology).toBe("official-initial-contention");
    expect(vm.competitiveStructure.notExactStringGrouping).toBe(true);
    expect(vm.competitiveStructure.mayChangeLater).toBe(true);
    expect(vm.roundPosture.officialContentionSets).toBe(263);
    expect(vm.roundPosture.officialContentionMemberships).toBe(891);
  });

  it("fails closed contention independently without breaking Application posture", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument({ contentionAvailable: false }),
      claimActuality: promotedClaim(),
    });
    expect(vm.roundPosture.officialApplications).toBe(1615);
    expect(vm.competitiveStructure.status).toBe("unavailable");
    expect(vm.roundPosture.officialContentionSets).toBeNull();
    expect(vm.crossRound.applications?.active2026).toBe(1615);
  });

  it("derives Applications and IDN cross-round deltas from source values", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(vm.crossRound.applications).toEqual(
      expect.objectContaining({
        baseline2012: APPROVED_2012_BASELINE.applications,
        active2026: 1615,
        difference: 1615 - APPROVED_2012_BASELINE.applications,
      }),
    );
    expect(vm.crossRound.idn).toEqual(
      expect.objectContaining({
        baseline2012: APPROVED_2012_BASELINE.idnApplications,
        active2026: APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications,
        difference:
          APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications
          - APPROVED_2012_BASELINE.idnApplications,
      }),
    );
  });

  it("omits blocked cross-round comparisons", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(vm.crossRound.omittedBlocked).toEqual(
      expect.arrayContaining([
        "unique-applied-strings",
        "community-applications",
        "geographic-applications",
        "initial-contention-sets",
        "organization-round-count",
        "returning-participant-identity",
        "category-mix",
      ]),
    );
  });

  it("preserves designation semantics and replacement relationship grain", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(vm.roundComposition).not.toBeNull();
    expect(vm.roundComposition?.idn.value).toBe(21);
    expect(vm.roundComposition?.brand.value).toBe(333);
    expect(vm.roundComposition?.community.value).toBe(16);
    expect(vm.roundComposition?.geographic.selfIdentified).toBe(true);
    expect(vm.roundComposition?.geographic.value).toBe(15);
    expect(vm.roundComposition?.variants.value).toBe(9);
    expect(vm.roundComposition?.replacements.relationshipGrain).toBe(true);
    expect(vm.roundComposition?.replacements.value).toBe(1);
  });

  it("keeps WDO as coverage metadata only", () => {
    const doc = makeDocument();
    const vm = buildCommandCenterIntelligenceV2({
      document: doc,
      claimActuality: promotedClaim(),
    });
    expect(vm.coverage.knownExcludedCount).toBe(1);
    expect(vm.coverage.knownExcludedIsCoverageMetadataOnly).toBe(true);
    expect(doc.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);
    expect(doc.knownExcludedRecords[0]?.applicationId).toBe("WDO2627T-T45217");
  });

  it("derives set-size stats from official overlay membership only", () => {
    const doc = makeDocument();
    const stats = deriveOfficialContentionSetSizeStats(doc);
    expect(stats.largestSetSize).toBe(3);
    expect(stats.setSizeDistribution).toEqual(
      expect.arrayContaining([
        { size: 3, setCount: 1 },
        { size: 1, setCount: 1 },
      ]),
    );
  });

  it("does not emit cross-round when Application actuality is NOT_PUBLISHED", () => {
    const vm = buildCommandCenterIntelligenceV2({
      document: makeDocument(),
      claimActuality: DEFAULT_CLAIM_ACTUALITY_STATE,
    });
    expect(vm.crossRound.applications).toBeNull();
    expect(vm.crossRound.idn).toBeNull();
    expect(vm.roundComposition).toBeNull();
  });
});
