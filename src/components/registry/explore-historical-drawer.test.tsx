// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { exploreFullHrefForInvestigation } from "@/lib/registry-data";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const historical2012 = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderExploreHistorical(
  exploreParams: Record<string, string> = {
    dataset: "2012-historical",
    entity: "applications",
    ids: "1-1386-27446",
  },
) {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider resolution={historical2012}>
          <CommandCenter view="explore" exploreParams={exploreParams} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Explore 2012 historical — intelligence drawer context (D1)", () => {
  it("shows 2012 provenance and disables Compare, Watch, and Brief for .AAA", async () => {
    const user = userEvent.setup();
    renderExploreHistorical();

    expect(screen.getByText(/1 applications result/i)).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "View intelligence for .AAA" }).find((button) => button.textContent === "Investigate")!,
    );

    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICATION/)).toBeInTheDocument();
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("2012 Reveal Day (historical)")).toBeInTheDocument();
    expect(within(drawer).getByText("historical-2012-browser/1.0.0")).toBeInTheDocument();
    expect(within(drawer).getByText("snap-2012-reveal-day-browser-v1")).toBeInTheDocument();
    expect(within(drawer).getByText(/American Automobile Association, Inc\./)).toBeInTheDocument();
    expect(within(drawer).getByText("1-1386-27446")).toBeInTheDocument();

    expect(within(drawer).queryByText(/snap-rehearsal-2026/)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/round-pulse\/1\.0\.0/)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/Rehearsal data only/i)).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "+ Compare" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Watch" })).toBeDisabled();
    expect(screen.getByText(/Historical briefings not yet available/i)).toBeInTheDocument();

    const viewFull = within(drawer).getByRole("link", { name: /View full/i });
    expect(viewFull.getAttribute("href")).toContain("dataset=2012-historical");
  });

  it("preserves dataset=2012-historical in View full href helper", () => {
    expect(
      exploreFullHrefForInvestigation({
        entityType: "applications",
        entityKey: "1-1386-27446",
        records: [],
        exploreDataset: "2012-historical",
      }),
    ).toBe("/explore?entity=applications&ids=1-1386-27446&dataset=2012-historical");
  });

  it("keeps 2026 rehearsal Explore drawer rehearsal provenance unchanged", async () => {
    const user = userEvent.setup();
    render(
      <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
        <HubRegistryDataProvider resolution={registryResolution}>
          <HubHistorical2012Provider resolution={historical2012}>
            <CommandCenter view="explore" exploreParams={{ q: "secure" }} />
          </HubHistorical2012Provider>
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "View intelligence for .secure" }).find((button) => button.textContent === "Investigate")!,
    );
    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICATION/)).toBeInTheDocument();
    expect(screen.getByText("round-pulse/1.0.0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Compare" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Brief this" })).toBeInTheDocument();
  });
});
