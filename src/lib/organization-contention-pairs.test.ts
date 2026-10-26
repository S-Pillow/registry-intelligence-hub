import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOrganizationContentionPairs,
  canonicalOrganizationPairKey,
  OrganizationContentionPairsError,
} from "@/lib/organization-contention-pairs";
import { buildOrganizationConcentration } from "@/lib/organization-concentration";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json",
);
const CONTENTION_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
);
const ORG_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/organization-resolution/organization-resolution-1.0.0.snapshot.json",
);

async function loadLive(): Promise<{
  document: RegistryApplicationsDocumentV2;
  orgSnapshot: OrganizationResolutionSnapshot;
}> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(
    await readFile(CONTENTION_PATH, "utf8"),
  ) as ContentionMembershipSnapshotV1;
  const orgSnapshot = JSON.parse(
    await readFile(ORG_PATH, "utf8"),
  ) as OrganizationResolutionSnapshot;
  const document = buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
  return { document, orgSnapshot };
}

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

function makeApp(
  id: string,
  applicant: string,
  sets: string[],
): RegistryApplicationsDocumentV2["applications"][number] {
  return {
    applicationId: id,
    applicant,
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    designations: {
      idn: false,
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    appliedString: { sourceRowId: id, label: id.toLowerCase() },
    officialContention:
      sets.length > 0
        ? {
            membershipPresent: true as const,
            officialContentionSetIds: sets,
            terminology: "official-initial-contention" as const,
          }
        : {
            membershipPresent: false as const,
            officialContentionSetIds: [] as [],
            terminology: "official-initial-contention" as const,
          },
  };
}

function syntheticOrgSnapshot(): OrganizationResolutionSnapshot {
  return {
    schemaVersion: "organization-resolution-2026/1.0.0",
    snapshotId: "synthetic-pairs",
    generatedAt: "2026-10-26T00:00:00Z",
    semanticContentSha256: "a".repeat(64),
    applicationPublicationPin: {
      applicationGraphContentSha256: "b".repeat(64),
      snapshotId: "synthetic",
    },
    organizations: [
      {
        organizationId: "organization:resolved-2026:org-a",
        organizationKey: "org-a",
        canonicalName: "Org A",
        status: "CONFIRMED",
        applicantLegalNames: ["Applicant A1", "Applicant A2"],
      },
      {
        organizationId: "organization:resolved-2026:org-b",
        organizationKey: "org-b",
        canonicalName: "Org B",
        status: "CONFIRMED",
        applicantLegalNames: ["Applicant B1"],
      },
      {
        organizationId: "organization:resolved-2026:org-c",
        organizationKey: "org-c",
        canonicalName: "Org C Candidate",
        status: "CANDIDATE",
        applicantLegalNames: ["Applicant C1"],
      },
    ],
    applicantIdentityMappings: [
      {
        applicantLegalName: "Applicant A1",
        resolutionState: "CONFIRMED",
        organizationId: "organization:resolved-2026:org-a",
      },
      {
        applicantLegalName: "Applicant A2",
        resolutionState: "CONFIRMED",
        organizationId: "organization:resolved-2026:org-a",
      },
      {
        applicantLegalName: "Applicant B1",
        resolutionState: "CONFIRMED",
        organizationId: "organization:resolved-2026:org-b",
      },
      {
        applicantLegalName: "Applicant C1",
        resolutionState: "CANDIDATE",
        organizationId: "organization:resolved-2026:org-c",
      },
      {
        applicantLegalName: "Applicant Ambiguous",
        resolutionState: "AMBIGUOUS",
        organizationId: null,
      },
      {
        applicantLegalName: "Applicant Unresolved",
        resolutionState: "UNRESOLVED",
        organizationId: null,
      },
    ],
  } as unknown as OrganizationResolutionSnapshot;
}

function syntheticDocument(
  applications: RegistryApplicationsDocumentV2["applications"],
  joinedMemberCount: number,
  setCount: number,
): RegistryApplicationsDocumentV2 {
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "promoted-2026",
    snapshotId: "synthetic-pairs",
    snapshotContentHash: "b".repeat(64),
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: "2026-10-07T15:41:26.522Z",
    retrievedAt: "2026-10-08T04:12:50Z",
    checkedAt: "2026-10-08T11:00:00Z",
    parserVersion: "test",
    normalizerVersion: "test",
    source: { name: "ICANN APS", url: "https://example.test", evidenceClass: "authoritative" },
    limitations: [],
    disclosureKeys: [],
    officialAggregates: {
      officialApplicationCount: applications.length,
      officialApplicantCount: 4,
      provenance: {
        sourceName: "test",
        sourceUrl: "https://example.test",
        retrievedAt: "2026-10-08T04:12:50Z",
        contentSha256: "c".repeat(64),
      },
    },
    applicationRecordCoverage: {
      observed: applications.length,
      official: applications.length,
      completeness: "partial",
      knownExcludedRecords: [],
    },
    officialApplications: applications.length,
    observedApplicationRecords: applications.length,
    officialApplicants: 4,
    knownExcludedRecords: [],
    bundleManifest: {
      officialAggregatesContentSha256: "c".repeat(64),
      coverageDescriptorSha256: "d".repeat(64),
      applicationGraphContentSha256: "b".repeat(64),
    },
    rawSha256: "e".repeat(64),
    applications,
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "contention-synthetic",
      sidecarContentSha256: "f".repeat(64),
      rawSha256: "1".repeat(64),
      applicationPublicationPinHash: "b".repeat(64),
      officialContentionSetCount: setCount,
      joinedMemberCount,
    },
  };
}

describe("canonicalOrganizationPairKey", () => {
  it("orders ids lexicographically and forbids self pairs", () => {
    const ab = canonicalOrganizationPairKey("org:b", "org:a");
    expect(ab.organizationAId).toBe("org:a");
    expect(ab.organizationBId).toBe("org:b");
    expect(ab.pairKey).toBe("org:a::org:b");
    expect(canonicalOrganizationPairKey("org:a", "org:b").pairKey).toBe(ab.pairKey);
    expect(() => canonicalOrganizationPairKey("org:a", "org:a")).toThrow(
      OrganizationContentionPairsError,
    );
  });
});

describe("ORG-CONTENTION-PAIRS-1 synthetic semantics", () => {
  it("separates sharedSetCount from membershipInteractions (2×3)+(1×2)=8", () => {
    const applications = [
      makeApp("A1", "Applicant A1", ["1"]),
      makeApp("A2", "Applicant A2", ["1"]),
      makeApp("B1", "Applicant B1", ["1"]),
      makeApp("B2", "Applicant B1", ["1"]), // second B membership via same applicant name — need distinct apps
      makeApp("B3", "Applicant B1", ["1"]),
      makeApp("A3", "Applicant A1", ["2"]),
      makeApp("B4", "Applicant B1", ["2"]),
      makeApp("B5", "Applicant B1", ["2"]),
    ];
    // Fix set1: A has 2 (A1,A2), B has 3 (B1,B2,B3). Set2: A has 1 (A3), B has 2 (B4,B5).
    const doc = syntheticDocument(applications, 8, 2);
    const model = buildOrganizationContentionPairs(doc, syntheticOrgSnapshot());
    expect(model.pairs).toHaveLength(1);
    expect(model.pairs[0]!.sharedSetCount).toBe(2);
    expect(model.pairs[0]!.membershipInteractions).toBe(8);
  });

  it("never creates self-pairs when one Confirmed Org has multiple Applicants in a set", () => {
    const applications = [
      makeApp("A1", "Applicant A1", ["9"]),
      makeApp("A2", "Applicant A2", ["9"]),
      makeApp("U1", "Applicant Unresolved", ["9"]),
    ];
    const doc = syntheticDocument(applications, 3, 1);
    const model = buildOrganizationContentionPairs(doc, syntheticOrgSnapshot());
    expect(model.pairs).toHaveLength(0);
    expect(model.coverage.confirmedContentionMemberships).toBe(2);
    expect(model.coverage.unresolvedContentionMemberships).toBe(1);
    expect(model.coverage.pairableOfficialSets).toBe(0);
  });

  it("excludes CANDIDATE / AMBIGUOUS / UNRESOLVED from pair endpoints", () => {
    const applications = [
      makeApp("A1", "Applicant A1", ["3"]),
      makeApp("B1", "Applicant B1", ["3"]),
      makeApp("C1", "Applicant C1", ["3"]),
      makeApp("AM1", "Applicant Ambiguous", ["3"]),
      makeApp("U1", "Applicant Unresolved", ["3"]),
    ];
    const doc = syntheticDocument(applications, 5, 1);
    const model = buildOrganizationContentionPairs(doc, syntheticOrgSnapshot());
    expect(model.pairs).toHaveLength(1);
    expect(model.pairs[0]!.organizationAKey).toBe("org-a");
    expect(model.pairs[0]!.organizationBKey).toBe("org-b");
    expect(model.coverage.candidateAmbiguousContentionMemberships).toBe(2);
    expect(model.coverage.unresolvedContentionMemberships).toBe(1);
    expect(
      model.pairs.some(
        (p) =>
          p.organizationAKey === "org-c" ||
          p.organizationBKey === "org-c" ||
          /unknown|unresolved/i.test(p.organizationAName) ||
          /unknown|unresolved/i.test(p.organizationBName),
      ),
    ).toBe(false);
  });

  it("largestOfficialSharedSetSize is TOTAL official membership count", () => {
    // Set 1 size 8, set 2 size 5 — both contain Org A and Org B
    const applications = [
      makeApp("A1", "Applicant A1", ["1"]),
      makeApp("B1", "Applicant B1", ["1"]),
      makeApp("U1", "Applicant Unresolved", ["1"]),
      makeApp("C1", "Applicant C1", ["1"]),
      makeApp("AM1", "Applicant Ambiguous", ["1"]),
      makeApp("A2", "Applicant A2", ["1"]),
      makeApp("B2", "Applicant B1", ["1"]),
      makeApp("U2", "Applicant Unresolved", ["1"]), // same unresolved applicant — still 8 apps
      makeApp("A3", "Applicant A1", ["2"]),
      makeApp("B3", "Applicant B1", ["2"]),
      makeApp("U3", "Applicant Unresolved", ["2"]),
      makeApp("C2", "Applicant C1", ["2"]),
      makeApp("AM2", "Applicant Ambiguous", ["2"]),
    ];
    // set1: A1,B1,U1,C1,AM1,A2,B2,U2 = 8; set2: A3,B3,U3,C2,AM2 = 5
    const doc = syntheticDocument(applications, 13, 2);
    const model = buildOrganizationContentionPairs(doc, syntheticOrgSnapshot());
    expect(model.pairs).toHaveLength(1);
    expect(model.pairs[0]!.largestOfficialSharedSetSize).toBe(8);
  });
});

describe("ORG-CONTENTION-PAIRS-1 live source baseline", () => {
  it("matches accepted pair coverage and GoDaddy reconciliation", async () => {
    const { document, orgSnapshot } = await loadLive();
    expect(orgSnapshot.semanticContentSha256).toBe(
      "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
    );
    const model = buildOrganizationContentionPairs(document, orgSnapshot);
    const c = model.coverage;
    expect(c.officialContentionSets).toBe(263);
    expect(c.officialContentionMemberships).toBe(891);
    expect(c.confirmedContentionMemberships).toBe(724);
    expect(c.unresolvedContentionMemberships).toBe(149);
    expect(c.candidateAmbiguousContentionMemberships).toBe(18);
    expect(c.setsWithConfirmedOrganizationMembership).toBe(256);
    expect(c.pairableOfficialSets).toBe(208);
    expect(c.pairableConfirmedMemberships).toBe(676);
    expect(c.confirmedOrganizations).toBe(104);
    expect(c.uniqueConfirmedOrganizationPairs).toBe(165);
    expect(c.recurringConfirmedOrganizationPairs).toBe(112);
    expect(c.confirmedOrganizationsWithPair).toBe(27);
    expect(c.confirmedOrganizationsWithoutPair).toBe(77);

    expect(model.pairs[0]!.organizationAKey).toBe("identity-digital");
    expect(model.pairs[0]!.organizationBKey).toBe("xyz-com-llc");
    expect(model.pairs[0]!.sharedSetCount).toBe(77);
    expect(model.pairs[1]!.sharedSetCount).toBe(68);
    expect(model.pairs[2]!.sharedSetCount).toBe(51);

    // uniqueness A↔B
    const keys = new Set(model.pairs.map((p) => p.pairKey));
    expect(keys.size).toBe(165);
    expect(model.pairs.every((p) => p.organizationAId < p.organizationBId)).toBe(true);

    const breadth = [...model.organizationSummaries]
      .filter((o) => o.distinctConfirmedCounterpartCount > 0)
      .sort(
        (a, b) =>
          b.distinctConfirmedCounterpartCount - a.distinctConfirmedCounterpartCount ||
          a.organizationName.localeCompare(b.organizationName),
      );
    expect(breadth[0]!.organizationKey).toBe("link-freedom-group");
    expect(breadth[0]!.distinctConfirmedCounterpartCount).toBe(22);

    const gd = model.godaddy!;
    expect(gd.godaddyOrganizationKey).toBe("godaddy-registry-services");
    expect(gd.distinctConfirmedCounterpartCount).toBe(21);
    expect(gd.counterparts[0]!.organizationKey).toBe("identity-digital");
    expect(gd.counterparts[0]!.sharedSetCount).toBe(51);
    const byKey = Object.fromEntries(gd.counterparts.map((c) => [c.organizationKey, c.sharedSetCount]));
    expect(byKey["link-freedom-group"]).toBe(32);
    expect(byKey["xyz-com-llc"]).toBe(29);
    expect(byKey["intercap-registry"]).toBe(19);
    expect(byKey["shortdot-sa"]).toBe(18);

    // concentration GoDaddy counterpart count reconciles
    const concentration = buildOrganizationConcentration(document, orgSnapshot);
    expect(concentration.godaddyRelative!.distinctConfirmedCounterpartOrganizations).toBe(21);
    expect(concentration.godaddyRelative!.counterparts[0]!.organizationKey).toBe("identity-digital");
    expect(concentration.coverage.confirmedApplications).toBe(1129);
    expect(concentration.godaddyRelative!.applicationCount).toBe(77);
    expect(concentration.godaddyRelative!.contentionMembershipCount).toBe(66);
  });

  it("fail-closed on publication pin mismatch", async () => {
    const { document, orgSnapshot } = await loadLive();
    const bad = {
      ...orgSnapshot,
      applicationPublicationPin: {
        ...orgSnapshot.applicationPublicationPin,
        applicationGraphContentSha256: "0".repeat(64),
      },
    };
    expect(() => buildOrganizationContentionPairs(document, bad)).toThrow(
      OrganizationContentionPairsError,
    );
  });

  it("disclosure language stays structural", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationContentionPairs(document, orgSnapshot);
    const blob = Object.values(model.disclosure).join("\n");
    expect(blob).not.toMatch(
      /rival|threat|auction severity|win probability|sales opportunity|market share|dominance|market power|competitive adjacency|selected RSP|available customer/i,
    );
    expect(blob).toMatch(/Confirmed-Organization pairings describe co-membership/i);
  });
});
