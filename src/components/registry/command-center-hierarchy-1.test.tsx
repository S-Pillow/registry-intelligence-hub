// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenterOrientationV2 } from "@/components/registry/command-center-orientation-v2";
import { makeRepresentativeFeed } from "@/change-intel/fixtures";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";

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

function makeDocument(): RegistryApplicationsDocumentV2 {
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

describe("COMMAND-CENTER-HIERARCHY-1", () => {
  it("attention strip surfaces GoDaddy 66 set signal", () => {
    render(
      <CommandCenterOrientationV2
        document={makeDocument()}
        claimActuality={promotedClaim()}
        godaddyUniqueContentionSets={66}
        changeFeed={{ initialized: false }}
      />,
    );
    expect(screen.getByTestId("cc-attention-godaddy-sets")).toHaveTextContent("66");
    expect(screen.getByTestId("cc-attention-godaddy")).toHaveTextContent(
      /official initial contention sets/i,
    );
  });

  it("supports compact zero-change and fuller non-zero change monitoring", () => {
    const { feed, zeroChangeFeed } = makeRepresentativeFeed();

    const zero = render(
      <CommandCenterOrientationV2
        document={makeDocument()}
        claimActuality={promotedClaim()}
        godaddyUniqueContentionSets={66}
        changeFeed={zeroChangeFeed}
      />,
    );
    expect(screen.getByTestId("cc-recent-changes")).toHaveAttribute("data-change-state", "zero");
    expect(screen.getByTestId("cc-attention-changes-none")).toBeInTheDocument();
    zero.unmount();

    render(
      <CommandCenterOrientationV2
        document={makeDocument()}
        claimActuality={promotedClaim()}
        godaddyUniqueContentionSets={66}
        changeFeed={feed}
      />,
    );
    expect(screen.getByTestId("cc-recent-changes")).toHaveAttribute("data-change-state", "nonzero");
    expect(screen.getByTestId("cc-attention-changes-count")).toBeInTheDocument();
    expect(screen.getByTestId("cc-recent-changes-top")).toBeInTheDocument();
  });

  it("preserves all final investigation destinations", () => {
    render(
      <CommandCenterOrientationV2
        document={makeDocument()}
        claimActuality={promotedClaim()}
        godaddyUniqueContentionSets={66}
      />,
    );
    expect(screen.getByTestId("cc-v2-competitive-landscape-cta")).toHaveAttribute(
      "href",
      "/competitive-landscape",
    );
    expect(screen.getByTestId("cc-v2-explore-applications-cta")).toHaveAttribute("href", "/explore");
    expect(screen.getByTestId("cc-v2-search-records-cta")).toHaveAttribute("href", "/explore");
    expect(screen.getByTestId("cc-v2-contention-cta")).toHaveAttribute("href", "/contention");
  });
});
