import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2026_ORIENTATION_AGGREGATES } from "@/comparison/approved-2026-orientation-aggregates";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import {
  buildCrossRoundStructuralIntelligence,
  compatibilityStatusFor,
  CONFIRMED_RETURNING_ORGANIZATION_FACTS,
  CROSS_ROUND_COMPATIBILITY_MATRIX,
  crossRoundStructuralHref,
} from "@/lib/cross-round-structural-intelligence";

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

function makeDocument(apps: Array<{ id: string; applicant: string }> = [
  { id: "A1", applicant: "Alpha LLC" },
  { id: "A2", applicant: "Beta Inc" },
]): RegistryApplicationsDocumentV2 {
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
    source: { name: "ICANN APS", url: "https://example.test", evidenceClass: "authoritative" },
    limitations: [],
    disclosureKeys: ["not-official-round-total"],
    officialAggregates: {
      officialApplicationCount: 1615,
      officialApplicantCount: 481,
      provenance: {
        sourceName: "ICANN APS Statistics",
        sourceUrl: "https://example.test/stats",
        retrievedAt: "2026-10-08T04:12:50Z",
        contentSha256: "5".repeat(64),
      },
    },
    applicationRecordCoverage: {
      observed: 1614,
      official: 1615,
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
    officialApplications: 1615,
    observedApplicationRecords: 1614,
    officialApplicants: 481,
    knownExcludedRecords: [],
    bundleManifest: {
      officialAggregatesContentSha256: "5".repeat(64),
      coverageDescriptorSha256: "d".repeat(64),
      applicationGraphContentSha256: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    },
    rawSha256: "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b",
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "snap-aps-2026-contention-reveal-day-v1",
      sidecarContentSha256: "480b378bab0b4d643e86d9b967f91777dcab147566747df577b469cb209825e7",
      rawSha256: "86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf",
      applicationPublicationPinHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
      officialContentionSetCount: 263,
      joinedMemberCount: 891,
    },
    applications: apps.map((a) => ({
      applicationId: a.id,
      appliedForString: "x",
      applicant: a.applicant,
      applicationStatus: "Active",
      location: null,
      region: null,
      brand: false,
      community: false,
      geographic: false,
      idn: false,
      variant: false,
      replacementString: null,
      officialContention: null,
    })),
  } as unknown as RegistryApplicationsDocumentV2;
}

describe("CROSS-ROUND-STRUCT-1 compatibility matrix", () => {
  it("pins Applications and IDN as DIRECTLY_COMPARABLE", () => {
    expect(compatibilityStatusFor("applications")).toBe("DIRECTLY_COMPARABLE");
    expect(compatibilityStatusFor("idn-applications")).toBe("DIRECTLY_COMPARABLE");
  });

  it("blocks contention, unique strings, Community, Geographic, Organization count", () => {
    expect(compatibilityStatusFor("contention")).toBe("BLOCKED");
    expect(compatibilityStatusFor("unique-applied-strings")).toBe("BLOCKED");
    expect(compatibilityStatusFor("community")).toBe("BLOCKED");
    expect(compatibilityStatusFor("geographic")).toBe("BLOCKED");
    expect(compatibilityStatusFor("organization-count")).toBe("BLOCKED");
    expect(compatibilityStatusFor("brand")).toBe("BLOCKED");
    expect(compatibilityStatusFor("applicant-legal-entities")).toBe("BLOCKED");
    expect(compatibilityStatusFor("regional-distribution")).toBe("BLOCKED");
  });

  it("does not treat contention as silently directly comparable", () => {
    const contention = CROSS_ROUND_COMPATIBILITY_MATRIX.find((r) => r.dimensionId === "contention")!;
    expect(contention.status).toBe("BLOCKED");
    expect(contention.reason).toMatch(/preliminary|initial|program-stage/i);
  });

  it("prohibits unmatched = new wording in matrix and returning scope", () => {
    const blob = JSON.stringify(CROSS_ROUND_COMPATIBILITY_MATRIX);
    expect(blob).toMatch(/unmatched ≠ new|unmatched != new/i);
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(intel.returningOrganizations.unmatchedIsNotNew).toMatch(/not labeled new/i);
    expect(JSON.stringify(intel)).not.toMatch(/"% of 2026 Organizations are new"/i);
  });
});

describe("CROSS-ROUND-STRUCT-1 metrics", () => {
  it("pins Applications 1930 → 1615 (−315) and IDN 116 → 21 (−95)", () => {
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    const apps = intel.confirmedComparisons.find((c) => c.id === "applications")!;
    const idn = intel.confirmedComparisons.find((c) => c.id === "idn-applications")!;
    expect(apps.value2012).toBe(APPROVED_2012_BASELINE.applications);
    expect(apps.value2012).toBe(1930);
    expect(apps.value2026).toBe(1615);
    expect(apps.delta).toBe(-315);
    expect(idn.value2012).toBe(116);
    expect(idn.value2026).toBe(APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications);
    expect(idn.value2026).toBe(21);
    expect(idn.delta).toBe(-95);
  });

  it("pins Microsoft / Google / confirmed-returning sample", () => {
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    const ms = intel.returningOrganizations.organizations.find((o) => o.displayName === "Microsoft")!;
    const google = intel.returningOrganizations.organizations.find((o) => o.displayName === "Google")!;
    expect(ms.applications2012).toBe(11);
    expect(ms.applications2026).toBe(2);
    expect(ms.delta).toBe(-9);
    expect(ms.profileHref).toContain("hist-2012-microsoft");
    expect(google.applications2012).toBe(101);
    expect(google.applications2026).toBe(39);
    expect(google.delta).toBe(-62);
    expect(intel.returningOrganizations.sample.applications2012).toBe(112);
    expect(intel.returningOrganizations.sample.applications2026).toBe(41);
    expect(intel.returningOrganizations.sample.delta).toBe(-71);
    expect(intel.returningOrganizations.sample.label).toMatch(/Confirmed returning Organization sample/i);
    expect(CONFIRMED_RETURNING_ORGANIZATION_FACTS).toHaveLength(2);
  });

  it("keeps official vs represented denominators distinct and discloses WDO", () => {
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(intel.coverage.officialApplications2026).toBe(1615);
    expect(intel.coverage.representedApplications2026).toBe(1614);
    expect(intel.coverage.officialApplicants2026).toBe(481);
    expect(intel.coverage.wdoDisclosure).toMatch(/1614 represented/);
    expect(intel.coverage.wdoDisclosure).toMatch(/1615 official/);
    expect(intel.confirmedComparisons.find((c) => c.id === "applications")!.value2026).toBe(1615);
    expect(intel.confirmedComparisons.find((c) => c.id === "applications")!.value2026).not.toBe(
      intel.coverage.representedApplications2026,
    );
  });

  it("does not invent Brand / Community / Geographic / contention deltas", () => {
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: promotedClaim(),
    });
    expect(intel.confirmedComparisons.map((c) => c.id)).toEqual(["applications", "idn-applications"]);
    expect(intel.blockedComparisons.some((b) => b.dimensionId === "contention")).toBe(true);
    expect(intel.blockedComparisons.some((b) => b.dimensionId === "community")).toBe(true);
    expect(intel.blockedComparisons.some((b) => b.dimensionId === "geographic")).toBe(true);
    expect(intel.blockedComparisons.some((b) => b.dimensionId === "brand")).toBe(true);
    expect(intel.participationShape.facts.some((f) => f.id === "brand-2026")).toBe(true);
    expect(intel.participationShape.note).toMatch(/not presented as 2012→2026 change/i);
  });

  it("withholds Applications/IDN when claim does not allow comparison", () => {
    const intel = buildCrossRoundStructuralIntelligence({
      document: makeDocument(),
      claimActuality: DEFAULT_CLAIM_ACTUALITY_STATE,
    });
    expect(intel.confirmedComparisons).toEqual([]);
    expect(intel.returningOrganizations.organizations).toHaveLength(2);
    expect(crossRoundStructuralHref()).toBe("/cross-round");
  });
});
