// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { loadPublicationV2FromPath } from "@/reveal-day-2026/promotion-contract-2x-io";
import { evaluateApplicationPublicationV2ActualityPromotion } from "@/reveal-day-2026/activation-2x";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { evaluateHumanApprovals } from "@/reveal-day-2026/human-approval";
import { join } from "node:path";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");

afterEach(() => cleanup());

async function renderActiveV2(view: "command" | "explore" | "compare" | "saved" | "briefings" | "competitive-landscape" | "data-health") {
  const publication = await loadPublicationV2FromPath(REVEAL_APP);
  const payload = buildBrowserApplicationPayloadFromPublicationV2(publication);
  const claim = evaluateApplicationPublicationV2ActualityPromotion(
    publication,
    DEFAULT_CLAIM_ACTUALITY_STATE,
    evaluateHumanApprovals({ stewardApprovalId: "s", productApprovalId: "p" }),
  ).nextState;
  const resolution = resolveActiveRegistryApplicationsDocument(claim, payload);
  const uiResolution = {
    ...resolution,
    documentV2: {
      ...resolution.documentV2!,
      applications: resolution.documentV2!.applications.slice(0, 5),
    },
  };

  return render(
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
          <CommandCenter view={view} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("PRODUCT-UX-1 business surface cleanup", () => {
  it("primary nav is Command Center / Explore / Competitive Landscape / Registry Market / Contention / Changes with Data & methodology", async () => {
    await renderActiveV2("command");
    const nav = screen.getByTestId("hub-primary-nav");
    expect(within(nav).getByRole("link", { name: "Command Center" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Explore" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Competitive Landscape" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Registry Market" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Contention" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Changes" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Compare" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Briefings" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Data Health" })).not.toBeInTheDocument();
    expect(within(nav).getByTestId("data-methodology-link")).toHaveAttribute("href", "/data-health");
  });

  it("Compare/Saved/Briefings routes stay valid without implementation jargon", async () => {
    await renderActiveV2("compare");
    const compare = screen.getByTestId("compare-intel-v2-entry");
    expect(compare).toHaveTextContent(/Compare Applicants and Organizations/i);
    expect(compare).not.toHaveTextContent(/1\.1-shaped/i);
    expect(compare).not.toHaveTextContent(/do not fabricate/i);
    expect(compare).not.toHaveTextContent(/Publication 2/i);
    expect(compare).not.toHaveTextContent(/eligibility-gated/i);
    cleanup();

    await renderActiveV2("saved");
    const saved = screen.getByTestId("saved-gated-v2");
    expect(saved).toHaveTextContent(/not available for the current 2026 data view yet/i);
    expect(saved).not.toHaveTextContent(/1\.1-shaped/i);
    expect(saved).not.toHaveTextContent(/do not fabricate/i);
    cleanup();

    await renderActiveV2("briefings");
    const briefings = screen.getByTestId("briefings-gated-v2");
    expect(briefings).toHaveTextContent(/not available for the current 2026 data view yet/i);
    expect(briefings).not.toHaveTextContent(/1\.1-shaped/i);
    expect(briefings).not.toHaveTextContent(/do not fabricate/i);
  });

  it("Data Health remains directly addressable as methodology surface", async () => {
    await renderActiveV2("data-health");
    expect(screen.getByRole("heading", { name: "Data Health" })).toBeInTheDocument();
    expect(screen.getByText(/Technical data health & methodology/i)).toBeInTheDocument();
    const nav = screen.getByTestId("hub-primary-nav");
    expect(within(nav).queryByRole("link", { name: "Data Health" })).not.toBeInTheDocument();
    expect(within(nav).getByTestId("data-methodology-link")).toBeInTheDocument();
  });
});
