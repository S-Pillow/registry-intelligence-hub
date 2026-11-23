// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicantProfileContent } from "@/components/registry/applicant-profile-content";
import { OrganizationProfileContent } from "@/components/registry/organization-profile-content";
import type { ApplicantIntelligenceLookup, ApplicantPortfolioRow } from "@/lib/applicant-intelligence";
import type { OrganizationIntelligenceLookup, OrganizationPortfolioRow } from "@/lib/organization-intelligence";
import type { ParticipantRow } from "@/lib/participant-intelligence";
import type { ApplicantRspPosture } from "@/lib/rsp-opportunity-intelligence";
import type { ApplicationStringStatusObservation, ApplicationStringStatusSummary } from "@/lib/application-string-status";

afterEach(() => cleanup());

const readyObservation: ApplicationStringStatusObservation = {
  applicationSnapshotId: "snap-aps-2026-applications-string-confirmation-v1",
  publishedAt: "2026-11-17T00:00:00.000Z",
  retrievedAt: "2026-11-18T21:23:17.000Z",
  contentionSnapshotId: "snap-aps-2026-contention-string-confirmation-v1",
  contentionOverlayStatus: "available",
  scdContentionEvidence: "ready",
  publicationBasisLabel: "String Confirmation Day application + contention capture",
};

const unavailableObservation: ApplicationStringStatusObservation = {
  applicationSnapshotId: "snap-aps-2026-applications-reveal-day-v1",
  publishedAt: "2026-10-07T00:00:00Z",
  retrievedAt: "2026-10-08T00:00:00Z",
  contentionSnapshotId: "snap-aps-2026-contention-reveal-day-v1",
  contentionOverlayStatus: "available",
  scdContentionEvidence: "unavailable",
  publicationBasisLabel:
    "Reveal Day / historical publication basis — SCD contention status not activated on this observation",
};

function mkApplicantRow(
  partial: Partial<ApplicantPortfolioRow> & Pick<ApplicantPortfolioRow, "applicationId" | "appliedForString">,
): ApplicantPortfolioRow {
  return {
    originalAppliedForString: partial.appliedForString,
    selectedCurrentString: partial.appliedForString,
    selectedReplacementApplicationId: null,
    replacementStringLabel: null,
    selectionMode: "original-only",
    selectionUnresolvedReason: null,
    currentApplicationStatus: "Active",
    brand: false,
    community: false,
    idn: false,
    geographic: false,
    applicationStatus: "Active",
    processingStage: "IE",
    region: "NA",
    country: "US",
    inInitialContention: false,
    officialContentionSetIds: [],
    scdContentionStatus: "uncontested_in_scd_capture",
    scdContentionSetId: null,
    competitors: [],
    officialAwardOutcome: "not_established",
    contentionSetHref: null,
    exploreHref: `/explore?q=${partial.applicationId}`,
    ...partial,
  };
}

function applicantLookup(args: {
  observation?: ApplicationStringStatusObservation;
  summary?: Partial<ApplicationStringStatusSummary>;
  portfolio: ApplicantPortfolioRow[];
}): ApplicantIntelligenceLookup {
  const observation = args.observation ?? readyObservation;
  const portfolio = args.portfolio;
  const summary: ApplicationStringStatusSummary = {
    applicationCount: portfolio.length,
    selectedReplacements: portfolio.filter((r) => r.selectionMode === "selected-replacement").length,
    activeUncontestedInScdCapture: portfolio.filter(
      (r) => r.scdContentionStatus === "uncontested_in_scd_capture",
    ).length,
    activeContestedInScdCapture: portfolio.filter((r) => r.scdContentionStatus === "contested").length,
    withdrawnSelected: 0,
    unresolvedSelections: 0,
    awardEstablishedCount: 0,
    ...args.summary,
  };
  return {
    found: true,
    applicantLegalName: "Registry Services, LLC",
    profileHref: "/applicant?name=Registry%20Services%2C%20LLC",
    countries: ["US"],
    regions: ["NA"],
    organizationResolutionStatus: "CONFIRMED",
    confirmedOrganizationId: "organization:resolved-2026:godaddy-registry-services",
    confirmedOrganizationName: "GoDaddy (Registry Services, LLC)",
    organizationProfileHref: "/organization?key=godaddy-registry-services",
    identityEvidence: null,
    brandApplicationCount: 1,
    applicationCount: portfolio.length,
    contestedApplicationCount: summary.activeContestedInScdCapture,
    uniqueContentionSets: 1,
    distinctCounterpartApplicants: 1,
    rspPosture: "PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
    rspPostureLabel: "Public Main-RSP capability found",
    rspProspectingReason: "test",
    portfolio,
    stringStatusObservation: observation,
    stringStatusSummary: summary,
    contentionSets: [],
    counterparts: [],
    organizationContext: null,
    confirmedReturning: null,
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine: "none",
      changesHref: "/changes",
    },
    exploreApplicationsHref: "/explore",
    exploreApplicantHref: "/explore",
    competitiveLandscapeHref: "/competitive-landscape",
    contentionHref: "/contention",
    participantRow: { applicantLegalName: "Registry Services, LLC" } as ParticipantRow,
    rspRow: { applicantLegalName: "Registry Services, LLC" } as ApplicantRspPosture,
  };
}

function mkOrgRow(
  partial: Partial<OrganizationPortfolioRow> &
    Pick<OrganizationPortfolioRow, "applicationId" | "appliedForString" | "applicantLegalName">,
): OrganizationPortfolioRow {
  return {
    originalAppliedForString: partial.appliedForString,
    selectedCurrentString: partial.appliedForString,
    selectedReplacementApplicationId: null,
    replacementStringLabel: null,
    selectionMode: "original-only",
    selectionUnresolvedReason: null,
    currentApplicationStatus: "Active",
    brand: false,
    applicationStatus: "Active",
    inInitialContention: false,
    officialContentionSetIds: [],
    scdContentionStatus: "uncontested_in_scd_capture",
    scdContentionSetId: null,
    competitors: [],
    officialAwardOutcome: "not_established",
    contentionSetHref: null,
    exploreHref: `/explore?q=${partial.applicationId}`,
    applicantProfileHref: `/applicant?name=${encodeURIComponent(partial.applicantLegalName)}`,
    ...partial,
  };
}

function orgLookup(args: {
  observation?: ApplicationStringStatusObservation;
  portfolio: OrganizationPortfolioRow[];
}): OrganizationIntelligenceLookup {
  const observation = args.observation ?? readyObservation;
  const portfolio = args.portfolio;
  const applicants = [...new Set(portfolio.map((p) => p.applicantLegalName))].map((name) => ({
    applicantLegalName: name,
    applicationCount: portfolio.filter((p) => p.applicantLegalName === name).length,
    brandApplicationCount: 0,
    contentionMemberships: 0,
    contestedApplicationCount: 0,
    countries: ["US"],
    regions: ["NA"],
    applicantWebsiteHost: null,
    applicantWebsiteUrl: null,
    profileHref: `/applicant?name=${encodeURIComponent(name)}`,
    identityEvidence: null,
  }));
  const summary: ApplicationStringStatusSummary = {
    applicationCount: portfolio.length,
    selectedReplacements: portfolio.filter((r) => r.selectionMode === "selected-replacement").length,
    activeUncontestedInScdCapture: portfolio.filter(
      (r) => r.scdContentionStatus === "uncontested_in_scd_capture",
    ).length,
    activeContestedInScdCapture: portfolio.filter((r) => r.scdContentionStatus === "contested").length,
    withdrawnSelected: 0,
    unresolvedSelections: 0,
    awardEstablishedCount: 0,
  };
  return {
    found: true,
    organizationKey: "demo-org",
    organizationId: "organization:resolved-2026:demo-org",
    canonicalName: "Demo Organization",
    profileHref: "/organization?key=demo-org",
    applicantEntityCount: applicants.length,
    applicationCount: portfolio.length,
    brandApplicationCount: 0,
    contestedApplicationCount: summary.activeContestedInScdCapture,
    contentionMemberships: summary.activeContestedInScdCapture,
    uniqueContentionSets: 1,
    distinctExternalCounterpartApplicants: 0,
    applicants,
    portfolio,
    stringStatusObservation: observation,
    stringStatusSummary: summary,
    contentionSets: [],
    counterparts: [],
    evidenceSummary: { mappingCount: applicants.length, evidenceTypeLabels: [] },
    confirmedReturning: null,
    historicalLineages: [],
    rspAmongMappedApplicants: {
      publicMainRspCapableCount: 0,
      noPublicMainRspCount: applicants.length,
      viaConfirmedOrganizationCount: 0,
      identityReviewCount: 0,
      postures: [],
    },
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine: "none",
      changesHref: "/changes",
    },
    exploreApplicationsHref: "/explore",
    competitiveLandscapeHref: "/competitive-landscape",
    contentionHref: "/contention",
  };
}

const samplePortfolio: ApplicantPortfolioRow[] = [
  mkApplicantRow({
    applicationId: "A1",
    appliedForString: "brand",
    selectedCurrentString: "master",
    selectionMode: "selected-replacement",
    selectedReplacementApplicationId: "A1-R",
    scdContentionStatus: "uncontested_in_scd_capture",
  }),
  mkApplicantRow({
    applicationId: "A2",
    appliedForString: "force",
    scdContentionStatus: "contested",
    scdContentionSetId: "76",
    competitors: [
      {
        applicationId: "S1",
        applicantLegalName: "Salesforce, Inc.",
        appliedForString: "force",
      },
    ],
    contentionSetHref: "/contention?set=76",
  }),
  mkApplicantRow({
    applicationId: "A3",
    appliedForString: "cloud",
    scdContentionStatus: "uncontested_in_scd_capture",
  }),
  mkApplicantRow({
    applicationId: "A4",
    appliedForString: "shop",
    selectionMode: "selected-replacement",
    selectedCurrentString: "store",
    selectedReplacementApplicationId: "A4-R",
    scdContentionStatus: "contested",
    scdContentionSetId: "10",
    contentionSetHref: "/contention?set=10",
  }),
];

describe("SCD profile summary UX — Applicant", () => {
  it("renders exact plain-English labels and filters portfolio rows", () => {
    render(
      <ApplicantProfileContent
        lookup={applicantLookup({
          portfolio: samplePortfolio,
          summary: {
            applicationCount: 4,
            activeUncontestedInScdCapture: 2,
            activeContestedInScdCapture: 2,
            selectedReplacements: 2,
          },
        })}
      />,
    );

    expect(screen.getByTestId("scd-summary-total")).toHaveTextContent("Total applications");
    expect(screen.getByTestId("scd-summary-total")).toHaveTextContent("4");
    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent(
      "Applications with no published competitors",
    );
    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent("2");
    expect(screen.getByTestId("scd-summary-contested")).toHaveTextContent(
      "Applications facing competition",
    );
    expect(screen.getByTestId("scd-summary-contested")).toHaveTextContent("2");
    expect(screen.getByTestId("scd-summary-replacements")).toHaveTextContent(
      "Replacement strings selected",
    );
    expect(screen.getByTestId("scd-summary-replacements")).toHaveTextContent("2");
    expect(screen.getByTestId("portfolio-filter-no_scd_contention")).toHaveTextContent(
      "Applications with no published competitors",
    );
    expect(screen.getByTestId("portfolio-filter-still_in_contention")).toHaveTextContent(
      "Applications facing competition",
    );
    expect(screen.getByTestId("portfolio-filter-selected_replacements")).toHaveTextContent(
      "Replacement strings selected",
    );
    expect(screen.getByTestId("profile-source-line")).toHaveTextContent(
      /ICANN String Confirmation Day · November 18, 2026 capture/i,
    );
    expect(screen.getByTestId("profile-source-summary")).toHaveTextContent(
      /none are recorded in the published contention data/i,
    );
    expect(screen.getByTestId("profile-source-line")).not.toHaveTextContent(/SCD contention/i);
    expect(screen.getByTestId("scd-profile-summary")).not.toHaveTextContent(/SCD contention/i);
    expect(screen.getByTestId("source-details")).toBeInTheDocument();
    expect(screen.getByTestId("stat-contested")).toHaveTextContent(
      "Applications facing competition",
    );
    expect(screen.getByRole("columnheader", { name: "Competition status" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("scd-summary-uncontested"));
    const table = screen.getByTestId("portfolio-table");
    expect(within(table).getByTestId("portfolio-row-A1")).toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-row-A3")).toBeInTheDocument();
    expect(within(table).queryByTestId("portfolio-row-A2")).not.toBeInTheDocument();
    expect(screen.getByTestId("portfolio-filter-count")).toHaveTextContent("Showing 2 of 4");

    fireEvent.click(screen.getByTestId("scd-summary-contested"));
    expect(within(table).getByTestId("portfolio-row-A2")).toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-row-A4")).toBeInTheDocument();
    expect(within(table).queryByTestId("portfolio-row-A3")).not.toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-contention-link-A2")).toHaveAttribute(
      "href",
      "/contention?set=76",
    );

    fireEvent.click(screen.getByTestId("scd-summary-replacements"));
    expect(within(table).getByTestId("portfolio-row-A1")).toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-row-A4")).toBeInTheDocument();
    expect(within(table).queryByTestId("portfolio-row-A2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("portfolio-filter-clear"));
    expect(within(table).getByTestId("portfolio-row-A2")).toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-row-A3")).toBeInTheDocument();
  });

  it("shows unavailable competing/contested state instead of zeros when evidence is missing", () => {
    render(
      <ApplicantProfileContent
        lookup={applicantLookup({
          observation: unavailableObservation,
          portfolio: samplePortfolio.map((r) => ({
            ...r,
            scdContentionStatus: "unavailable",
            competitors: [],
            contentionSetHref: null,
            scdContentionSetId: null,
          })),
          summary: {
            applicationCount: 4,
            activeUncontestedInScdCapture: 0,
            activeContestedInScdCapture: 0,
            selectedReplacements: 2,
          },
        })}
      />,
    );
    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent(/Unavailable/i);
    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent(
      /Published contention data not available/i,
    );
    expect(screen.getByTestId("scd-summary-contested")).toHaveTextContent(/Unavailable/i);
    expect(screen.getByTestId("scd-summary-replacements")).toHaveTextContent("2");
    expect(screen.getByTestId("profile-source-line")).toHaveTextContent(/Reveal Day/i);
    expect(screen.getByTestId("stat-contested")).toHaveTextContent(/In initial contention/i);
    expect(screen.getByTestId("scd-profile-summary")).not.toHaveTextContent(/SCD contention/i);
  });

  it("keeps Active-status consistency between contested card count and filtered rows", () => {
    const portfolio = [
      ...samplePortfolio,
      mkApplicantRow({
        applicationId: "A5",
        appliedForString: "legacy",
        currentApplicationStatus: "Deactivated",
        applicationStatus: "Deactivated",
        scdContentionStatus: "contested",
        scdContentionSetId: "99",
      }),
    ];
    render(
      <ApplicantProfileContent
        lookup={applicantLookup({
          portfolio,
          summary: {
            applicationCount: 5,
            activeUncontestedInScdCapture: 2,
            activeContestedInScdCapture: 2,
            selectedReplacements: 2,
          },
        })}
      />,
    );
    expect(screen.getByTestId("scd-summary-contested")).toHaveTextContent("2");
    fireEvent.click(screen.getByTestId("scd-summary-contested"));
    const table = screen.getByTestId("portfolio-table");
    expect(within(table).getByTestId("portfolio-row-A2")).toBeInTheDocument();
    expect(within(table).getByTestId("portfolio-row-A4")).toBeInTheDocument();
    expect(within(table).queryByTestId("portfolio-row-A5")).not.toBeInTheDocument();
    expect(screen.getByTestId("portfolio-filter-count")).toHaveTextContent("Showing 2 of 5");
  });
});

describe("SCD profile summary UX — Organization", () => {
  it("filters multi-applicant portfolio from summary cards with plain-English labels", () => {
    const portfolio: OrganizationPortfolioRow[] = [
      mkOrgRow({
        applicationId: "B1",
        appliedForString: "alpha",
        applicantLegalName: "Applicant One, LLC",
        scdContentionStatus: "uncontested_in_scd_capture",
      }),
      mkOrgRow({
        applicationId: "B2",
        appliedForString: "beta",
        applicantLegalName: "Applicant Two, Inc.",
        scdContentionStatus: "contested",
        scdContentionSetId: "9",
        competitors: [
          {
            applicationId: "X1",
            applicantLegalName: "Other Applicant",
            appliedForString: "beta",
          },
        ],
        contentionSetHref: "/contention?set=9",
      }),
      mkOrgRow({
        applicationId: "B3",
        appliedForString: "gamma",
        selectedCurrentString: "delta",
        selectionMode: "selected-replacement",
        selectedReplacementApplicationId: "B3-R",
        applicantLegalName: "Applicant One, LLC",
        scdContentionStatus: "uncontested_in_scd_capture",
      }),
    ];

    render(<OrganizationProfileContent lookup={orgLookup({ portfolio })} />);

    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent(
      "Applications with no published competitors",
    );
    expect(screen.getByTestId("scd-summary-replacements")).toHaveTextContent(
      "Replacement strings selected",
    );
    expect(screen.getByTestId("scd-summary-total")).toHaveTextContent("3");
    expect(screen.getByTestId("scd-summary-uncontested")).toHaveTextContent("2");
    expect(screen.getByTestId("scd-summary-contested")).toHaveTextContent("1");
    expect(screen.getByTestId("scd-summary-replacements")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("scd-summary-contested"));
    const table = screen.getByTestId("org-portfolio-table");
    expect(within(table).getByTestId("org-portfolio-row-B2")).toBeInTheDocument();
    expect(within(table).queryByTestId("org-portfolio-row-B1")).not.toBeInTheDocument();
    expect(within(table).getByText(/Other Applicant/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("scd-summary-replacements"));
    expect(within(table).getByTestId("org-portfolio-row-B3")).toBeInTheDocument();
    expect(within(table).queryByTestId("org-portfolio-row-B2")).not.toBeInTheDocument();
    expect(within(table).getByText(".delta")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("portfolio-filter-clear"));
    expect(within(table).getByTestId("org-portfolio-row-B1")).toBeInTheDocument();
    expect(within(table).getByTestId("org-portfolio-row-B2")).toBeInTheDocument();
  });

  it("clears Applicant/Brand/Contention/Search filters when a summary card is clicked", () => {
    const portfolio: OrganizationPortfolioRow[] = [
      mkOrgRow({
        applicationId: "B1",
        appliedForString: "alpha",
        applicantLegalName: "Applicant One, LLC",
        brand: true,
        scdContentionStatus: "uncontested_in_scd_capture",
      }),
      mkOrgRow({
        applicationId: "B2",
        appliedForString: "beta",
        applicantLegalName: "Applicant Two, Inc.",
        brand: false,
        scdContentionStatus: "contested",
        scdContentionSetId: "9",
        contentionSetHref: "/contention?set=9",
      }),
      mkOrgRow({
        applicationId: "B3",
        appliedForString: "gamma",
        applicantLegalName: "Applicant One, LLC",
        brand: false,
        scdContentionStatus: "uncontested_in_scd_capture",
      }),
    ];

    render(<OrganizationProfileContent lookup={orgLookup({ portfolio })} />);

    fireEvent.change(screen.getByTestId("portfolio-filter-applicant"), {
      target: { value: "Applicant One, LLC" },
    });
    fireEvent.change(screen.getByTestId("portfolio-filter-brand"), {
      target: { value: "brand" },
    });
    fireEvent.change(screen.getByTestId("portfolio-filter-contention"), {
      target: { value: "out" },
    });
    fireEvent.change(screen.getByTestId("portfolio-search"), {
      target: { value: "alpha" },
    });

    const table = screen.getByTestId("org-portfolio-table");
    expect(within(table).getByTestId("org-portfolio-row-B1")).toBeInTheDocument();
    expect(within(table).queryByTestId("org-portfolio-row-B2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("scd-summary-contested"));
    expect(screen.getByTestId("portfolio-filter-applicant")).toHaveValue("all");
    expect(screen.getByTestId("portfolio-filter-brand")).toHaveValue("all");
    expect(screen.getByTestId("portfolio-filter-contention")).toHaveValue("all");
    expect(screen.getByTestId("portfolio-search")).toHaveValue("");
    expect(within(table).getByTestId("org-portfolio-row-B2")).toBeInTheDocument();
    expect(within(table).queryByTestId("org-portfolio-row-B1")).not.toBeInTheDocument();
    expect(screen.getByTestId("org-portfolio-filter-count")).toHaveTextContent("Showing 1 of 3");

    fireEvent.change(screen.getByTestId("portfolio-filter-applicant"), {
      target: { value: "Applicant Two, Inc." },
    });
    fireEvent.click(screen.getByTestId("portfolio-filter-clear"));
    expect(screen.getByTestId("portfolio-filter-applicant")).toHaveValue("all");
    expect(within(table).getByTestId("org-portfolio-row-B1")).toBeInTheDocument();
    expect(within(table).getByTestId("org-portfolio-row-B2")).toBeInTheDocument();
    expect(within(table).getByTestId("org-portfolio-row-B3")).toBeInTheDocument();
  });
});
