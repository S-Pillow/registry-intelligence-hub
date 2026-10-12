// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CompetitiveLandscapeContent } from "@/components/registry/competitive-landscape-content";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  type ParticipantOverlays,
} from "@/lib/participant-intelligence";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
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

function makeApp(
  id: string,
  applicant: string,
  opts?: { region?: string; sets?: string[] },
): RegistryApplicationsDocumentV2["applications"][number] {
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
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    appliedString: { sourceRowId: id, label: id.toLowerCase() },
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

function makeDocument(): RegistryApplicationsDocumentV2 {
  const applications = [
    makeApp("A1", "Alpha Registry LLC", { sets: ["1"] }),
    makeApp("A2", "Alpha Registry LLC"),
    makeApp("B1", "Beta Names Inc", { sets: ["1"], region: "EU" }),
    makeApp("G1", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { sets: ["1"] }),
    makeApp("G2", GODADDY_FOCAL_APPLICANT_LEGAL_NAME),
    makeApp("M1", "Microsoft Corporation"),
    makeApp("U1", "Unresolved Applicant GmbH", { region: "EU" }),
  ];
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "promoted-2026",
    snapshotId: "snap-landscape-test",
    snapshotContentHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: "2026-10-07T15:41:26.522Z",
    retrievedAt: "2026-10-08T04:12:50Z",
    checkedAt: "2026-10-08T11:00:00Z",
    parserVersion: "test",
    normalizerVersion: "test",
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
      observed: applications.length,
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
    observedApplicationRecords: applications.length,
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
    applications,
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: "contention-test",
      sidecarContentSha256: "c".repeat(64),
      rawSha256: "d".repeat(64),
      applicationPublicationPinHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
      officialContentionSetCount: 263,
      joinedMemberCount: 891,
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
      applicantLegalName: "Microsoft Corporation",
      resolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "organization:resolved-2026:hist-2012-microsoft",
      confirmedOrganizationName: "Microsoft Corporation",
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
      applicantLegalName: "Microsoft Corporation",
      organization2026Id: "organization:resolved-2026:hist-2012-microsoft",
      applications2012: 11,
      applications2026: 2,
      applicationDelta: -9,
      portfolioChange: "CONTRACTED",
    },
  ],
};

function renderLandscape(document = makeDocument()) {
  const resolution: HubRegistryDataResolution = {
    status: "ok",
    mode: "promoted-2026-v2",
    selectionReason: "promoted-active",
    document: null,
    documentV2: document,
    documentVersion: "2.0.0",
    activeSourceError: null,
  };
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={resolution}>
        <CompetitiveLandscapeContent overlays={overlays} />
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("CompetitiveLandscapeContent", () => {
  it("renders orientation, dual GoDaddy roles, counterparts, and full participant landscape", () => {
    renderLandscape();
    expect(screen.getByTestId("competitive-landscape")).toBeInTheDocument();
    expect(screen.getByTestId("competitive-landscape")).toHaveTextContent(
      /Applicant legal names currently represented in RIH/i,
    );
    expect(screen.getByTestId("competitive-landscape")).not.toHaveTextContent(/Full-coverage/i);
    expect(screen.getByRole("link", { name: "Data & methodology" })).toHaveAttribute("href", "/data-health");
    expect(screen.getByTestId("landscape-orientation")).toHaveTextContent("1,615");
    expect(screen.getByTestId("landscape-orientation")).toHaveTextContent("481");
    expect(screen.getByTestId("godaddy-as-applicant")).toHaveTextContent(GODADDY_FOCAL_APPLICANT_LEGAL_NAME);
    expect(screen.getByTestId("godaddy-as-applicant")).toHaveTextContent(/prospective Registry Operator/i);
    expect(screen.getByTestId("focal-applications")).toHaveTextContent("2");
    expect(within(screen.getByTestId("godaddy-as-applicant")).getByTestId("org-confirmed-badge")).toHaveTextContent(
      /GoDaddy/,
    );
    expect(screen.getByTestId("godaddy-as-rsp")).toHaveTextContent(/GoDaddy Registry/);
    expect(screen.getByTestId("godaddy-as-rsp")).toHaveTextContent(/Evaluated/);
    expect(screen.getByTestId("selected-rsp-limitation")).toHaveTextContent(
      /does not disclose which RSP an Applicant selected/i,
    );
    expect(screen.getByTestId("rsp-source-freshness")).toHaveTextContent(/ICANN/);
    expect(screen.getByTestId("godaddy-contention-counterparts")).toHaveTextContent("Alpha Registry LLC");
    expect(screen.getByTestId("godaddy-contention-counterparts")).toHaveTextContent("Beta Names Inc");
    expect(screen.getByTestId("participant-table")).toBeInTheDocument();
    expect(screen.getByTestId("visible-participant-count")).toHaveTextContent("Showing 5 / 5");
    expect(screen.getByTestId("returning-badge")).toHaveTextContent(/Returning/);
    expect(screen.queryByText(/new participant/i)).not.toBeInTheDocument();
    expect(screen.getByText("Unresolved Applicant GmbH")).toBeInTheDocument();
    expect(screen.getAllByText(/Not yet resolved/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Not resolved$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Not confirmed$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/available customer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unassigned RSP/i)).not.toBeInTheDocument();
  });

  it("supports search and confirmed-Organization filter", async () => {
    const user = userEvent.setup();
    renderLandscape();
    await user.type(screen.getByTestId("participant-search"), "Microsoft");
    expect(screen.getByTestId("visible-participant-count")).toHaveTextContent("Showing 1 / 5");
    await user.clear(screen.getByTestId("participant-search"));
    await user.click(screen.getByTestId("filter-confirmed-org"));
    expect(screen.getByTestId("visible-participant-count")).toHaveTextContent("Showing 2 / 5");
  });

  it("links Applicant rows to Applicant profile deep links", () => {
    renderLandscape();
    const profileLinks = screen.getAllByRole("link", { name: GODADDY_FOCAL_APPLICANT_LEGAL_NAME });
    expect(profileLinks.length).toBeGreaterThan(0);
    expect(profileLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining(`/applicant?name=${encodeURIComponent(GODADDY_FOCAL_APPLICANT_LEGAL_NAME)}`),
    );
  });

  it("switches to RSP research surface with factual posture labels and limitation copy", async () => {
    const user = userEvent.setup();
    renderLandscape();
    await user.click(screen.getByTestId("cta-explore-rsp-prospects"));
    expect(screen.getByTestId("rsp-prospects-surface")).toBeInTheDocument();
    expect(screen.getByTestId("rsp-prospects-surface")).toHaveTextContent(/public RSP posture/i);
    expect(screen.getByTestId("rsp-prospects-surface")).toHaveTextContent(
      /No public Main-RSP capability found/i,
    );
    expect(screen.getByTestId("rsp-prospects-surface")).toHaveTextContent(
      /does not imply commercial availability/i,
    );
    expect(screen.getByTestId("largest-no-public-main-rsp")).toHaveTextContent(
      /Largest Applicants without a public Main-RSP capability match/i,
    );
    expect(screen.getByTestId("rsp-prospect-table")).toBeInTheDocument();
    expect(screen.queryByText(/Potential RSP prospect/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("org-mapping-explainer")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("rsp-prospect-table")).queryByText(GODADDY_FOCAL_APPLICANT_LEGAL_NAME),
    ).not.toBeInTheDocument();
  });
});
