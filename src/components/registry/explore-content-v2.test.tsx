// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");

afterEach(() => cleanup());

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
    expect(screen.getByTestId("disclosure-official-applications")).toHaveTextContent("1615");
    expect(screen.getByTestId("disclosure-observed-records")).toHaveTextContent("1614");
    expect(screen.getByTestId("explore-v2-gated-facets")).toHaveTextContent("organization");
    expect(screen.getByTestId("explore-v2-gated-facets")).toHaveTextContent("confidence");
    expect(screen.getByTestId("explore-v2-result-count")).toHaveTextContent("RIH observed records");
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
