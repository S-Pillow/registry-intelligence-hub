// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import type { HubRegistryDataResolution } from "@/lib/registry-application-payload-shared";

afterEach(() => cleanup());

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

function makeDocument(contention: "available" | "unavailable" = "available"): RegistryApplicationsDocumentV2 {
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
    contentionOverlay:
      contention === "available"
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
            reason: "contention pin mismatch",
          },
    applications: [
      {
        applicationId: "APP-1",
        applicant: "Example Applicant",
        country: "US",
        region: "NA",
        applicationStatus: "Active",
        processingStage: "Evaluation",
        applicationType: "Standard",
        designations: {
          brand: true,
          community: false,
          geoSelfDesignated: false,
          geoStringReviewConfirmed: false,
          idn: false,
        },
        labels: emptyLabels(),
        appliedString: { sourceRowId: "APP-1", label: "example" },
        officialContention: {
          membershipPresent: true,
          officialContentionSetIds: ["1"],
          terminology: "official-initial-contention",
        },
      },
    ],
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

function renderCc(document: RegistryApplicationsDocumentV2, claim = promotedClaim()) {
  const resolution: HubRegistryDataResolution = {
    status: "ok",
    document: null,
    documentV2: document,
    documentVersion: "2.0.0",
    mode: "promoted-2026-v2",
    selectionReason: "promoted-active-v2",
    activeSourceError: null,
  };
  return render(
    <HubClaimActualityProvider claimActualityState={claim}>
      <HubRegistryDataProvider resolution={resolution}>
        <CommandCenter />
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("Command Center intelligence-first 2.x IA", () => {
  it("1-6 — official posture, coverage context, WDO metadata", () => {
    renderCc(makeDocument());
    expect(screen.getByTestId("cc-v2-official-apps")).toHaveTextContent("1615");
    expect(screen.getByTestId("cc-v2-official-applicants")).toHaveTextContent("481");
    expect(screen.getByTestId("cc-v2-contention-sets")).toHaveTextContent("263");
    expect(screen.getByTestId("cc-v2-contention-memberships")).toHaveTextContent("891");
    expect(screen.getByTestId("cc-v2-coverage-observed")).toHaveTextContent("1614");
    expect(screen.getByTestId("cc-v2-coverage-official")).toHaveTextContent("1615");
    expect(screen.getByTestId("cc-v2-coverage-completeness")).toHaveTextContent("partial");
    expect(screen.getByTestId("cc-v2-coverage-excluded")).toHaveTextContent(/administrative-check/);
    expect(screen.queryByText("WDO2627T-T45217")).not.toBeInTheDocument();
    // Observed must not be the hero Application count
    const posture = screen.getByTestId("cc-section-round-posture");
    expect(within(posture).queryByText("1614")).not.toBeInTheDocument();
  });

  it("7-9 — Applications and IDN cross-round with derived deltas", () => {
    renderCc(makeDocument());
    expect(screen.getByTestId("cc-v2-cross-apps-2012")).toHaveTextContent(
      String(APPROVED_2012_BASELINE.applications),
    );
    expect(screen.getByTestId("cc-v2-cross-apps-2026")).toHaveTextContent("1615");
    expect(screen.getByTestId("cc-v2-cross-apps-delta")).toHaveTextContent(
      String(1615 - APPROVED_2012_BASELINE.applications),
    );
    expect(screen.getByTestId("cc-v2-cross-idn-2012")).toHaveTextContent(
      String(APPROVED_2012_BASELINE.idnApplications),
    );
    expect(screen.getByTestId("cc-v2-cross-idn-2026")).toHaveTextContent("21");
    expect(screen.getByTestId("cc-v2-cross-idn-delta")).toHaveTextContent(
      String(21 - APPROVED_2012_BASELINE.idnApplications),
    );
  });

  it("10-16 — blocked intelligence absent from 2.x Command Center", () => {
    renderCc(makeDocument());
    expect(screen.queryByTestId("cc-v2-unique-blocked")).not.toBeInTheDocument();
    expect(screen.queryByText(/Unique applied strings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Organization portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/returning participant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/category mix/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Industries$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Sectors$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Categories$/i })).not.toBeInTheDocument();
    // No Community/Geographic/contention cross-round cards
    expect(screen.queryByTestId("cc-v2-cross-community-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cc-v2-cross-geographic-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cc-v2-cross-contention-card")).not.toBeInTheDocument();
    const omitted = screen.getByTestId("cc-v2-omitted-blocked-cross-round");
    expect(omitted).toHaveTextContent("unique-applied-strings");
    expect(omitted).toHaveTextContent("community-applications");
    expect(omitted).toHaveTextContent("geographic-applications");
    expect(omitted).toHaveTextContent("organization-round-count");
    expect(omitted).toHaveTextContent("returning-participant-identity");
    expect(omitted).toHaveTextContent("category-mix");
  });

  it("17-20 — composition semantics + official contention separation", () => {
    renderCc(makeDocument());
    expect(screen.getByTestId("cc-v2-composition-brand")).toHaveTextContent("333");
    expect(screen.getByTestId("cc-v2-composition-community")).toHaveTextContent("16");
    expect(screen.getByTestId("cc-v2-composition-geographic")).toHaveTextContent("15");
    expect(screen.getByTestId("cc-v2-geo-self-identified")).toHaveTextContent(/self-identified/i);
    expect(screen.getByTestId("cc-v2-composition-variants")).toHaveTextContent("9");
    expect(screen.getByTestId("cc-v2-replacement-relationship-grain")).toHaveTextContent(
      /relationship grain/i,
    );
    expect(screen.getByTestId("cc-v2-contention-not-exact-string")).toHaveTextContent(
      /exact-string/i,
    );
    expect(screen.getByTestId("cc-section-composition")).toHaveTextContent(
      /not industries, sectors, or market categories/i,
    );
  });

  it("21 — contention unavailable does not break Application Command Center", () => {
    renderCc(makeDocument("unavailable"));
    expect(screen.getByTestId("cc-v2-official-apps")).toHaveTextContent("1615");
    expect(screen.getByTestId("cc-v2-contention-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("cc-v2-contention-unavailable")).toHaveTextContent(
      /fails closed independently/i,
    );
    expect(screen.getByTestId("cc-v2-cross-apps-2026")).toHaveTextContent("1615");
  });

  it("exposes drilldown CTAs without embedding Explore tables", () => {
    renderCc(makeDocument());
    expect(screen.getByRole("link", { name: "Explore applications" })).toHaveAttribute(
      "href",
      "/explore",
    );
    expect(screen.getByRole("link", { name: "View data provenance" })).toHaveAttribute(
      "href",
      "/data-health",
    );
    expect(screen.queryByTestId("search-v2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("explore-content-v2")).not.toBeInTheDocument();
  });
});
