// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicantProfileContent } from "@/components/registry/applicant-profile-content";
import type { ApplicantIntelligenceLookup } from "@/lib/applicant-intelligence";
import type { ParticipantRow } from "@/lib/participant-intelligence";
import type { ApplicantRspPosture } from "@/lib/rsp-opportunity-intelligence";

afterEach(() => cleanup());

function baseProfile(overrides: Partial<Extract<ApplicantIntelligenceLookup, { found: true }>> = {}): ApplicantIntelligenceLookup {
  const participantRow = {
    applicantLegalName: "Salesforce, Inc.",
    applicationCount: 4,
    shareOfObservedApplications: 0,
    contestedApplicationCount: 0,
    officialContentionMemberships: 0,
    officialContentionSetsTouched: 0,
    contentionRate: 0,
    regions: ["NA"],
    countries: ["US"],
    designationCounts: { idn: 0, brand: 4, community: 0, geographic: 0 },
    applicationIds: ["1", "2", "3", "4"],
    organizationResolutionStatus: "CONFIRMED",
    confirmedOrganizationId: "organization:resolved-2026:salesforce",
    confirmedOrganizationName: "Salesforce",
    identityEvidence: {
      applicantWebsiteHost: "salesforce.com",
      applicantWebsiteUrl: "https://www.salesforce.com",
      directParentLegalName: null,
      ultimateParentLegalName: null,
      ultimateControlLegalName: null,
      evidenceExplanationLines: ["Self-identity website evidence"],
    },
    confirmedReturning: null,
    rankByApplications: 1,
    rankByContentionExposure: 1,
  } as ParticipantRow;

  const rspRow = {
    applicantLegalName: "Salesforce, Inc.",
    rspProspectingPosture: "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
    rspProspectingReason: "No public Main-RSP capability found",
  } as ApplicantRspPosture;

  return {
    found: true,
    applicantLegalName: "Salesforce, Inc.",
    profileHref: "/applicant?name=Salesforce%2C%20Inc.",
    countries: ["US"],
    regions: ["NA"],
    organizationResolutionStatus: "CONFIRMED",
    confirmedOrganizationId: "organization:resolved-2026:salesforce",
    confirmedOrganizationName: "Salesforce",
    identityEvidence: participantRow.identityEvidence,
    brandApplicationCount: 4,
    applicationCount: 4,
    contestedApplicationCount: 0,
    uniqueContentionSets: 0,
    distinctCounterpartApplicants: 0,
    rspPosture: "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
    rspPostureLabel: "No public Main-RSP capability found",
    rspProspectingReason: "No public Main-RSP capability found",
    portfolio: [
      {
        applicationId: "SF1",
        appliedForString: "force",
        brand: true,
        community: false,
        idn: false,
        geographic: false,
        applicationStatus: "Active",
        processingStage: "IE",
        region: "NA",
        country: "US",
        inInitialContention: false,
        officialContentionSetIds: [],
        exploreHref: "/explore?q=SF1",
      },
      {
        applicationId: "SF2",
        appliedForString: "salesforce",
        brand: true,
        community: false,
        idn: false,
        geographic: false,
        applicationStatus: "Active",
        processingStage: "IE",
        region: "NA",
        country: "US",
        inInitialContention: false,
        officialContentionSetIds: [],
        exploreHref: "/explore?q=SF2",
      },
      {
        applicationId: "SF3",
        appliedForString: "slack",
        brand: true,
        community: false,
        idn: false,
        geographic: false,
        applicationStatus: "Active",
        processingStage: "IE",
        region: "NA",
        country: "US",
        inInitialContention: false,
        officialContentionSetIds: [],
        exploreHref: "/explore?q=SF3",
      },
      {
        applicationId: "SF4",
        appliedForString: "tableau",
        brand: true,
        community: false,
        idn: false,
        geographic: false,
        applicationStatus: "Active",
        processingStage: "IE",
        region: "NA",
        country: "US",
        inInitialContention: false,
        officialContentionSetIds: [],
        exploreHref: "/explore?q=SF4",
      },
    ],
    contentionSets: [],
    counterparts: [],
    organizationContext: {
      organizationName: "Salesforce",
      organizationId: "organization:resolved-2026:salesforce",
      siblingApplicants: [],
      siblingApplicantCount: 0,
      organizationApplicationCount: 4,
      organizationContentionMemberships: 0,
    },
    confirmedReturning: null,
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine:
        "No material public Application or contention changes recorded since monitoring began.",
      changesHref: "/changes?q=Salesforce%2C%20Inc.",
    },
    exploreApplicationsHref: "/explore?ids=1,2,3,4",
    exploreApplicantHref: "/explore?q=Salesforce",
    competitiveLandscapeHref: "/competitive-landscape?q=Salesforce%2C%20Inc.",
    contentionHref: "/contention?view=all&q=Salesforce%2C%20Inc.",
    participantRow,
    rspRow,
    ...overrides,
  };
}

describe("ApplicantProfileContent", () => {
  it("renders Salesforce acceptance header, Brand portfolio, and Applicant vs Organization", () => {
    render(<ApplicantProfileContent lookup={baseProfile()} />);
    expect(screen.getByTestId("applicant-profile")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Salesforce, Inc.");
    expect(screen.getByTestId("header-org-distinction")).toHaveTextContent(/Broader Organization/);
    expect(screen.getByTestId("stat-applications")).toHaveTextContent("4");
    expect(screen.getByTestId("stat-brand")).toHaveTextContent("4 of 4");
    expect(screen.getByTestId("header-website")).toHaveTextContent("salesforce.com");
    expect(screen.getAllByText(".force").length).toBeGreaterThan(0);
    expect(screen.getAllByText(".slack").length).toBeGreaterThan(0);
    expect(screen.getAllByText(".tableau").length).toBeGreaterThan(0);
    expect(screen.getByTestId("applicant-portfolio-section")).toHaveTextContent(
      /not separate Organizations/i,
    );
    expect(screen.getByTestId("rsp-posture-label")).toBeInTheDocument();
    expect(screen.getByText(/Selected RSP is not established/i)).toBeInTheDocument();
  });

  it("renders clear not-found for unknown Applicant", () => {
    render(
      <ApplicantProfileContent
        lookup={{
          found: false,
          applicantLegalName: "Missing Applicant, LLC",
          profileHref: "/applicant?name=Missing%20Applicant%2C%20LLC",
        }}
      />,
    );
    expect(screen.getByTestId("applicant-profile-not-found")).toHaveTextContent(/Applicant not found/i);
    expect(screen.getByText(/Missing Applicant, LLC/)).toBeInTheDocument();
  });

  it("keeps unresolved profiles useful without empty Organization field", () => {
    render(
      <ApplicantProfileContent
        lookup={baseProfile({
          applicantLegalName: "Amazon Registry Services, Inc.",
          organizationResolutionStatus: "UNRESOLVED",
          confirmedOrganizationId: null,
          confirmedOrganizationName: null,
          organizationContext: null,
          identityEvidence: {
            applicantWebsiteHost: "amazon.com",
            applicantWebsiteUrl: "https://amazon.com",
            directParentLegalName: null,
            ultimateParentLegalName: null,
            ultimateControlLegalName: null,
            evidenceExplanationLines: [],
          },
        })}
      />,
    );
    expect(screen.getByTestId("header-unresolved-note")).toHaveTextContent(/No broader Organization mapping/i);
    expect(screen.queryByTestId("applicant-org-context-section")).not.toBeInTheDocument();
    expect(screen.getByTestId("applicant-portfolio-section")).toBeInTheDocument();
  });

  it("shows contention set visual with Applications vs Applicants and members", () => {
    render(
      <ApplicantProfileContent
        lookup={baseProfile({
          contestedApplicationCount: 2,
          uniqueContentionSets: 1,
          distinctCounterpartApplicants: 2,
          contentionSets: [
            {
              setId: "10",
              appliedForStrings: ["cloud"],
              applicationCount: 4,
              distinctApplicantCount: 3,
              applicantApplicationIds: ["SF1", "SF2"],
              includesGodaddy: true,
              contentionSetHref: "/contention?set=10",
              members: [
                {
                  applicationId: "SF1",
                  appliedForString: "cloud",
                  applicantLegalName: "Salesforce, Inc.",
                  isFocalApplicant: true,
                  exploreHref: "/explore?q=SF1",
                  profileHref: "/applicant?name=Salesforce%2C%20Inc.",
                },
                {
                  applicationId: "B1",
                  appliedForString: "cloud",
                  applicantLegalName: "Beta Names Inc",
                  isFocalApplicant: false,
                  exploreHref: "/explore?q=B1",
                  profileHref: "/applicant?name=Beta%20Names%20Inc",
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("applicant-contention-section")).toHaveTextContent(/What is a contention set/i);
    expect(screen.getByTestId("profile-contention-set-10")).toHaveTextContent(
      /4 Applications · 3 distinct Applicants/i,
    );
    expect(screen.getByTestId("profile-contention-members-10")).toHaveTextContent("Beta Names Inc");
  });
});
