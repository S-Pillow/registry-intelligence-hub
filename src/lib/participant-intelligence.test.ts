import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  type ContentionMembershipSnapshotV1,
} from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  exploreApplicantHref,
  filterAndSortParticipants,
  type ParticipantOverlays,
} from "@/lib/participant-intelligence";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const CONTENTION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

async function loadLiveDocument(): Promise<RegistryApplicationsDocumentV2> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(await readFile(CONTENTION_PATH, "utf8")) as ContentionMembershipSnapshotV1;
  return buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
}

function syntheticDocument(): RegistryApplicationsDocumentV2 {
  const mk = (
    id: string,
    applicant: string,
    opts?: { region?: string; contentionSets?: string[]; idn?: boolean; brand?: boolean },
  ): BrowserApplicationV2 => ({
    applicationId: id,
    applicant,
    country: "US",
    region: opts?.region ?? "NA",
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    designations: {
      idn: opts?.idn ?? false,
      brand: opts?.brand ?? false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
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
    appliedString: { sourceRowId: id, label: id.toLowerCase() },
    officialContention: opts?.contentionSets?.length
      ? {
          membershipPresent: true,
          officialContentionSetIds: opts.contentionSets,
          terminology: "official-initial-contention",
        }
      : {
          membershipPresent: false,
          officialContentionSetIds: [],
          terminology: "official-initial-contention",
        },
  });

  const applications: BrowserApplicationV2[] = [
    mk("A1", "Alpha Registry LLC", { contentionSets: ["1"], brand: true }),
    mk("A2", "Alpha Registry LLC", { contentionSets: ["1"] }),
    mk("A3", "Alpha Registry LLC"),
    mk("B1", "Beta Names Inc", { contentionSets: ["1", "2"], region: "EU" }),
    mk("B2", "Beta Names Inc", { region: "EU" }),
    mk("C1", "Unresolved Applicant GmbH", { region: "EU", idn: true }),
    mk("G1", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { contentionSets: ["2"] }),
    mk("G2", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { contentionSets: ["2"] }),
    mk("G3", GODADDY_FOCAL_APPLICANT_LEGAL_NAME),
  ];

  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "promoted-2026",
    snapshotId: "synthetic-participant-intel",
    snapshotContentHash: "a".repeat(64),
    publicationSchemaVersion: "registry-2026-publication/2.0.0",
    publishedAt: "2026-10-07T00:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    checkedAt: "2026-10-08T00:00:00Z",
    parserVersion: "test",
    normalizerVersion: "test",
    source: { name: "test", url: "https://example.test", evidenceClass: "authoritative" },
    limitations: [],
    disclosureKeys: [],
    officialAggregates: {
      officialApplicationCount: 10,
      officialApplicantCount: 5,
      provenance: {
        sourceName: "test",
        sourceUrl: "https://example.test",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "b".repeat(64),
      },
    },
    applicationRecordCoverage: {
      observed: applications.length,
      official: 10,
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
    officialApplications: 10,
    observedApplicationRecords: applications.length,
    officialApplicants: 5,
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
    bundleManifest: {
      officialAggregatesContentSha256: "b".repeat(64),
      coverageDescriptorSha256: "e".repeat(64),
      applicationGraphContentSha256: "a".repeat(64),
    },
    rawSha256: "f".repeat(64),
    applications,
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "synthetic-contention",
      sidecarContentSha256: "c".repeat(64),
      rawSha256: "d".repeat(64),
      applicationPublicationPinHash: "a".repeat(64),
      officialContentionSetCount: 2,
      joinedMemberCount: 5,
    },
  };
}

const overlays: ParticipantOverlays = {
  organizations: [
    {
      applicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:godaddy-registry-services",
      confirmedOrganizationName: "GoDaddy (Registry Services, LLC)",
    },
    {
      applicantLegalName: "Alpha Registry LLC",
      resolutionStatus: "CANDIDATE",
      confirmedOrganizationId: null,
      confirmedOrganizationName: null,
    },
    {
      applicantLegalName: "Unresolved Applicant GmbH",
      resolutionStatus: "UNRESOLVED",
      confirmedOrganizationId: null,
      confirmedOrganizationName: null,
    },
    {
      applicantLegalName: "Microsoft Corporation",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:hist-2012-microsoft",
      confirmedOrganizationName: "Microsoft Corporation",
    },
    {
      applicantLegalName: "Charleston Road Registry Inc.",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:hist-2012-google-charleston-road",
      confirmedOrganizationName: "Google (Charleston Road Registry Inc.)",
    },
    {
      applicantLegalName: "ECHO Domain Co L.L.C.",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:echostar",
      confirmedOrganizationName: "EchoStar Corporation",
    },
  ],
  returning: [
    {
      applicantLegalName: "Microsoft Corporation",
      organization2026Id: "organization:resolved-2026:hist-2012-microsoft",
      applications2012: 11,
      applications2026: 2,
      applicationDelta: -9,
      portfolioChange: "CONTRACTED",
    },
    {
      applicantLegalName: "Charleston Road Registry Inc.",
      organization2026Id: "organization:resolved-2026:hist-2012-google-charleston-road",
      applications2012: 101,
      applications2026: 39,
      applicationDelta: -62,
      portfolioChange: "CONTRACTED",
    },
  ],
};

describe("participant-intelligence (synthetic)", () => {
  it("aggregates all observed Applicants and Applications without substituting official totals", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    expect(intel.coverage.observedApplications).toBe(9);
    expect(intel.coverage.observedApplicantLegalNames).toBe(4);
    expect(intel.coverage.officialApplications).toBe(10);
    expect(intel.coverage.officialApplicants).toBe(5);
    expect(intel.participants).toHaveLength(4);
    expect(intel.coverage.knownExcludedRecordIds).toEqual(["WDO2627T-T45217"]);
    expect(intel.participants.every((p) => p.applicantLegalName !== "World Data Organization")).toBe(true);
  });

  it("defaults ranking by Application count descending and derives GoDaddy ranks", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    expect(intel.participants.map((p) => p.applicantLegalName)).toEqual([
      "Alpha Registry LLC",
      GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      "Beta Names Inc",
      "Unresolved Applicant GmbH",
    ]);
    expect(intel.focal?.row.applicationCount).toBe(3);
    expect(intel.focal?.rankByApplications).toBe(1); // tie with Alpha at 3 → dense rank 1 for both
    expect(intel.participants.find((p) => p.applicantLegalName === "Alpha Registry LLC")?.rankByApplications).toBe(1);
    expect(intel.focal?.row.shareOfObservedApplications).toBeCloseTo(3 / 9);
  });

  it("derives contention only from official membership and deduplicates rate numerator", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    const alpha = intel.participants.find((p) => p.applicantLegalName === "Alpha Registry LLC")!;
    expect(alpha.contestedApplicationCount).toBe(2);
    expect(alpha.officialContentionSetsTouched).toBe(1);
    expect(alpha.contentionRate).toBeCloseTo(2 / 3);
    // Multi-set membership on one Application still counts once for rate
    const beta = intel.participants.find((p) => p.applicantLegalName === "Beta Names Inc")!;
    expect(beta.contestedApplicationCount).toBe(1);
    expect(beta.officialContentionMemberships).toBe(2);
    expect(beta.contentionRate).toBeCloseTo(1 / 2);
  });

  it("does not invent contention from exact-string grouping alone", () => {
    const doc = syntheticDocument();
    // Give two applicants the same applied string label without contention membership
    doc.applications[5].appliedString = { sourceRowId: "C1", label: "shared" };
    doc.applications[2].appliedString = { sourceRowId: "A3", label: "shared" };
    const intel = buildParticipantIntelligence(doc, overlays);
    const unresolved = intel.participants.find((p) => p.applicantLegalName === "Unresolved Applicant GmbH")!;
    expect(unresolved.contestedApplicationCount).toBe(0);
    expect(unresolved.officialContentionSetsTouched).toBe(0);
  });

  it("builds deterministic GoDaddy contention counterparts from shared official sets", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    expect(intel.contentionCounterparts.map((c) => c.applicantLegalName)).toEqual(["Beta Names Inc"]);
    expect(intel.contentionCounterparts[0].sharedContentionSets).toBe(1);
    expect(intel.contentionCounterparts[0].sharedSetApplications).toBe(1);
  });

  it("applies confirmed Organization overlay without inventing Organizations", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    expect(intel.focal?.row.organizationResolutionStatus).toBe("CONFIRMED");
    expect(intel.focal?.row.confirmedOrganizationName).toContain("GoDaddy");
    const alpha = intel.participants.find((p) => p.applicantLegalName === "Alpha Registry LLC")!;
    expect(alpha.organizationResolutionStatus).toBe("CANDIDATE");
    expect(alpha.confirmedOrganizationName).toBeNull();
    const unresolved = intel.participants.find((p) => p.applicantLegalName === "Unresolved Applicant GmbH")!;
    expect(unresolved.organizationResolutionStatus).toBe("UNRESOLVED");
    expect(unresolved.confirmedOrganizationName).toBeNull();
  });

  it("allows confirmed-returning overlays and never labels GoDaddy/EchoStar returning/new", () => {
    const doc = syntheticDocument();
    doc.applications.push(
      {
        ...doc.applications[0],
        applicationId: "M1",
        applicant: "Microsoft Corporation",
        officialContention: {
          membershipPresent: false,
          officialContentionSetIds: [],
          terminology: "official-initial-contention",
        },
      },
      {
        ...doc.applications[0],
        applicationId: "E1",
        applicant: "ECHO Domain Co L.L.C.",
        officialContention: {
          membershipPresent: false,
          officialContentionSetIds: [],
          terminology: "official-initial-contention",
        },
      },
    );
    doc.observedApplicationRecords = doc.applications.length;
    const intel = buildParticipantIntelligence(doc, overlays);
    expect(intel.participants.find((p) => p.applicantLegalName === "Microsoft Corporation")?.confirmedReturning?.portfolioChange).toBe(
      "CONTRACTED",
    );
    expect(intel.focal?.row.confirmedReturning).toBeNull();
    expect(intel.participants.find((p) => p.applicantLegalName === "ECHO Domain Co L.L.C.")?.confirmedReturning).toBeNull();
    expect(JSON.stringify(intel)).not.toMatch(/"new"/i);
  });

  it("filters and sorts without dropping reachability of the full set", () => {
    const intel = buildParticipantIntelligence(syntheticDocument(), overlays);
    const all = filterAndSortParticipants(intel.participants, {}, "name");
    expect(all).toHaveLength(4);
    const searched = filterAndSortParticipants(intel.participants, { q: "registry" }, "applications");
    expect(searched.map((p) => p.applicantLegalName)).toEqual([
      "Alpha Registry LLC",
      GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
    ]);
    const contended = filterAndSortParticipants(intel.participants, { hasOfficialContention: true }, "contested");
    expect(contended.every((p) => p.contestedApplicationCount > 0)).toBe(true);
    const confirmed = filterAndSortParticipants(intel.participants, { confirmedOrganizationOnly: true }, "name");
    expect(confirmed.map((p) => p.applicantLegalName)).toEqual([GODADDY_FOCAL_APPLICANT_LEGAL_NAME]);
    const eu = filterAndSortParticipants(intel.participants, { region: "EU" }, "name");
    expect(eu.map((p) => p.applicantLegalName)).toEqual(["Beta Names Inc", "Unresolved Applicant GmbH"]);
  });

  it("preserves Applicant drilldown hrefs", () => {
    expect(exploreApplicantHref("Registry Services, LLC")).toBe(
      "/explore?q=Registry%20Services%2C%20LLC",
    );
    expect(exploreApplicantApplicationsHref(["A1", "A2"])).toBe("/explore?ids=A1%2CA2");
  });
});

describe("participant-intelligence (live APS pins)", () => {
  it("reproduces 480 Applicants / 1614 Applications and Registry Services, LLC 77 / 66", async () => {
    const document = await loadLiveDocument();
    const intel = buildParticipantIntelligence(document, overlays);
    expect(intel.coverage.observedApplications).toBe(1614);
    expect(intel.coverage.observedApplicantLegalNames).toBe(480);
    expect(intel.coverage.officialApplications).toBe(1615);
    expect(intel.coverage.officialApplicants).toBe(481);
    expect(intel.coverage.officialContentionSets).toBe(263);
    expect(intel.coverage.officialContentionMemberships).toBe(891);
    expect(intel.coverage.knownExcludedRecordIds).toContain("WDO2627T-T45217");
    expect(intel.participants).toHaveLength(480);
    expect(intel.participants.reduce((s, p) => s + p.applicationCount, 0)).toBe(1614);

    const rsl = intel.focal?.row;
    expect(rsl).toBeTruthy();
    expect(rsl!.applicationCount).toBe(77);
    expect(rsl!.officialContentionMemberships).toBe(66);
    expect(rsl!.contestedApplicationCount).toBe(66);
    expect(rsl!.rankByApplications).toBeGreaterThan(0);
    expect(rsl!.organizationResolutionStatus).toBe("CONFIRMED");
    expect(intel.contentionCounterparts.length).toBeGreaterThan(0);
    // Deterministic ordering
    const again = buildParticipantIntelligence(document, overlays);
    expect(again.contentionCounterparts.map((c) => c.applicantLegalName)).toEqual(
      intel.contentionCounterparts.map((c) => c.applicantLegalName),
    );
  });
});
