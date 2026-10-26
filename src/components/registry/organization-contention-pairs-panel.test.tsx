// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  OrganizationContentionPairsLandscapeTeaser,
  OrganizationContentionPairsPanel,
  OrganizationContentionPairsProfileContext,
} from "@/components/registry/organization-contention-pairs-panel";
import type { OrganizationContentionPairModel } from "@/lib/organization-contention-pairs";

afterEach(() => cleanup());

const FORBIDDEN =
  /rival|threat|auction severity|win probability|sales opportunity|market share|dominance|market power|competitive adjacency|selected RSP|available customer/i;

function fixture(): OrganizationContentionPairModel {
  const pair = {
    pairKey: "organization:a::organization:b",
    organizationAId: "organization:a",
    organizationAKey: "org-a",
    organizationAName: "Org A",
    organizationBId: "organization:b",
    organizationBKey: "org-b",
    organizationBName: "Org B",
    sharedSetCount: 5,
    membershipInteractions: 7,
    largestOfficialSharedSetSize: 11,
    sharedSetIds: ["1", "2", "3", "4", "5"],
  };
  const summary = {
    organizationId: "organization:a",
    organizationKey: "org-a",
    organizationName: "Org A",
    distinctConfirmedCounterpartCount: 1,
    sharedSetCountWithAnyConfirmedCounterpart: 5,
    recurringCounterpartCount: 1,
    counterparts: [
      {
        organizationId: "organization:b",
        organizationKey: "org-b",
        organizationName: "Org B",
        sharedSetCount: 5,
        membershipInteractions: 7,
        largestOfficialSharedSetSize: 11,
        sharedSetIds: ["1", "2", "3", "4", "5"],
      },
    ],
    isGodaddyOrganization: false,
  };
  return {
    coverage: {
      officialContentionSets: 263,
      officialContentionMemberships: 891,
      confirmedContentionMemberships: 724,
      unresolvedContentionMemberships: 149,
      candidateAmbiguousContentionMemberships: 18,
      setsWithConfirmedOrganizationMembership: 256,
      pairableOfficialSets: 208,
      pairableConfirmedMemberships: 676,
      confirmedOrganizations: 104,
      confirmedOrganizationsWithPair: 27,
      confirmedOrganizationsWithoutPair: 77,
      uniqueConfirmedOrganizationPairs: 165,
      recurringConfirmedOrganizationPairs: 112,
      organizationSnapshotHash: "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
    },
    pairs: [pair],
    topPairs: [pair],
    organizationSummaries: [summary],
    widestCounterpartBreadth: [summary],
    godaddy: null,
    disclosure: {
      confirmedOnlySentence:
        "Confirmed-Organization pairings describe co-membership among steward-Confirmed Organizations only.",
      membershipCoverageSentence:
        "724 of 891 official contention memberships are attributable to Confirmed Organizations.",
      pairableSetsSentence:
        "208 of 263 official contention sets contain at least two distinct Confirmed Organizations and are pairable at Organization grain.",
      nonConfirmedSentence:
        "149 memberships are UNRESOLVED. 18 memberships belong to Candidate/Ambiguous mappings and are excluded from Confirmed pair intelligence.",
    },
  };
}

describe("OrganizationContentionPairsPanel", () => {
  it("renders coverage and top pairs without forbidden language", () => {
    render(<OrganizationContentionPairsPanel model={fixture()} />);
    expect(screen.getByTestId("org-contention-pairs")).toBeInTheDocument();
    expect(screen.getByTestId("org-contention-pairs-coverage")).toHaveTextContent(/co-membership/i);
    expect(screen.getByTestId("org-contention-pairs-table")).toHaveTextContent("Org A");
    expect(screen.getByTestId("org-contention-pairs").textContent).not.toMatch(FORBIDDEN);
  });
});

describe("OrganizationContentionPairsLandscapeTeaser", () => {
  it("links to contention without forbidden claims", () => {
    render(<OrganizationContentionPairsLandscapeTeaser model={fixture()} />);
    expect(screen.getByTestId("org-contention-pairs-landscape")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Contention/i })).toHaveAttribute(
      "href",
      "/contention",
    );
    expect(screen.getByTestId("org-contention-pairs-landscape").textContent).not.toMatch(FORBIDDEN);
  });
});

describe("OrganizationContentionPairsProfileContext", () => {
  it("shows zero state honestly", () => {
    render(
      <OrganizationContentionPairsProfileContext
        summary={{
          organizationId: "organization:z",
          organizationKey: "org-z",
          organizationName: "Org Z",
          distinctConfirmedCounterpartCount: 0,
          sharedSetCountWithAnyConfirmedCounterpart: 0,
          recurringCounterpartCount: 0,
          counterparts: [],
          isGodaddyOrganization: false,
        }}
      />,
    );
    expect(screen.getByTestId("org-contention-pairs-profile-zero")).toHaveTextContent(
      /No Confirmed Organization counterpart/i,
    );
    expect(screen.getByTestId("org-contention-pairs-profile").textContent).not.toMatch(
      /no competitors|no contention|no commercial overlap/i,
    );
  });
});
