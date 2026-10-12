import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applicantProfileHref,
  buildApplicantIntelligenceProfile,
  buildContentionApplicationCountDistribution,
  decodeApplicantProfileName,
} from "@/lib/applicant-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  type ParticipantOverlays,
} from "@/lib/participant-intelligence";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  type ContentionMembershipSnapshotV1,
} from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const CONTENTION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

async function loadLiveDocument(): Promise<RegistryApplicationsDocumentV2> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(await readFile(CONTENTION_PATH, "utf8")) as ContentionMembershipSnapshotV1;
  return buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
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

function mk(
  id: string,
  applicant: string,
  opts?: { label?: string; sets?: string[]; brand?: boolean; region?: string },
): BrowserApplicationV2 {
  return {
    applicationId: id,
    applicant,
    country: "US",
    region: opts?.region ?? "NA",
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    designations: {
      idn: false,
      brand: opts?.brand ?? false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    appliedString: { sourceRowId: id, label: opts?.label ?? id.toLowerCase() },
    officialContention: opts?.sets?.length
      ? {
          membershipPresent: true,
          officialContentionSetIds: opts.sets,
          terminology: "official-initial-contention",
        }
      : {
          membershipPresent: false,
          officialContentionSetIds: [],
          terminology: "official-initial-contention",
        },
  };
}

function syntheticDocument(apps: BrowserApplicationV2[]): RegistryApplicationsDocumentV2 {
  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "promoted-2026",
    snapshotId: "synthetic-applicant-intel",
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
      officialApplicationCount: apps.length,
      officialApplicantCount: new Set(apps.map((a) => a.applicant)).size,
      provenance: {
        sourceName: "test",
        sourceUrl: "https://example.test",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "b".repeat(64),
      },
    },
    applicationRecordCoverage: {
      observed: apps.length,
      official: apps.length,
      completeness: "complete",
      knownExcludedRecords: [],
    },
    officialApplications: apps.length,
    observedApplicationRecords: apps.length,
    officialApplicants: new Set(apps.map((a) => a.applicant)).size,
    knownExcludedRecords: [],
    bundleManifest: {
      officialAggregatesContentSha256: "b".repeat(64),
      coverageDescriptorSha256: "e".repeat(64),
      applicationGraphContentSha256: "a".repeat(64),
    },
    rawSha256: "f".repeat(64),
    applications: apps,
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "synthetic-contention",
      sidecarContentSha256: "c".repeat(64),
      rawSha256: "d".repeat(64),
      applicationPublicationPinHash: "a".repeat(64),
      officialContentionSetCount: 1,
      joinedMemberCount: apps.filter((a) => a.officialContention?.membershipPresent).length,
    },
  };
}

const syntheticOverlays: ParticipantOverlays = {
  organizations: [
    {
      applicantLegalName: "Alpha Registry LLC",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:alpha",
      confirmedOrganizationName: "Alpha",
    },
    {
      applicantLegalName: "Alpha Sibling Inc",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:alpha",
      confirmedOrganizationName: "Alpha",
    },
    {
      applicantLegalName: "Unresolved Applicant GmbH",
      resolutionStatus: "UNRESOLVED",
      confirmedOrganizationId: null,
      confirmedOrganizationName: null,
    },
  ],
  returning: [
    {
      applicantLegalName: "Alpha Registry LLC",
      organization2026Id: "organization:resolved-2026:alpha",
      applications2012: 2,
      applications2026: 4,
      applicationDelta: 2,
      portfolioChange: "EXPANDED",
    },
  ],
};

describe("applicant profile routing", () => {
  it("encodes punctuation and LLC/Inc suffixes for shareable deep links", () => {
    const name = "Hair Apparent, LLC";
    const href = applicantProfileHref(name);
    expect(href).toBe(`/applicant?name=${encodeURIComponent(name)}`);
    expect(href).toContain("%2C");
    expect(decodeApplicantProfileName(encodeURIComponent(name))).toBe(name);
  });

  it("handles Unicode Applicant names safely", () => {
    const name = "Société Exemple, S.A.";
    expect(decodeApplicantProfileName(encodeURIComponent(name))).toBe(name);
    expect(applicantProfileHref(name)).toContain(encodeURIComponent(name));
  });

  it("returns not-found for unknown Applicant without inventing identity", () => {
    const doc = syntheticDocument([mk("A1", "Alpha Registry LLC")]);
    const lookup = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "No Such Applicant, Inc.",
    );
    expect(lookup.found).toBe(false);
    expect(lookup.profileHref).toBe(applicantProfileHref("No Such Applicant, Inc."));
  });
});

describe("applicant profile derivation (synthetic)", () => {
  const apps = [
    mk("A1", "Alpha Registry LLC", { sets: ["10"], label: "cloud", brand: true }),
    mk("A2", "Alpha Registry LLC", { sets: ["10"], label: "cloud", brand: true }),
    mk("A3", "Alpha Registry LLC", { label: "solo", brand: true }),
    mk("S1", "Alpha Sibling Inc", { label: "sib" }),
    mk("B1", "Beta Names Inc", { sets: ["10"], label: "cloud" }),
    mk("U1", "Unresolved Applicant GmbH", { brand: true, label: "uniq" }),
    mk("G1", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { sets: ["10"], label: "cloud" }),
  ];
  const doc = syntheticDocument(apps);

  it("looks up by exact legal name and builds portfolio membership", () => {
    const profile = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Alpha Registry LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.applicationCount).toBe(3);
    expect(profile.portfolio.map((p) => p.appliedForString).sort()).toEqual(["cloud", "cloud", "solo"]);
    expect(profile.brandApplicationCount).toBe(3);
  });

  it("counts contention memberships, unique sets, and distinct counterparts", () => {
    const profile = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Alpha Registry LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.contestedApplicationCount).toBe(2);
    expect(profile.uniqueContentionSets).toBe(1);
    expect(profile.distinctCounterpartApplicants).toBeGreaterThanOrEqual(1);
    const set = profile.contentionSets.find((s) => s.setId === "10")!;
    expect(set.applicationCount).toBe(4);
    expect(set.distinctApplicantCount).toBe(3);
    expect(set.applicationCount).not.toBe(set.distinctApplicantCount);
    expect(set.members.filter((m) => m.applicantLegalName === "Alpha Registry LLC")).toHaveLength(2);
  });

  it("attaches Organization overlay, siblings, identity evidence path, and returning when confirmed", () => {
    const profile = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Alpha Registry LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.organizationResolutionStatus).toBe("CONFIRMED");
    expect(profile.confirmedOrganizationName).toBe("Alpha");
    expect(profile.organizationContext?.siblingApplicantCount).toBe(1);
    expect(profile.organizationContext?.siblingApplicants[0]?.applicantLegalName).toBe("Alpha Sibling Inc");
    expect(profile.confirmedReturning?.applications2012).toBe(2);
    expect(profile.confirmedReturning?.applications2026).toBe(4);
  });

  it("keeps unresolved Applicant profiles useful without Organization gate", () => {
    const profile = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Unresolved Applicant GmbH",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.organizationResolutionStatus).toBe("UNRESOLVED");
    expect(profile.organizationContext).toBeNull();
    expect(profile.confirmedReturning).toBeNull();
    expect(profile.applicationCount).toBe(1);
    expect(profile.portfolio[0]?.appliedForString).toBe("uniq");
    expect(profile.rspPostureLabel).toBeTruthy();
  });

  it("is independent of Application source order", () => {
    const reversed = syntheticDocument([...apps].reverse());
    const a = buildApplicantIntelligenceProfile(
      doc,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Alpha Registry LLC",
    );
    const b = buildApplicantIntelligenceProfile(
      reversed,
      syntheticOverlays,
      loadEvaluatedMainRspArtifact(),
      "Alpha Registry LLC",
    );
    expect(a.found && b.found).toBe(true);
    if (!a.found || !b.found) return;
    expect(a.portfolio.map((p) => p.applicationId)).toEqual(b.portfolio.map((p) => p.applicationId));
    expect(a.contentionSets.map((s) => s.setId)).toEqual(b.contentionSets.map((s) => s.setId));
  });
});

describe("contention application-count distribution", () => {
  it("groups sets as N Applications · M sets and preserves Apps vs Applicants", () => {
    const sets = [
      {
        setId: "13a",
        totalApplications: 13,
        distinctApplicants: 11,
        appliedForStrings: ["app"],
        includesGodaddy: false,
      },
      {
        setId: "10a",
        totalApplications: 10,
        distinctApplicants: 9,
        appliedForStrings: ["a"],
        includesGodaddy: true,
      },
      {
        setId: "10b",
        totalApplications: 10,
        distinctApplicants: 8,
        appliedForStrings: ["b"],
        includesGodaddy: false,
      },
      {
        setId: "10c",
        totalApplications: 10,
        distinctApplicants: 10,
        appliedForStrings: ["c"],
        includesGodaddy: false,
      },
    ];
    const dist = buildContentionApplicationCountDistribution(sets);
    expect(dist[0]).toMatchObject({ applicationCount: 13, setCount: 1 });
    expect(dist[0]!.sets[0]!.distinctApplicantCount).toBe(11);
    expect(dist[0]!.sets[0]!.applicationCount).not.toBe(dist[0]!.sets[0]!.distinctApplicantCount);
    expect(dist[1]).toMatchObject({ applicationCount: 10, setCount: 3 });
    expect(dist[1]!.sets.map((s) => s.setId)).toEqual(["10a", "10b", "10c"]);
  });
});

describe("applicant profile derivation (live acceptance)", () => {
  it("Salesforce, Inc. — Confirmed Salesforce Brand portfolio", async () => {
    const [document, overlays] = await Promise.all([loadLiveDocument(), loadParticipantOverlays(WORKSPACE)]);
    const profile = buildApplicantIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      "Salesforce, Inc.",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.confirmedOrganizationName).toBe("Salesforce");
    expect(profile.organizationResolutionStatus).toBe("CONFIRMED");
    expect(profile.identityEvidence?.applicantWebsiteHost).toMatch(/salesforce\.com/i);
    expect(profile.applicationCount).toBe(4);
    expect(profile.brandApplicationCount).toBe(4);
    expect(profile.portfolio.map((p) => p.appliedForString).sort()).toEqual([
      "force",
      "salesforce",
      "slack",
      "tableau",
    ]);
    expect(profile.portfolio.every((p) => p.brand)).toBe(true);
  });

  it("Hair Apparent, LLC — Identity Digital family with parent evidence", async () => {
    const [document, overlays] = await Promise.all([loadLiveDocument(), loadParticipantOverlays(WORKSPACE)]);
    const profile = buildApplicantIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      "Hair Apparent, LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.confirmedOrganizationName).toBe("Identity Digital");
    expect(profile.identityEvidence?.applicantWebsiteHost).toMatch(/identity\.digital/i);
    expect(profile.identityEvidence?.directParentLegalName).toBe("Slow Rider, LLC");
    expect(profile.identityEvidence?.ultimateParentLegalName).toMatch(/Ethos Capital/i);
    expect(profile.identityEvidence?.ultimateControlLegalName).toMatch(/Ethos Capital/i);
    expect(profile.organizationContext?.siblingApplicantCount).toBeGreaterThan(0);
  });

  it("Anthropic, PBC — Confirmed Brand Applicant", async () => {
    const [document, overlays] = await Promise.all([loadLiveDocument(), loadParticipantOverlays(WORKSPACE)]);
    const profile = buildApplicantIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      "Anthropic, PBC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.confirmedOrganizationName).toBe("Anthropic");
    expect(profile.identityEvidence?.applicantWebsiteHost).toMatch(/anthropic\.com/i);
    expect(profile.applicationCount).toBe(2);
    expect(profile.brandApplicationCount).toBe(2);
  });

  it("Amazon Registry Services, Inc. — unresolved but complete Applicant profile", async () => {
    const [document, overlays] = await Promise.all([loadLiveDocument(), loadParticipantOverlays(WORKSPACE)]);
    const profile = buildApplicantIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      "Amazon Registry Services, Inc.",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.organizationResolutionStatus).toBe("UNRESOLVED");
    expect(profile.organizationContext).toBeNull();
    expect(profile.applicationCount).toBeGreaterThan(0);
    expect(profile.portfolio.length).toBe(profile.applicationCount);
    expect(profile.rspPostureLabel).toBeTruthy();
  });

  it("preserves Organization overlay regression counts", async () => {
    const overlays = await loadParticipantOverlays(WORKSPACE);
    const confirmed = overlays.organizations.filter((o) => o.resolutionStatus === "CONFIRMED");
    const candidate = overlays.organizations.filter((o) => o.resolutionStatus === "CANDIDATE");
    const ambiguous = overlays.organizations.filter((o) => o.resolutionStatus === "AMBIGUOUS");
    const unresolved = overlays.organizations.filter((o) => o.resolutionStatus === "UNRESOLVED");
    expect(confirmed).toHaveLength(145);
    expect(new Set(confirmed.map((c) => c.confirmedOrganizationId).filter(Boolean)).size).toBe(89);
    expect(candidate).toHaveLength(2);
    expect(ambiguous).toHaveLength(2);
    expect(unresolved).toHaveLength(331);
  });
});
