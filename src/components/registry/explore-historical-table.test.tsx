// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS } from "@/historical-2012/explore-historical-table";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const historical2012 = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderHistoricalExplore(exploreParams: Record<string, string>) {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider applicationPayload={historical2012} confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}>
          <CommandCenter view="explore" exploreParams={exploreParams} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Explore 2012 historical — application table columns (D1)", () => {
  it("omits Category and Participation filters for the 2012 corpus", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      ids: "1-1386-27446",
    });

    expect(screen.queryByLabelText("Filter by participation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by category")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "New + returning" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Unclassified — not a market sector" })).not.toBeInTheDocument();
  });

  it("does not apply returning-only URL status against 2012 rows", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      status: "returning",
      ids: "1-1386-27446",
    });

    expect(screen.getByText(/^1 application result$/i)).toBeInTheDocument();
  });

  it("renders per-application columns without Applications or Participation headers", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      ids: "1-1386-27446",
    });

    const table = screen.getByRole("table");
    HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS.forEach((header) => {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    });
    expect(within(table).queryByRole("columnheader", { name: "Applications" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Participation" })).not.toBeInTheDocument();
    expect(within(table).queryByText("2012 Reveal Day")).not.toBeInTheDocument();
  });

  it("shows payload-backed row cells for a filtered application", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      ids: "1-1386-27446",
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText(".AAA")).toBeInTheDocument();
    expect(within(table).getByText("1-1386-27446")).toBeInTheDocument();
    expect(within(table).getByText(/American Automobile Association, Inc\./)).toBeInTheDocument();
    expect(within(table).getByText("US")).toBeInTheDocument();
    expect(within(table).getByText("NA")).toBeInTheDocument();
    expect(within(table).getByText("2012 CSV")).toBeInTheDocument();
    expect(screen.getByTestId("historical-applicant-field-disclosure")).toHaveTextContent(/not resolved organization ownership/i);
    expect(within(table).queryByRole("columnheader", { name: "Organization" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Type" })).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence: 1")).not.toBeInTheDocument();
    expect(screen.queryByText("New only")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by category")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Brief this view" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save this view" })).toBeInTheDocument();
  });

  it("keeps one row per application when the same applied string repeats (.APP)", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      ids: "1-1013-7451,1-1138-33325",
    });

    expect(screen.getByText(/^2 application results$/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText(".APP")).toHaveLength(2);
    expect(within(table).getByText("1-1013-7451")).toBeInTheDocument();
    expect(within(table).getByText("1-1138-33325")).toBeInTheDocument();
  });

  it("shows an IDN A-label without a derived geographic count or confidence score", () => {
    renderHistoricalExplore({
      dataset: "2012-historical",
      entity: "applications",
      ids: "1-1011-2710",
    });

    expect(screen.getAllByText("A-label xn--estv75g").length).toBeGreaterThan(0);
    expect(screen.queryByText("Geographic")).not.toBeInTheDocument();
    expect(screen.queryByText("55")).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence: 1")).not.toBeInTheDocument();
  });
});
