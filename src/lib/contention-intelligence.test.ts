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
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import type { ParticipantOverlays } from "@/lib/participant-intelligence";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  buildContentionIntelligence,
  filterContentionSets,
  type ContentionSetRow,
} from "@/lib/contention-intelligence";
import { buildParticipantIntelligence } from "@/lib/participant-intelligence";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const CONTENTION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

function syntheticDocument(orderFlip = false): RegistryApplicationsDocumentV2 {
  const mk = (
    id: string,
    applicant: string,
    opts?: { contentionSets?: string[]; label?: string; region?: string },
  ): BrowserApplicationV2 => ({
    applicationId: id,
    applicant,
    country: "US",
    region: opts?.region ?? "NA",
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
    appliedString: { sourceRowId: id, label: opts?.label ?? id.toLowerCase() },
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
    mk("A1", "Alpha Registry LLC", { contentionSets: ["10"], label: "cloud" }),
    mk("A2", "Alpha Registry LLC", { contentionSets: ["10"], label: "cloud" }),
    mk("B1", "Beta Names Inc", { contentionSets: ["10", "20"], label: "cloud" }),
    mk("C1", "Solo Applicant Ltd", { contentionSets: ["30"], label: "solo" }),
    mk("G1", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { contentionSets: ["10"], label: "cloud" }),
    mk("G2", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { contentionSets: ["20"], label: "shop" }),
    mk("D1", "Delta Domains SA", { contentionSets: ["20"], label: "shop" }),
    mk("U1", "Unresolved Applicant GmbH"),
  ];
  if (orderFlip) applications.reverse();

  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "promoted-2026",
    snapshotId: "synthetic-cont-intel",
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
      officialApplicationCount: 9,
      officialApplicantCount: 6,
      provenance: {
        sourceName: "test",
        sourceUrl: "https://example.test",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "b".repeat(64),
      },
    },
    applicationRecordCoverage: {
      observed: applications.length,
      official: 9,
      completeness: "partial",
      knownExcludedRecords: [],
    },
    officialApplications: 9,
    observedApplicationRecords: applications.length,
    officialApplicants: 6,
    knownExcludedRecords: [],
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
      officialContentionSetCount: 3,
      joinedMemberCount: 7,
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
  ],
  returning: [],
};

const emptyRsp = loadEvaluatedMainRspArtifact();

describe("contention intelligence (synthetic)", () => {
  it("derives official set/membership counts from accepted overlay", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    expect(intel.metrics.officialSets).toBe(3);
    expect(intel.metrics.officialMemberships).toBe(7);
  });

  it("classifies GoDaddy exposure only via Registry Services, LLC membership", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    expect(intel.metrics.godaddyMemberships).toBe(2);
    expect(intel.metrics.uniqueGodaddySets).toBe(2);
    expect(intel.godaddySets.every((s) => s.includesGodaddy)).toBe(true);
    expect(intel.godaddySets.every((s) => s.godaddyApplications >= 1)).toBe(true);
    const solo = intel.sets.find((s) => s.setId === "30")!;
    expect(solo.includesGodaddy).toBe(false);
    expect(intel.godaddySets.some((s) => s.setId === "30")).toBe(false);
  });

  it("derives counterpart Applicants and memberships deterministically", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    expect(intel.metrics.uniqueCounterpartApplicants).toBe(3); // Alpha, Beta, Delta
    expect(intel.metrics.counterpartMembershipsInGodaddySets).toBe(5); // A1 A2 B1(in10) B1(in20) D1 — wait B1 counted twice across sets
    // memberships: set10 non-GD = A1,A2,B1 (3); set20 non-GD = B1,D1 (2) → 5
    expect(intel.metrics.counterpartMembershipsInGodaddySets).toBe(5);
  });

  it("keeps distinct Applicant count separate from Application membership count", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    const set10 = intel.sets.find((s) => s.setId === "10")!;
    expect(set10.totalApplications).toBe(4);
    expect(set10.distinctApplicants).toBe(3);
    expect(set10.distinctCounterpartApplicants).toBe(2);
  });

  it("member counts are stable regardless of source order", () => {
    const a = buildContentionIntelligence(syntheticDocument(false), overlays, emptyRsp);
    const b = buildContentionIntelligence(syntheticDocument(true), overlays, emptyRsp);
    const ids = (sets: ContentionSetRow[]) =>
      sets.map((s) => ({
        id: s.setId,
        total: s.totalApplications,
        members: s.members.map((m) => m.applicationId),
      }));
    expect(ids(a.sets)).toEqual(ids(b.sets));
    expect(a.metrics).toEqual(b.metrics);
  });

  it("unresolved Organization does not block Applicant participation", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    const unresolvedApps = intel.participantIntelligence.participants.find(
      (p) => p.applicantLegalName === "Unresolved Applicant GmbH",
    );
    expect(unresolvedApps).toBeTruthy();
    expect(unresolvedApps!.organizationResolutionStatus).toBe("UNRESOLVED");
    expect(unresolvedApps!.applicationCount).toBe(1);
  });

  it("never substitutes exact-string grouping for official contention", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    // "cloud" appears in set 10 only as official membership — solo string is separate set 30
    expect(intel.sets.map((s) => s.setId).sort()).toEqual(["10", "20", "30"]);
    expect(intel.asOf.terminology).toBe("official-initial-contention");
  });

  it("filters by search and GoDaddy involvement", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    expect(filterContentionSets(intel.sets, { godaddy: "includes-godaddy" })).toHaveLength(2);
    expect(filterContentionSets(intel.sets, { godaddy: "excludes-godaddy" })).toHaveLength(1);
    expect(filterContentionSets(intel.sets, { q: "Beta Names" }).map((s) => s.setId).sort()).toEqual([
      "10",
      "20",
    ]);
    expect(filterContentionSets(intel.sets, { q: "G1" }).map((s) => s.setId)).toEqual(["10"]);
    expect(filterContentionSets(intel.sets, { q: "shop" }).map((s) => s.setId)).toEqual(["20"]);
    expect(filterContentionSets(intel.sets, { size: "5+" })).toHaveLength(0);
  });

  it("sorts GoDaddy sets by membership then counterparts then set id", () => {
    const intel = buildContentionIntelligence(syntheticDocument(), overlays, emptyRsp);
    expect(intel.godaddySets.map((s) => s.setId)).toEqual(["10", "20"]);
    expect(intel.metrics.largestGodaddySetSize).toBe(4);
    expect(intel.metrics.largestSetSize).toBe(4);
  });
});

describe("contention intelligence (live accepted pin)", () => {
  it("matches official contention and GoDaddy 66 semantics with participant intelligence", async () => {
    const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
    const contention = JSON.parse(await readFile(CONTENTION_PATH, "utf8")) as ContentionMembershipSnapshotV1;
    const document = buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
    const overlaysLive = await loadParticipantOverlays(WORKSPACE);
    const intel = buildContentionIntelligence(document, overlaysLive, loadEvaluatedMainRspArtifact());
    const participants = buildParticipantIntelligence(document, overlaysLive);

    expect(intel.metrics.officialSets).toBe(263);
    expect(intel.metrics.officialMemberships).toBe(891);
    expect(intel.metrics.godaddyMemberships).toBe(66);
    expect(intel.metrics.uniqueGodaddySets).toBe(
      participants.focal?.row.officialContentionSetsTouched ?? -1,
    );
    expect(intel.sets).toHaveLength(263);
    expect(intel.godaddySets).toHaveLength(intel.metrics.uniqueGodaddySets);

    // Semantic consistency: every membership in derived sets is an officialContention membership
    let derivedMemberships = 0;
    for (const set of intel.sets) {
      derivedMemberships += set.totalApplications;
      for (const m of set.members) {
        const app = document.applications.find((a) => a.applicationId === m.applicationId)!;
        expect(app.officialContention?.membershipPresent).toBe(true);
        expect(app.officialContention?.officialContentionSetIds).toContain(set.setId);
      }
    }
    expect(derivedMemberships).toBe(891);

    // Regression pins
    expect(document.officialApplications).toBe(1615);
    expect(document.officialApplicants).toBe(481);
    expect(document.applications.length).toBe(1614);
    expect(participants.coverage.observedApplicantLegalNames).toBe(480);
    expect(participants.focal?.row.applicationCount).toBe(77);
  });
});
