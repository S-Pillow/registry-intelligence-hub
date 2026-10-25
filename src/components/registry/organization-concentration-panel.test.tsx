// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  OrganizationConcentrationContentionPanel,
  OrganizationConcentrationLandscapePanel,
  OrganizationConcentrationProfileContext,
} from "@/components/registry/organization-concentration-panel";
import type { OrganizationConcentrationModel } from "@/lib/organization-concentration";
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";

afterEach(() => cleanup());

const FORBIDDEN =
  /market share|dominance|market power|win probability|auction probability|sales opportunity|selected RSP|available customer/i;

function fixtureModel(): OrganizationConcentrationModel {
  const godaddyRow = {
    organizationId: "organization:resolved-2026:godaddy-registry-services",
    organizationKey: "godaddy-registry-services",
    organizationName: "GoDaddy Registry Services, LLC",
    confirmedApplicantCount: 1,
    applicationCount: 77,
    applicationShareOfConfirmedSubset: 77 / 1129,
    applicationShareOfRepresentedRound: 77 / 1614,
    brandApplicationCount: 0,
    contentionMembershipCount: 66,
    contentionMembershipShareOfConfirmedSubset: 66 / 724,
    contentionMembershipShareOfOfficialTotal: 66 / 891,
    distinctContentionSetsTouched: 40,
    officialSetTouchShare: 40 / 263,
    rankByApplications: 1,
    rankByContentionMemberships: 1,
    isGodaddyOrganization: true,
  };
  const other = {
    ...godaddyRow,
    organizationId: "organization:resolved-2026:alibaba-group",
    organizationKey: "alibaba-group",
    organizationName: "Alibaba Group",
    confirmedApplicantCount: 3,
    applicationCount: 7,
    applicationShareOfConfirmedSubset: 7 / 1129,
    applicationShareOfRepresentedRound: 7 / 1614,
    brandApplicationCount: 0,
    contentionMembershipCount: 4,
    contentionMembershipShareOfConfirmedSubset: 4 / 724,
    contentionMembershipShareOfOfficialTotal: 4 / 891,
    distinctContentionSetsTouched: 4,
    officialSetTouchShare: 4 / 263,
    rankByApplications: 2,
    rankByContentionMemberships: 2,
    isGodaddyOrganization: false,
  };
  return {
    coverage: {
      officialApplications: 1615,
      officialApplicants: 481,
      representedApplications: 1614,
      representedApplicantLegalNames: 480,
      officialContentionSets: 263,
      officialContentionMemberships: 891,
      confirmedOrganizations: 104,
      confirmedApplicantMappings: 161,
      confirmedApplications: 1129,
      unresolvedApplications: 445,
      confirmedBrandApplications: 160,
      unresolvedBrandApplications: 171,
      confirmedContentionMemberships: 724,
      unresolvedContentionMemberships: 149,
      setsWithConfirmedOrganizationMembership: 256,
      organizationSnapshotHash: "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
    },
    organizations: [godaddyRow, other],
    applicationConcentration: [godaddyRow, other],
    contentionConcentration: [godaddyRow, other],
    crowdedSets: [
      {
        contentionSetId: "12",
        officialMembershipCount: 18,
        confirmedMembershipCount: 10,
        unresolvedMembershipCount: 8,
        distinctConfirmedOrganizations: 4,
        distinctConfirmedApplicants: 6,
        godaddyPresent: true,
        godaddyMembershipCount: 1,
        confirmedOrganizationCoveragePercent: 10 / 18,
        confirmedStructure: "PARTIAL_RESOLUTION",
        confirmedOrganizationsRepresented: 4,
        displayStructureLabel: "4 confirmed Organizations represented (set not fully resolved)",
      },
    ],
    godaddyRelative: {
      godaddyApplicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      godaddyOrganizationId: godaddyRow.organizationId,
      godaddyOrganizationKey: godaddyRow.organizationKey,
      godaddyOrganizationName: godaddyRow.organizationName,
      applicationCount: 77,
      applicationRankAmongConfirmed: 1,
      applicationShareOfConfirmedSubset: 77 / 1129,
      contentionMembershipCount: 66,
      contentionMembershipRankAmongConfirmed: 1,
      contentionMembershipShareOfConfirmedSubset: 66 / 724,
      distinctOfficialContentionSetsTouched: 40,
      sharedOfficialSetsWithCounterparts: 40,
      distinctConfirmedCounterpartOrganizations: 1,
      totalConfirmedCounterpartMembershipsInSharedSets: 3,
      counterparts: [
        {
          organizationId: other.organizationId,
          organizationKey: other.organizationKey,
          organizationName: other.organizationName,
          sharedSetCountWithGoDaddy: 2,
          counterpartMembershipsWithinSharedSets: 3,
          distinctCounterpartApplicantNamesWithinSharedSets: 2,
          largestSharedSetMembershipCount: 2,
        },
      ],
    },
    topShares: {
      top5ApplicationShareOfConfirmedSubset: 0.4,
      top10ApplicationShareOfConfirmedSubset: 0.55,
      top5ContentionMembershipShareOfConfirmedSubset: 0.35,
    },
    disclosure: {
      applicationCoverageSentence:
        "Organization metrics cover 1,129 of 1,614 represented Applications with Confirmed identity resolution. Rankings describe that confirmed subset, not the complete 2026 round.",
      contentionCoverageSentence:
        "724 of 891 official contention memberships are attributable to Confirmed Organizations.",
      subsetDisclaimer:
        "Confirmed subset ≠ complete round. Unresolved Applicants remain source Applicants and are not grouped into Organizations.",
    },
  };
}

describe("OrganizationConcentrationLandscapePanel", () => {
  it("renders coverage, GoDaddy ranks, and portfolio tables with subset honesty", () => {
    const model = fixtureModel();
    render(<OrganizationConcentrationLandscapePanel model={model} />);
    expect(screen.getByTestId("org-concentration-landscape")).toBeInTheDocument();
    expect(screen.getByTestId("org-concentration-coverage")).toHaveTextContent(/confirmed subset/i);
    expect(screen.getByTestId("org-concentration-godaddy")).toHaveTextContent(/rank #1/i);
    expect(screen.getByTestId("org-concentration-app-row-godaddy")).toHaveTextContent("77");
    expect(screen.getByTestId("org-concentration-cont-row-godaddy")).toHaveTextContent("66");
    const godaddyLinks = screen.getAllByRole("link", { name: "GoDaddy Registry Services, LLC" });
    expect(godaddyLinks.length).toBeGreaterThan(0);
    expect(godaddyLinks[0]).toHaveAttribute(
      "href",
      "/organization?key=godaddy-registry-services",
    );
    expect(screen.getByTestId("org-concentration-landscape").textContent).not.toMatch(FORBIDDEN);
  });
});

describe("OrganizationConcentrationContentionPanel", () => {
  it("renders crowded sets and GoDaddy counterparts without self-org", () => {
    const model = fixtureModel();
    render(<OrganizationConcentrationContentionPanel model={model} />);
    expect(screen.getByTestId("org-concentration-contention")).toBeInTheDocument();
    expect(screen.getByTestId("org-concentration-crowded-sets")).toHaveTextContent(/not fully resolved/i);
    expect(screen.getByTestId("org-concentration-godaddy-counterparts")).toHaveTextContent("Alibaba Group");
    expect(screen.getByTestId("org-concentration-godaddy-counterparts").textContent).not.toMatch(
      /GoDaddy Registry Services, LLC/,
    );
    expect(screen.getByTestId("org-concentration-contention").textContent).not.toMatch(FORBIDDEN);
  });
});

describe("OrganizationConcentrationProfileContext", () => {
  it("shows rank context for a confirmed Organization key", () => {
    const model = fixtureModel();
    render(
      <OrganizationConcentrationProfileContext
        model={model}
        organizationKey="godaddy-registry-services"
      />,
    );
    expect(screen.getByTestId("org-concentration-profile-context")).toHaveTextContent(/rank #1/i);
    expect(screen.getByTestId("org-concentration-profile-context").textContent).not.toMatch(FORBIDDEN);
  });
});
