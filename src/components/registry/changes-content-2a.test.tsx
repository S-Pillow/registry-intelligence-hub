// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesContent, CommandCenterRecentChangesCard } from "@/components/registry/changes-content";
import { enrichPresentationFeed } from "@/change-intel/enrich-presentation-feed";
import { makeRepresentativeFeed } from "@/change-intel/fixtures";
import { assertNoForbiddenChangeIntelPhrases } from "@/change-intel/impact-display";
import { CommandCenter } from "@/components/registry/command-center";
import type { OrganizationLookupRow } from "@/change-intel/derive-change-context";

afterEach(() => cleanup());

function enrichedFeed(opts?: {
  lookup?: OrganizationLookupRow[];
}) {
  const { feed, baseline, current } = makeRepresentativeFeed();
  return enrichPresentationFeed({
    feed,
    organizationSnapshot: null,
    observationsById: new Map([
      [baseline.observationId, baseline],
      [current.observationId, current],
    ]),
    organizationLookupOverride: {
      hash: "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
      generatedAt: "2026-10-20T00:00:00.000Z",
      byApplicant: new Map(
        (opts?.lookup ?? []).map((r) => [r.applicantLegalName, r]),
      ),
    },
  });
}

describe("CHANGE-INTEL-2A Changes UI", () => {
  it("renders Confirmed Organization card with materiality and full reasons", () => {
    const feed = enrichedFeed({
      lookup: [
        {
          applicantLegalName: "Registry Services, LLC",
          resolutionState: "CONFIRMED",
          organizationId: "org-gd",
          organizationKey: "registry-services-llc",
          organizationName: "Registry Services",
        },
        {
          applicantLegalName: "Large NoRsp Applicant Corp",
          resolutionState: "UNRESOLVED",
          organizationId: null,
          organizationKey: null,
          organizationName: null,
        },
      ],
    });
    render(<ChangesContent feed={feed} fixtureMode />);

    const godaddy = screen.getAllByTestId(/change-entry-/).find(
      (el) => el.getAttribute("data-impact") === "GODADDY_DIRECT",
    );
    expect(godaddy).toBeTruthy();
    expect(within(godaddy!).getByTestId("change-materiality-chip")).toHaveTextContent(/Material|Contextual/);
    expect(within(godaddy!).getByTestId("change-organization-profile-link")).toHaveTextContent(
      "Registry Services",
    );
    expect(within(godaddy!).getByTestId("change-applicant-profile-link")).toHaveTextContent(
      "Registry Services, LLC",
    );
    expect(within(godaddy!).getByTestId("change-impact-reasons").querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("renders unresolved Applicant without Confirmed Organization claim", () => {
    const feed = enrichedFeed({
      lookup: [
        {
          applicantLegalName: "Large NoRsp Applicant Corp",
          resolutionState: "UNRESOLVED",
          organizationId: null,
          organizationKey: null,
          organizationName: null,
        },
      ],
    });
    render(<ChangesContent feed={feed} fixtureMode />);
    const unresolved = screen.getAllByTestId("change-organization-unresolved");
    expect(unresolved.length).toBeGreaterThan(0);
    expect(screen.queryByText("Should Not Show")).not.toBeInTheDocument();
  });

  it("MATERIAL and CONTEXTUAL chips and filter work", async () => {
    const user = userEvent.setup();
    const feed = enrichedFeed();
    render(<ChangesContent feed={feed} fixtureMode />);
    expect(screen.getAllByTestId("change-materiality-chip").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByTestId("changes-filter-materiality"), "CONTEXTUAL");
    const entries = screen.getAllByTestId(/change-entry-/);
    expect(entries.every((el) => el.getAttribute("data-materiality") === "CONTEXTUAL")).toBe(true);
  });

  it("contention-linked Application field change exposes set links from target observation", () => {
    const feed = enrichedFeed();
    render(<ChangesContent feed={feed} fixtureMode />);
    // BETA membership added → contention link present
    const links = screen.getAllByTestId("change-contention-set-link");
    expect(links.length).toBeGreaterThan(0);
  });

  it("RSP-unmatched posture uses safe wording; forbidden phrases absent", () => {
    const feed = enrichedFeed();
    const { container } = render(<ChangesContent feed={feed} fixtureMode />);
    expect(screen.getAllByText(/Public Main-RSP unmatched/i).length).toBeGreaterThan(0);
    const text = container.textContent ?? "";
    expect(assertNoForbiddenChangeIntelPhrases(text)).toEqual([]);
  });

  it("zero state unchanged", () => {
    const { zeroChangeFeed, baseline, current } = makeRepresentativeFeed();
    const feed = enrichPresentationFeed({
      feed: zeroChangeFeed,
      organizationSnapshot: null,
      observationsById: new Map([
        [baseline.observationId, baseline],
        [current.observationId, current],
      ]),
      organizationLookupOverride: {
        hash: "z".repeat(64),
        generatedAt: null,
        byApplicant: new Map(),
      },
    });
    render(<ChangesContent feed={feed} />);
    expect(screen.getByTestId("changes-zero-state")).toBeInTheDocument();
  });

  it("Command Center regression: safe label + link to /changes", () => {
    const feed = enrichedFeed();
    render(<CommandCenterRecentChangesCard feed={feed} />);
    expect(screen.getByTestId("cc-view-changes-cta")).toHaveAttribute("href", "/changes");
    const top = screen.getByTestId("cc-recent-changes-top").textContent ?? "";
    expect(assertNoForbiddenChangeIntelPhrases(top)).toEqual([]);
    expect(top).not.toMatch(/RSP research/i);
  });

  it("primary nav still includes Changes", () => {
    render(<CommandCenter presentation="rehearsal" changeFeed={{ initialized: false }} />);
    const nav = screen.getByTestId("hub-primary-nav");
    expect(within(nav).getByRole("link", { name: "Changes" })).toBeInTheDocument();
  });
});
