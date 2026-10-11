// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExploreContentV2 } from "@/components/registry/explore-content-v2";
import { SearchContentV2 } from "@/components/registry/search-content-v2";
import { CommandCenterOrientationV2 } from "@/components/registry/command-center-orientation-v2";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import { loadPublicationV2FromPath } from "@/reveal-day-2026/promotion-contract-2x-io";
import { evaluateApplicationPublicationV2ActualityPromotion } from "@/reveal-day-2026/activation-2x";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { evaluateHumanApprovals } from "@/reveal-day-2026/human-approval";
import { CommandCenter } from "@/components/registry/command-center";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const REVEAL_APP_SHA_BEFORE = createHash("sha256").update(readFileSync(REVEAL_APP)).digest("hex");

afterEach(() => cleanup());

function visibleRowIds(): string[] {
  return screen.getAllByTestId(/^explore-v2-row-/).map((el) => el.getAttribute("data-testid")!.replace("explore-v2-row-", ""));
}

describe("active 2.x Search/Explore/Command Center surfaces", () => {
  it("15-19 — Explore/Search render disclosure and local-record counts without legacy facets", async () => {
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    // Use a tiny projected document for UI speed — same contract helpers as full payload.
    const full = buildBrowserApplicationPayloadFromPublicationV2(publication);
    const document = {
      ...full,
      applications: full.applications.slice(0, 20),
      observedApplicationRecords: full.observedApplicationRecords,
    };

    render(<ExploreContentV2 document={document} />);
    expect(screen.getByTestId("coverage-disclosure-v2")).toBeInTheDocument();
    expect(screen.getByTestId("disclosure-official-applications")).toHaveTextContent("1,615");
    expect(screen.getByTestId("disclosure-observed-records")).toHaveTextContent("1,614");
    expect(screen.getByTestId("coverage-disclosure-v2")).toHaveTextContent(/administrative-check/i);
    expect(screen.getAllByRole("link", { name: "Data & methodology" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("disclosure-data-methodology-link")).toHaveAttribute("href", "/data-health");
    expect(screen.queryByTestId("explore-v2-gated-facets")).not.toBeInTheDocument();
    expect(screen.queryByText(/Publication 2/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("explore-v2-result-count")).toHaveTextContent("RIH observed records");
    expect(screen.getByTestId("explore-v2-search")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Filter by organization/i)).toBeNull();
    expect(screen.queryByLabelText(/Filter by category/i)).toBeNull();
    cleanup();

    render(<SearchContentV2 document={document} />);
    expect(screen.getByTestId("search-content-v2")).toBeInTheDocument();
    expect(screen.getByTestId("coverage-disclosure-v2")).toBeInTheDocument();
    cleanup();

    const claim = evaluateApplicationPublicationV2ActualityPromotion(
      publication,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "s", productApprovalId: "p" }),
    ).nextState;
    render(<CommandCenterOrientationV2 document={document} claimActuality={claim} />);
    expect(screen.getByTestId("cc-v2-official-apps")).toHaveTextContent("1615");
    expect(screen.getByTestId("cc-v2-coverage-observed")).toHaveTextContent("1614");
    expect(screen.queryByTestId("cc-v2-unique-blocked")).not.toBeInTheDocument();
    expect(screen.getByTestId("cc-v2-omitted-blocked-cross-round")).toHaveTextContent(
      "unique-applied-strings",
    );
  });

  it("31 — Command Center does not crash on active 2.x", async () => {
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const payload = buildBrowserApplicationPayloadFromPublicationV2(publication);
    const claim = evaluateApplicationPublicationV2ActualityPromotion(
      publication,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "s", productApprovalId: "p" }),
    ).nextState;
    const resolution = resolveActiveRegistryApplicationsDocument(claim, payload);
    expect(resolution.mode).toBe("promoted-2026-v2");
    const uiResolution = {
      ...resolution,
      documentV2: {
        ...resolution.documentV2!,
        applications: resolution.documentV2!.applications.slice(0, 5),
      },
    };

    render(
      <HubClaimActualityProvider claimActualityState={claim}>
        <HubRegistryDataProvider resolution={uiResolution}>
          <HubHistorical2012Provider
            applicationPayload={{
              status: "not-loaded",
              reason: "not-configured",
              errorMessage: "test",
            }}
            confirmedPortfolios={{
              status: "not-loaded",
              reason: "not-configured",
              errorMessage: "test",
            }}
            structuralSummary={null}
          >
            <CommandCenter view="command" />
          </HubHistorical2012Provider>
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    expect(screen.getByTestId("command-center-active-v2")).toBeInTheDocument();
    expect(screen.getByTestId("cc-v2-coverage-panel")).toBeInTheDocument();
    expect(screen.getByTestId("cc-v2-official-apps")).toHaveTextContent("1615");
  });
});

describe("Explore full-result pagination (EXPLORE-PAGING-1)", () => {
  async function loadFullDocument(): Promise<RegistryApplicationsDocumentV2> {
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    return buildBrowserApplicationPayloadFromPublicationV2(publication);
  }

  it("defaults to first 100 of 1614 with Previous disabled and official/observed distinction intact", async () => {
    const document = await loadFullDocument();
    expect(document.officialApplications).toBe(1615);
    expect(document.observedApplicationRecords).toBe(1614);
    expect(document.applications).toHaveLength(1614);

    render(<ExploreContentV2 document={document} />);
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent("Showing 1–100 of 1,614");
    expect(visibleRowIds()).toHaveLength(100);
    expect(visibleRowIds()).toEqual(document.applications.slice(0, 100).map((a) => a.applicationId));
    expect(screen.getByTestId("explore-v2-prev")).toBeDisabled();
    expect(screen.getByTestId("explore-v2-next")).not.toBeDisabled();
    expect(screen.getByTestId("disclosure-official-applications")).toHaveTextContent("1,615");
    expect(screen.getByTestId("disclosure-observed-records")).toHaveTextContent("1,614");
    expect(screen.queryByText(/Showing first 100/i)).not.toBeInTheDocument();
  });

  it("navigates to page 2 (101–200) and final page (1601–1614); Next disabled on last page", async () => {
    const user = userEvent.setup();
    const document = await loadFullDocument();
    render(<ExploreContentV2 document={document} />);

    await user.click(screen.getByTestId("explore-v2-next"));
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent("Showing 101–200 of 1,614");
    expect(visibleRowIds()).toEqual(document.applications.slice(100, 200).map((a) => a.applicationId));
    expect(screen.getByTestId("explore-v2-prev")).not.toBeDisabled();

    await user.selectOptions(screen.getByTestId("explore-v2-page-select"), "17");
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent("Showing 1,601–1,614 of 1,614");
    expect(visibleRowIds()).toEqual(document.applications.slice(1600, 1614).map((a) => a.applicationId));
    expect(visibleRowIds()).toHaveLength(14);
    expect(screen.getByTestId("explore-v2-next")).toBeDisabled();
  });

  it("searches and filters across the full dataset, not only the current page", async () => {
    const user = userEvent.setup();
    const document = await loadFullDocument();
    const target = document.applications[250];
    expect(target).toBeTruthy();

    render(<ExploreContentV2 document={document} />);
    // Still on page 1 — target is beyond first 100
    expect(visibleRowIds()).not.toContain(target.applicationId);

    await user.type(screen.getByTestId("explore-v2-search"), target.applicationId);
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent(/Showing 1–1 of 1/);
    expect(visibleRowIds()).toEqual([target.applicationId]);
    // Search reset pagination to page 1
    expect(screen.getByTestId("explore-v2-prev")).toBeDisabled();
  });

  it("applies region and IDN filters across full dataset and resets page", async () => {
    const user = userEvent.setup();
    const document = await loadFullDocument();
    render(<ExploreContentV2 document={document} />);

    await user.click(screen.getByTestId("explore-v2-next"));
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent("Showing 101–200");

    const region = document.applications[0].region;
    const regionTotal = document.applications.filter((a) => a.region === region).length;
    await user.selectOptions(screen.getByTestId("explore-v2-region"), region);
    expect(screen.getByTestId("explore-v2-result-count")).toHaveTextContent(
      `${regionTotal} matching RIH observed records`,
    );
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent(`of ${regionTotal.toLocaleString()}`);
    expect(screen.getByTestId("explore-v2-prev")).toBeDisabled();
    expect(visibleRowIds().every((id) => document.applications.find((a) => a.applicationId === id)?.region === region)).toBe(
      true,
    );

    await user.selectOptions(screen.getByTestId("explore-v2-idn"), "idn");
    const idnInRegion = document.applications.filter((a) => a.region === region && a.designations.idn).length;
    expect(screen.getByTestId("explore-v2-result-count")).toHaveTextContent(
      `${idnInRegion} matching RIH observed records`,
    );
    expect(screen.getByTestId("explore-v2-prev")).toBeDisabled();
  });

  it("hides pagination controls for zero results and clamps page when filters shrink the set", async () => {
    const user = userEvent.setup();
    const document = await loadFullDocument();
    render(<ExploreContentV2 document={document} />);

    await user.selectOptions(screen.getByTestId("explore-v2-page-select"), "10");
    expect(screen.getByTestId("explore-v2-page-status")).toHaveTextContent(/Page 10 of 17/);

    await user.type(screen.getByTestId("explore-v2-search"), "zzz-no-such-explore-match-xyz");
    expect(screen.getByTestId("explore-v2-result-count")).toHaveTextContent("0 matching RIH observed records");
    expect(screen.queryByTestId("explore-v2-pagination")).not.toBeInTheDocument();
    expect(screen.queryByTestId("explore-v2-prev")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("explore-v2-results")).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does not mutate the source publication while paging", async () => {
    const document = await loadFullDocument();
    const user = userEvent.setup();
    render(<ExploreContentV2 document={document} />);
    await user.click(screen.getByTestId("explore-v2-next"));
    await user.selectOptions(screen.getByTestId("explore-v2-page-select"), "17");
    const after = createHash("sha256").update(readFileSync(REVEAL_APP)).digest("hex");
    expect(after).toBe(REVEAL_APP_SHA_BEFORE);
  });
});
