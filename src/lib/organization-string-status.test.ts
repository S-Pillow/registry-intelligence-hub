import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOrganizationIntelligenceProfile,
  filterOrganizationPortfolio,
} from "@/lib/organization-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  loadOrganizationResolutionSnapshot,
  loadParticipantOverlays,
} from "@/lib/participant-intelligence-server";
import { resolveScdContentionEvidenceStatus } from "@/lib/application-string-status";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

const WORKSPACE = process.cwd();
const FIXTURE_DIR = join(WORKSPACE, "src/lib/fixtures/applicant-string-status-scd-cohort");

function loadCohortDocument(): RegistryApplicationsDocumentV2 {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, "browser-document.cohort.json"), "utf8"),
  ) as RegistryApplicationsDocumentV2;
}

function loadProvenance(): {
  expectedAcceptance: {
    registryServicesLlc: {
      applications: number;
      selectedReplacements: number;
      activeUncontested: number;
      activeContested: number;
    };
  };
} {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, "PROVENANCE.json"), "utf8"));
}

describe("organization SCD string-status aggregation", () => {
  it("aggregates Registry Services via GoDaddy Confirmed Organization using shared classification", async () => {
    const provenance = loadProvenance();
    const document = loadCohortDocument();
    const [overlays, snapshot] = await Promise.all([
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    expect(resolveScdContentionEvidenceStatus(document)).toBe("ready");

    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "godaddy-registry-services",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;

    expect(profile.applicants.map((a) => a.applicantLegalName)).toEqual([
      "Registry Services, LLC",
    ]);
    // Confirmed represented Applicants only — not GoDaddy Registry RSP customers.
    expect(profile.applicants.every((a) => a.applicantLegalName === "Registry Services, LLC")).toBe(
      true,
    );

    const expected = provenance.expectedAcceptance.registryServicesLlc;
    expect(profile.stringStatusSummary.applicationCount).toBe(expected.applications);
    expect(profile.stringStatusSummary.activeUncontestedInScdCapture).toBe(
      expected.activeUncontested,
    );
    expect(profile.stringStatusSummary.activeContestedInScdCapture).toBe(expected.activeContested);
    expect(profile.stringStatusSummary.selectedReplacements).toBe(expected.selectedReplacements);
    expect(profile.stringStatusObservation.scdContentionEvidence).toBe("ready");

    const brand = profile.portfolio.find((r) => r.originalAppliedForString === "brand");
    expect(brand).toMatchObject({
      selectedCurrentString: "master",
      selectionMode: "selected-replacement",
      currentApplicationStatus: "Active",
      applicationStatus: "Deactivated",
      scdContentionStatus: "uncontested_in_scd_capture",
    });

    const force = profile.portfolio.find((r) => r.originalAppliedForString === "force");
    expect(force?.scdContentionStatus).toBe("contested");
    expect(force?.competitors.some((c) => c.applicantLegalName === "Salesforce, Inc.")).toBe(true);

    expect(filterOrganizationPortfolio(profile.portfolio, "all")).toHaveLength(expected.applications);
    expect(filterOrganizationPortfolio(profile.portfolio, "no_scd_contention")).toHaveLength(
      expected.activeUncontested,
    );
    expect(filterOrganizationPortfolio(profile.portfolio, "still_in_contention")).toHaveLength(
      expected.activeContested,
    );
    expect(filterOrganizationPortfolio(profile.portfolio, "selected_replacements")).toHaveLength(
      expected.selectedReplacements,
    );

    // Categories are not mutually exclusive: selected replacement can also be uncontested.
    const selectedAndUncontested = profile.portfolio.filter(
      (r) =>
        r.selectionMode === "selected-replacement" &&
        r.scdContentionStatus === "uncontested_in_scd_capture",
    );
    expect(selectedAndUncontested.length).toBeGreaterThan(0);
    expect(selectedAndUncontested.some((r) => r.originalAppliedForString === "brand")).toBe(true);
  });

  it("keeps multi-applicant Organization aggregation distinct and honest without SCD evidence", async () => {
    const document = loadCohortDocument();
    // Force Reveal Day–style unavailable SCD evidence while keeping applications.
    document.snapshotId = "snap-aps-2026-applications-reveal-day-v1";
    document.contentionOverlay = {
      ...document.contentionOverlay,
      snapshotId: "snap-aps-2026-contention-reveal-day-v1",
      applicationPublicationPinHash: "mismatched-pin",
    };

    const [overlays, snapshot] = await Promise.all([
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "identity-digital",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;

    // Cohort only includes Hair Apparent / Paws Button style applicants if they share
    // contention with GoDaddy/ShortDot; Identity Digital may have zero cohort apps.
    // When present, every portfolio row must belong to a confirmed mapped Applicant.
    const memberNames = new Set(profile.applicants.map((a) => a.applicantLegalName));
    expect(profile.portfolio.every((r) => memberNames.has(r.applicantLegalName))).toBe(true);
    expect(profile.stringStatusObservation.scdContentionEvidence).toBe("unavailable");
    expect(profile.stringStatusSummary.activeUncontestedInScdCapture).toBe(0);
    expect(profile.stringStatusSummary.activeContestedInScdCapture).toBe(0);
    expect(profile.portfolio.every((r) => r.scdContentionStatus === "unavailable" || r.scdContentionStatus === "unresolved" || r.scdContentionStatus === "n/a_withdrawn")).toBe(true);
  });
});
