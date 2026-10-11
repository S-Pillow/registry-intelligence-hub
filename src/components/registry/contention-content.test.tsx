// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentionContent, CommandCenterContentionCard } from "@/components/registry/contention-content";
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
import { CommandCenter } from "@/components/registry/command-center";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/contention",
  useSearchParams: () => new URLSearchParams(),
}));

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
  opts?: { region?: string; sets?: string[]; label?: string },
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

function makeDocument(): RegistryApplicationsDocumentV2 {
  const applications = [
    makeApp("A1", "Alpha Registry LLC", { sets: ["10"], label: "cloud" }),
    makeApp("A2", "Alpha Registry LLC", { sets: ["10"], label: "cloud" }),
    makeApp("B1", "Beta Names Inc", { sets: ["10"], label: "cloud", region: "EU" }),
    makeApp("G1", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { sets: ["10"], label: "cloud" }),
    makeApp("G2", GODADDY_FOCAL_APPLICANT_LEGAL_NAME, { sets: ["20"], label: "shop" }),
    makeApp("D1", "Delta Domains SA", { sets: ["20"], label: "shop" }),
    makeApp("S1", "Solo Applicant Ltd", { sets: ["30"], label: "solo" }),
    makeApp("U1", "Unresolved Applicant GmbH"),
  ];
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "promoted-2026",
    snapshotId: "snap-contention-ui",
    snapshotContentHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: "2026-10-07T15:41:26.522Z",
    retrievedAt: "2026-10-08T04:12:50Z",
    checkedAt: "2026-10-08T11:00:00Z",
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
        retrievedAt: "2026-10-08T04:12:50Z",
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
      snapshotId: "cont-ui",
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

function renderContention(props?: { initialView?: "godaddy" | "all"; initialSet?: string; initialQ?: string }) {
  const document = makeDocument();
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
        <ContentionContent overlays={overlays} {...props} />
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("ContentionContent", () => {
  it("renders /contention orientation, GoDaddy exposure default, and metrics", () => {
    renderContention();
    expect(screen.getByTestId("contention-page")).toBeInTheDocument();
    expect(screen.getByTestId("contention-heading")).toHaveTextContent("2026 contention landscape");
    expect(screen.getByTestId("contention-initial-disclosure")).toHaveTextContent(/may change/i);
    expect(screen.getByTestId("metric-official-sets")).toHaveTextContent("3");
    expect(screen.getByTestId("metric-official-memberships")).toHaveTextContent("7");
    expect(screen.getByTestId("metric-godaddy-memberships")).toHaveTextContent("2");
    expect(screen.getByTestId("metric-unique-godaddy-sets")).toHaveTextContent("2");
    expect(screen.getByTestId("view-godaddy-exposure")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("contention-sets-table")).toBeInTheDocument();
    expect(screen.queryByTestId("contention-row-30")).not.toBeInTheDocument();
    expect(screen.getByTestId("contention-row-10")).toBeInTheDocument();
  });

  it("switches to all sets and filters GoDaddy involvement", async () => {
    const user = userEvent.setup();
    renderContention();
    await user.click(screen.getByTestId("view-all-sets"));
    expect(screen.getByTestId("contention-row-30")).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId("filter-godaddy"), "excludes-godaddy");
    expect(screen.getByTestId("contention-row-30")).toBeInTheDocument();
    expect(screen.queryByTestId("contention-row-10")).not.toBeInTheDocument();
  });

  it("searches by string, Applicant, and Application ID", async () => {
    const user = userEvent.setup();
    renderContention({ initialView: "all" });
    const search = screen.getByTestId("contention-search");
    await user.clear(search);
    await user.type(search, "shop");
    expect(screen.getByTestId("contention-row-20")).toBeInTheDocument();
    expect(screen.queryByTestId("contention-row-10")).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "Alpha Registry");
    expect(screen.getByTestId("contention-row-10")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "G2");
    expect(screen.getByTestId("contention-row-20")).toBeInTheDocument();
  });

  it("opens set drilldown with GoDaddy member, counterparts, org labels, RSP, Explore links", async () => {
    const user = userEvent.setup();
    renderContention();
    await user.click(screen.getByTestId("contention-row-10"));
    const detail = await screen.findByTestId("contention-set-detail");
    expect(within(detail).getByTestId("detail-total-apps")).toHaveTextContent("4");
    expect(within(detail).getByTestId("detail-distinct-applicants")).toHaveTextContent("3");
    expect(within(detail).getByTestId("detail-godaddy-present")).toBeInTheDocument();
    expect(within(detail).getAllByTestId("godaddy-member-badge").length).toBeGreaterThan(0);
    expect(within(detail).getByTestId("set-counterpart-context")).toHaveTextContent("Alpha Registry LLC");
    expect(within(detail).getAllByTestId("org-candidate-badge")[0]).toHaveTextContent("Candidate match");
    expect(within(detail).getByTestId("org-mapping-explainer")).toBeInTheDocument();
    expect(within(detail).getAllByRole("link", { name: /Explore Application/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/explore?q="),
    );
    expect(within(detail).getAllByRole("link", { name: /Competitive Landscape/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/competitive-landscape"),
    );
    expect(detail).toHaveTextContent(/No public Main-RSP capability found|Relevant for RSP research|Public Main-RSP/i);
  });

  it("opens non-GoDaddy set without implying GoDaddy presence", async () => {
    renderContention({ initialView: "all", initialSet: "30" });
    const detail = await screen.findByTestId("contention-set-detail");
    expect(within(detail).getByTestId("detail-godaddy-absent")).toBeInTheDocument();
    expect(within(detail).queryByTestId("godaddy-member-badge")).not.toBeInTheDocument();
  });

  it("shows empty filter state", async () => {
    const user = userEvent.setup();
    renderContention({ initialView: "all" });
    await user.type(screen.getByTestId("contention-search"), "zzznomatch");
    expect(screen.getByTestId("contention-empty-filter")).toBeInTheDocument();
  });

  it("primary nav includes Contention", () => {
    render(<CommandCenter presentation="rehearsal" changeFeed={{ initialized: false }} />);
    const nav = screen.getByTestId("hub-primary-nav");
    expect(within(nav).getByRole("link", { name: "Contention" })).toHaveAttribute(
      "href",
      "/contention?presentation=rehearsal",
    );
  });
});

describe("CommandCenterContentionCard", () => {
  it("shows compact counts and Explore contention CTA", () => {
    render(
      <CommandCenterContentionCard officialSets={263} officialMemberships={891} uniqueGodaddySets={42} />,
    );
    expect(screen.getByTestId("cc-contention-sets")).toHaveTextContent("263");
    expect(screen.getByTestId("cc-contention-memberships")).toHaveTextContent("891");
    expect(screen.getByTestId("cc-contention-godaddy-sets")).toHaveTextContent("42");
    expect(screen.getByTestId("cc-explore-contention-cta")).toHaveAttribute("href", "/contention");
  });
});
