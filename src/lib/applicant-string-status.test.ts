import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildApplicantIntelligenceProfile,
  filterApplicantPortfolio,
  resolveScdContentionEvidenceStatus,
  resolveSelectedStringStatus,
  summarizeApplicantStringStatus,
} from "@/lib/applicant-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  type ContentionMembershipSnapshotV1,
} from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";

const SCD_CANDIDATE_DIR =
  process.env.RIH_SCD_CANDIDATE_DIR ?? "/tmp/rih-scd-pub-candidate-20261119-stats";
const SHORTDOT = "ShortDot (Ireland) Limited";

async function loadScdCandidateDocument(): Promise<RegistryApplicationsDocumentV2> {
  const publication = JSON.parse(
    await readFile(join(SCD_CANDIDATE_DIR, "aps-applications-scd-candidate.snapshot.json"), "utf8"),
  ) as Registry2026PublicationV2;
  const contention = JSON.parse(
    await readFile(join(SCD_CANDIDATE_DIR, "aps-contention-scd-candidate.snapshot.json"), "utf8"),
  ) as ContentionMembershipSnapshotV1;
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
    contentionSnapshotId?: string | null;
    contentionStatus?: "available" | "unavailable";
  },
): RegistryApplicationsDocumentV2 {
  const snapshotId = opts?.snapshotId ?? "snap-aps-2026-applications-string-confirmation-v1";
  const contentionStatus = opts?.contentionStatus ?? "available";
  const contentionSnapshotId =
    opts?.contentionSnapshotId === undefined
      ? "snap-aps-2026-contention-string-confirmation-v1"
      : opts.contentionSnapshotId;
  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "inactive-2x",
    snapshotId,
    snapshotContentHash: "a".repeat(64),
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
      applicationGraphContentSha256: "a".repeat(64),
    },
    rawSha256: "f".repeat(64),
    applications: apps,
    contentionOverlay: {
      status: contentionStatus,
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: contentionStatus === "available" ? contentionSnapshotId : null,
      sidecarContentSha256: contentionStatus === "available" ? "c".repeat(64) : null,
      rawSha256: contentionStatus === "available" ? "d".repeat(64) : null,
      applicationPublicationPinHash: contentionStatus === "available" ? "a".repeat(64) : null,
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
  it("selects Active -R New gTLD when base is Deactivated", () => {
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

describe("SCD candidate acceptance — Registry Services, LLC", () => {
  it("locks GoDaddy string-status acceptance counts and key rows", async () => {
    const document = await loadScdCandidateDocument();
    expect(document.snapshotId).toBe("snap-aps-2026-applications-string-confirmation-v1");
    expect(document.snapshotContentHash).toBe(
      "1d8ba53c6042e9ed13cf012b15ac1ec6b74eb2f272a548cf8c217fed8d2f80ad",
    );
    expect(document.contentionOverlay.snapshotId).toBe(
      "snap-aps-2026-contention-string-confirmation-v1",
    );
    expect(document.contentionOverlay.sidecarContentSha256).toBe(
      "43e279185468f9335119720ece167043119e88718a8afcb2c845ea8ed6f6c6d1",
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

    const summary = profile.stringStatusSummary;
    expect(summary.applicationCount).toBe(77);
    expect(summary.selectedReplacements).toBe(8);
    expect(summary.activeUncontestedInScdCapture).toBe(21);
    expect(summary.activeContestedInScdCapture).toBe(56);
    expect(summary.withdrawnSelected).toBe(0);
    expect(summary.unresolvedSelections).toBe(0);
    expect(summary.awardEstablishedCount).toBe(0);

    const brand = profile.portfolio.find((r) => r.originalAppliedForString === "brand");
    expect(brand).toMatchObject({
      selectedCurrentString: "master",
      selectionMode: "selected-replacement",
      currentApplicationStatus: "Active",
      applicationStatus: "Deactivated",
      scdContentionStatus: "uncontested_in_scd_capture",
      officialAwardOutcome: "not_established",
      selectedReplacementApplicationId: "NA2631T-T69341-R",
    });

    const force = profile.portfolio.find((r) => r.originalAppliedForString === "force");
    expect(force).toMatchObject({
      selectedCurrentString: "force",
      scdContentionStatus: "contested",
      currentApplicationStatus: "Active",
    });
    expect(force?.competitors.some((c) => c.applicantLegalName === "Salesforce, Inc.")).toBe(true);

    expect(
      profile.portfolio.every(
        (r) =>
          r.scdContentionStatus !== "uncontested_in_scd_capture" ||
          r.officialAwardOutcome === "not_established",
      ),
    ).toBe(true);

    expect(filterApplicantPortfolio(profile.portfolio, "selected_replacements")).toHaveLength(8);
    expect(filterApplicantPortfolio(profile.portfolio, "still_in_contention")).toHaveLength(56);
    expect(filterApplicantPortfolio(profile.portfolio, "no_scd_contention")).toHaveLength(21);
  });
});

describe("SCD candidate acceptance — ShortDot (Ireland) Limited", () => {
  it("locks ShortDot portfolio counts on the accepted capture", async () => {
    const document = await loadScdCandidateDocument();
    const profile = buildApplicantIntelligenceProfile(
      document,
      undefined,
      loadEvaluatedMainRspArtifact(),
      SHORTDOT,
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    const summary = summarizeApplicantStringStatus(profile.portfolio);
    expect(summary.applicationCount).toBe(40);
    expect(summary.selectedReplacements).toBe(8);
    expect(summary.activeContestedInScdCapture).toBe(24);
    expect(summary.awardEstablishedCount).toBe(0);
  });
});
