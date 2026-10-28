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
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  HISTORICAL_2012_CONFIRMED_PORTFOLIO_DRAWER_CLASSIFICATION,
  HISTORICAL_2012_CONFIRMED_PORTFOLIO_MEMBER_APPLICATION_PROVENANCE_NOTE,
  HISTORICAL_2012_CONFIRMED_PORTFOLIO_RESULTS_SUMMARY,
} from "@/historical-2012/confirmed-portfolios-constants";
import { isRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-document";
import { resolveConfirmedPortfoliosSidecar } from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const historical2012Payload = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);
if (historical2012Payload.status !== "loaded") {
  throw new Error(historical2012Payload.errorMessage);
}
const historical2012 = historical2012Payload;

const sidecarJson = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-confirmed-organizations.payload.json"), "utf8"),
);
if (!isRegistry2012ConfirmedPortfoliosDocument(sidecarJson)) {
  throw new Error("fixture sidecar invalid");
}
const confirmedPortfolios = resolveConfirmedPortfoliosSidecar(sidecarJson, historical2012Payload.document);
if (confirmedPortfolios.status !== "loaded") {
  throw new Error(confirmedPortfolios.errorMessage);
}

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderConfirmedPortfoliosExplore(search = "") {
  const exploreParams: Record<string, string> = {
    dataset: "2012-historical",
    entity: "confirmed-portfolios",
  };
  if (search) exploreParams.q = search;
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider applicationPayload={historical2012} confirmedPortfolios={confirmedPortfolios}>
          <CommandCenter view="explore" exploreParams={exploreParams} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Explore 2012 confirmed portfolios — intelligence drawer provenance (D2.4B)", () => {
  it("lists pinned steward-confirmed portfolio slice only", () => {
    renderConfirmedPortfoliosExplore();
    expect(screen.getByText(HISTORICAL_2012_CONFIRMED_PORTFOLIO_RESULTS_SUMMARY)).toBeInTheDocument();
  });

  it("shows portfolio provenance from promotion registry and member-application CSV provenance separately for Afilias", async () => {
    const user = userEvent.setup();
    renderConfirmedPortfoliosExplore("afilias");

    await user.click(
      screen.getAllByRole("button", { name: /View intelligence for Afilias/i }).find((button) => button.textContent === "Investigate")!,
    );

    expect(await screen.findByText(/INTELLIGENCE DRAWER · CONFIRMED PORTFOLIO/)).toBeInTheDocument();
    const drawer = screen.getByRole("dialog");

    expect(within(drawer).getByText("PORTFOLIO PROVENANCE")).toBeInTheDocument();
    expect(within(drawer).getByText("organization-promotion-registry/1.0.0")).toBeInTheDocument();
    expect(within(drawer).getByText("organization-promotion/1.0.0")).toBeInTheDocument();
    expect(within(drawer).getByText("registry-browser-2012-confirmed-portfolios/1.0.0")).toBeInTheDocument();
    expect(within(drawer).getByText("org-prom-2012-afilias")).toBeInTheDocument();
    expect(within(drawer).getByText("afilias")).toBeInTheDocument();
    expect(within(drawer).getByText(HISTORICAL_2012_CONFIRMED_PORTFOLIO_DRAWER_CLASSIFICATION)).toBeInTheDocument();
    expect(within(drawer).queryByText("2012 Reveal Day historical record")).not.toBeInTheDocument();

    expect(within(drawer).getByText("MEMBER APPLICATION SOURCE & METHOD")).toBeInTheDocument();
    expect(within(drawer).getByText(HISTORICAL_2012_CONFIRMED_PORTFOLIO_MEMBER_APPLICATION_PROVENANCE_NOTE)).toBeInTheDocument();
    expect(within(drawer).queryByText(/^SOURCE & METHOD$/)).not.toBeInTheDocument();

    expect(within(drawer).getByText("1-1013-47551")).toBeInTheDocument();
    expect(within(drawer).getByText(/SUPPORTING RECORDS · 31/)).toBeInTheDocument();

    const viewApplications = within(drawer).getByRole("link", { name: /View applications/i });
    const href = viewApplications.getAttribute("href") ?? "";
    expect(href).toContain("entity=applications");
    expect(href).toContain("ids=");
    const afiliasPortfolio = sidecarJson.portfolios.find((row: { organizationKey: string }) => row.organizationKey === "afilias");
    expect(afiliasPortfolio).toBeDefined();
    expect(afiliasPortfolio!.memberApplicationIds).toHaveLength(31);
    for (const appId of afiliasPortfolio!.memberApplicationIds.slice(0, 3)) {
      expect(href).toContain(appId);
    }

    expect(within(drawer).queryByRole("button", { name: "+ Compare" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Watch" })).not.toBeInTheDocument();
  });

  it("does not imply CSV established organization identity in drawer copy", async () => {
    const user = userEvent.setup();
    renderConfirmedPortfoliosExplore("amazon");
    await user.click(
      screen.getAllByRole("button", { name: /View intelligence for Amazon/i }).find((button) => button.textContent === "Investigate")!,
    );
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/Does not establish steward-confirmed portfolio identity/i)).toBeInTheDocument();
    expect(within(drawer).queryByText(/CSV established/i)).not.toBeInTheDocument();
  });
});

describe("confirmed portfolio counts (regression)", () => {
  it("matches pinned 16 / 466 totals", () => {
    expect(CONFIRMED_2012_PORTFOLIO_COUNT).toBe(17);
    expect(CONFIRMED_2012_MAPPED_APPLICATION_COUNT).toBe(467);
    expect(confirmedPortfolios.document.portfolios).toHaveLength(17);
  });
});
