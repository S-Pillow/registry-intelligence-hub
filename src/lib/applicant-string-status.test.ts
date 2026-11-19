import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildApplicantIntelligenceProfile,
  contestedApplicationsStatLabel,
  filterApplicantPortfolio,
  resolveScdContentionEvidenceStatus,
  resolveSelectedStringStatus,
  summarizeApplicantStringStatus,
} from "@/lib/applicant-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";

const FIXTURE_DIR = join(
  process.cwd(),
  "src/lib/fixtures/applicant-string-status-scd-cohort",
);
const SHORTDOT = "ShortDot (Ireland) Limited";

function loadCohortDocument(): RegistryApplicationsDocumentV2 {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, "browser-document.cohort.json"), "utf8"),
  ) as RegistryApplicationsDocumentV2;
}

function loadProvenance(): {
  derivedFrom: {
    applicationSnapshotId: string;
    applicationGraphContentHash: string;
    contentionSnapshotId: string;
    contentionSidecarContentSha256: string;
  };
  expectedAcceptance: {
    registryServicesLlc: {
      applications: number;
      selectedReplacements: number;
      activeUncontested: number;
      activeContested: number;
    };
    shortDotIrelandLimited: {
      applications: number;
      selectedReplacements: number;
      activeContested: number;
    };
  };
} {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, "PROVENANCE.json"), "utf8"));
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

function mkApp(
  partial: Partial<BrowserApplicationV2> &
    Pick<BrowserApplicationV2, "applicationId" | "applicant" | "appliedString">,
): BrowserApplicationV2 {
  return {
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "String Evaluation Processing",
    applicationType: "New gTLD",
    designations: {
      idn: false,
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    officialContention: {
      membershipPresent: false,
      officialContentionSetIds: [],
      terminology: "official-initial-contention",
    },
    ...partial,
  };
}

function syntheticDocument(
  apps: BrowserApplicationV2[],
  opts?: {
    snapshotId?: string;
    snapshotContentHash?: string;
    contentionSnapshotId?: string | null;
    contentionStatus?: "available" | "unavailable";
    applicationPublicationPinHash?: string | null;
  },
): RegistryApplicationsDocumentV2 {
  const snapshotId = opts?.snapshotId ?? "snap-aps-2026-applications-string-confirmation-v1";
  const snapshotContentHash = opts?.snapshotContentHash ?? "a".repeat(64);
  const contentionStatus = opts?.contentionStatus ?? "available";
  const contentionSnapshotId =
    opts?.contentionSnapshotId === undefined
      ? "snap-aps-2026-contention-string-confirmation-v1"
      : opts.contentionSnapshotId;
  const pin =
    opts?.applicationPublicationPinHash === undefined
      ? snapshotContentHash
      : opts.applicationPublicationPinHash;
  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "inactive-2x",
    snapshotId,
    snapshotContentHash,
    publicationSchemaVersion: "registry-2026-publication/2.0.0",
    publishedAt: "2026-11-17T00:00:00.000Z",
    retrievedAt: "2026-11-18T21:23:17.000Z",
    checkedAt: "2026-11-18T21:23:17.000Z",
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
        retrievedAt: "2026-11-18T21:23:17.000Z",
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
      applicationGraphContentSha256: snapshotContentHash,
    },
    rawSha256: "f".repeat(64),
    applications: apps,
    contentionOverlay: {
      status: contentionStatus,
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: contentionStatus === "available" ? contentionSnapshotId : null,
      sidecarContentSha256: contentionStatus === "available" ? "c".repeat(64) : null,
      rawSha256: contentionStatus === "available" ? "d".repeat(64) : null,
      applicationPublicationPinHash: contentionStatus === "available" ? pin : null,
      officialContentionSetCount: contentionStatus === "available" ? 1 : null,
      joinedMemberCount:
        contentionStatus === "available"
          ? apps.filter((a) => a.officialContention?.membershipPresent).length
          : null,
      reason: contentionStatus === "unavailable" ? "Contention sidecar not supplied" : undefined,
    },
  };
}

describe("selected string resolution", () => {
  it("selects Active -R New gTLD when base is Deactivated and identity is applicationId-R", () => {
    const resolved = resolveSelectedStringStatus(
      mkApp({
        applicationId: "NA1",
        applicant: "Test",
        applicationStatus: "Deactivated",
        appliedString: { sourceRowId: "NA1", label: "brand" },
        replacementString: {
          sourceRowId: "NA1-R",
          label: "master",
          applicationStatus: "Active",
          processingStage: "String Evaluation Processing",
          applicationType: "New gTLD",
        },
      }),
    );
    expect(resolved.selectionMode).toBe("selected-replacement");
    expect(resolved.selectedCurrentString).toBe("master");
    expect(resolved.currentApplicationStatus).toBe("Active");
    expect(resolved.selectedReplacementApplicationId).toBe("NA1-R");
  });

  it("keeps original for unselected Replacement String rows", () => {
    const resolved = resolveSelectedStringStatus(
      mkApp({
        applicationId: "NA2",
        applicant: "Test",
        appliedString: { sourceRowId: "NA2", label: "ace" },
        replacementString: {
          sourceRowId: "NA2-R",
          label: "elite",
          applicationStatus: "Deactivated",
          processingStage: "Pre-Evaluation Processing",
          applicationType: "Replacement String",
        },
      }),
    );
    expect(resolved.selectionMode).toBe("kept-original-unselected-replacement");
    expect(resolved.selectedCurrentString).toBe("ace");
    expect(resolved.selectedReplacementApplicationId).toBeNull();
  });

  it("fails closed when replacement sourceRowId is not exactly applicationId-R", () => {
    const resolved = resolveSelectedStringStatus(
      mkApp({
        applicationId: "NA2631T-T69341",
        applicant: "Test",
        applicationStatus: "Deactivated",
        appliedString: { sourceRowId: "NA2631T-T69341", label: "brand" },
        replacementString: {
          sourceRowId: "OTHER-T00000-R",
          label: "master",
          applicationStatus: "Active",
          processingStage: "String Evaluation Processing",
          applicationType: "New gTLD",
        },
      }),
    );
    expect(resolved.selectionMode).toBe("unresolved");
    expect(resolved.selectedReplacementApplicationId).toBeNull();
  });

  it("fails closed on contradictory selected-type status pairs", () => {
    const resolved = resolveSelectedStringStatus(
      mkApp({
        applicationId: "NA3",
        applicant: "Test",
        applicationStatus: "Active",
        appliedString: { sourceRowId: "NA3", label: "odd" },
        replacementString: {
          sourceRowId: "NA3-R",
          label: "new",
          applicationStatus: "Active",
          processingStage: "String Evaluation Processing",
          applicationType: "New gTLD",
        },
      }),
    );
    expect(resolved.selectionMode).toBe("unresolved");
  });

  it("fails closed when Replacement String type is Active", () => {
    const resolved = resolveSelectedStringStatus(
      mkApp({
        applicationId: "NA4",
        applicant: "Test",
        appliedString: { sourceRowId: "NA4", label: "keep" },
        replacementString: {
          sourceRowId: "NA4-R",
          label: "swap",
          applicationStatus: "Active",
          processingStage: "String Evaluation Processing",
          applicationType: "Replacement String",
        },
      }),
    );
    expect(resolved.selectionMode).toBe("unresolved");
  });
});

describe("SCD contention evidence gates", () => {
  it("marks missing contention overlay as unavailable, not uncontested", () => {
    const doc = syntheticDocument(
      [
        mkApp({
          applicationId: "A1",
          applicant: "Solo Applicant LLC",
          appliedString: { sourceRowId: "A1", label: "solo" },
        }),
      ],
      { contentionStatus: "unavailable", contentionSnapshotId: null },
    );
    expect(resolveScdContentionEvidenceStatus(doc)).toBe("unavailable");
    const profile = buildApplicantIntelligenceProfile(
      doc,
      undefined,
      loadEvaluatedMainRspArtifact(),
      "Solo Applicant LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.portfolio[0]?.scdContentionStatus).toBe("unavailable");
    expect(profile.portfolio[0]?.officialAwardOutcome).toBe("not_established");
  });

  it("does not treat Reveal Day contention as current SCD uncontested", () => {
    const doc = syntheticDocument(
      [
        mkApp({
          applicationId: "A1",
          applicant: "Reveal Applicant LLC",
          appliedString: { sourceRowId: "A1", label: "alpha" },
        }),
      ],
      {
        snapshotId: "snap-aps-2026-applications-reveal-day-v1",
        contentionSnapshotId: "snap-aps-2026-contention-reveal-day-v1",
      },
    );
    expect(resolveScdContentionEvidenceStatus(doc)).toBe("unavailable");
    const profile = buildApplicantIntelligenceProfile(
      doc,
      undefined,
      loadEvaluatedMainRspArtifact(),
      "Reveal Applicant LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.portfolio[0]?.scdContentionStatus).toBe("unavailable");
    expect(profile.stringStatusObservation.publicationBasisLabel).toMatch(/Reveal Day/);
    expect(contestedApplicationsStatLabel(profile.stringStatusObservation)).toBe(
      "In initial contention",
    );
  });

  it("refuses SCD app + Reveal Day contention combination", () => {
    const doc = syntheticDocument(
      [
        mkApp({
          applicationId: "A1",
          applicant: "Mixed Pins LLC",
          appliedString: { sourceRowId: "A1", label: "mixed" },
        }),
      ],
      {
        snapshotId: "snap-aps-2026-applications-string-confirmation-v1",
        contentionSnapshotId: "snap-aps-2026-contention-reveal-day-v1",
      },
    );
    expect(resolveScdContentionEvidenceStatus(doc)).toBe("unavailable");
  });

  it("refuses available SCD overlay when application-content pin mismatches", () => {
    const doc = syntheticDocument(
      [
        mkApp({
          applicationId: "A1",
          applicant: "Pin Mismatch LLC",
          appliedString: { sourceRowId: "A1", label: "pin" },
        }),
      ],
      {
        snapshotContentHash: "1".repeat(64),
        applicationPublicationPinHash: "2".repeat(64),
      },
    );
    expect(resolveScdContentionEvidenceStatus(doc)).toBe("unavailable");
    const profile = buildApplicantIntelligenceProfile(
      doc,
      undefined,
      loadEvaluatedMainRspArtifact(),
      "Pin Mismatch LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.portfolio[0]?.scdContentionStatus).toBe("unavailable");
  });

  it("never labels absent award evidence as awarded", () => {
    const doc = syntheticDocument([
      mkApp({
        applicationId: "A1",
        applicant: "Award Absent LLC",
        appliedString: { sourceRowId: "A1", label: "open" },
      }),
    ]);
    const profile = buildApplicantIntelligenceProfile(
      doc,
      undefined,
      loadEvaluatedMainRspArtifact(),
      "Award Absent LLC",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.portfolio.every((r) => r.officialAwardOutcome === "not_established")).toBe(true);
    expect(profile.stringStatusSummary.awardEstablishedCount).toBe(0);
  });
});

describe("portable SCD cohort acceptance — Registry Services, LLC", () => {
  it("locks GoDaddy string-status acceptance counts and key rows from provenance fixture", () => {
    const provenance = loadProvenance();
    const document = loadCohortDocument();

    expect(document.snapshotId).toBe(provenance.derivedFrom.applicationSnapshotId);
    expect(document.snapshotContentHash).toBe(provenance.derivedFrom.applicationGraphContentHash);
    expect(document.contentionOverlay.snapshotId).toBe(provenance.derivedFrom.contentionSnapshotId);
    expect(document.contentionOverlay.sidecarContentSha256).toBe(
      provenance.derivedFrom.contentionSidecarContentSha256,
    );
    expect(document.contentionOverlay.applicationPublicationPinHash).toBe(
      document.snapshotContentHash,
    );
    expect(resolveScdContentionEvidenceStatus(document)).toBe("ready");

    const profile = buildApplicantIntelligenceProfile(
      document,
      undefined,
      loadEvaluatedMainRspArtifact(),
      GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;

    const expected = provenance.expectedAcceptance.registryServicesLlc;
    const summary = profile.stringStatusSummary;
    expect(summary.applicationCount).toBe(expected.applications);
    expect(summary.selectedReplacements).toBe(expected.selectedReplacements);
    expect(summary.activeUncontestedInScdCapture).toBe(expected.activeUncontested);
    expect(summary.activeContestedInScdCapture).toBe(expected.activeContested);
    expect(summary.withdrawnSelected).toBe(0);
    expect(summary.unresolvedSelections).toBe(0);
    expect(summary.awardEstablishedCount).toBe(0);

    expect(contestedApplicationsStatLabel(profile.stringStatusObservation)).toBe(
      "In SCD contention",
    );

    const brand = profile.portfolio.find((r) => r.originalAppliedForString === "brand");
    expect(brand).toMatchObject({
      selectedCurrentString: "master",
      selectionMode: "selected-replacement",
      currentApplicationStatus: "Active",
      applicationStatus: "Deactivated",
      scdContentionStatus: "uncontested_in_scd_capture",
      officialAwardOutcome: "not_established",
      selectedReplacementApplicationId: "NA2631T-T69341-R",
      contentionSetHref: null,
    });

    const force = profile.portfolio.find((r) => r.originalAppliedForString === "force");
    expect(force).toMatchObject({
      selectedCurrentString: "force",
      scdContentionStatus: "contested",
      currentApplicationStatus: "Active",
    });
    expect(force?.competitors.some((c) => c.applicantLegalName === "Salesforce, Inc.")).toBe(true);
    expect(force?.scdContentionSetId).toBeTruthy();
    expect(force?.contentionSetHref).toBe(`/contention?set=${encodeURIComponent(force!.scdContentionSetId!)}`);

    expect(
      profile.portfolio.every(
        (r) =>
          r.scdContentionStatus !== "uncontested_in_scd_capture" ||
          r.officialAwardOutcome === "not_established",
      ),
    ).toBe(true);

    expect(filterApplicantPortfolio(profile.portfolio, "selected_replacements")).toHaveLength(
      expected.selectedReplacements,
    );
    expect(filterApplicantPortfolio(profile.portfolio, "still_in_contention")).toHaveLength(
      expected.activeContested,
    );
    expect(filterApplicantPortfolio(profile.portfolio, "no_scd_contention")).toHaveLength(
      expected.activeUncontested,
    );
  });
});

describe("portable SCD cohort acceptance — ShortDot (Ireland) Limited", () => {
  it("locks ShortDot portfolio counts on the provenance-documented cohort", () => {
    const provenance = loadProvenance();
    const document = loadCohortDocument();
    const profile = buildApplicantIntelligenceProfile(
      document,
      undefined,
      loadEvaluatedMainRspArtifact(),
      SHORTDOT,
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    const summary = summarizeApplicantStringStatus(profile.portfolio);
    const expected = provenance.expectedAcceptance.shortDotIrelandLimited;
    expect(summary.applicationCount).toBe(expected.applications);
    expect(summary.selectedReplacements).toBe(expected.selectedReplacements);
    expect(summary.activeContestedInScdCapture).toBe(expected.activeContested);
    expect(summary.awardEstablishedCount).toBe(0);
  });
});
