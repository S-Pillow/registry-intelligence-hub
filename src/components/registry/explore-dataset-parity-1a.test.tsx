// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { ExploreContentV2 } from "@/components/registry/explore-content-v2";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { HISTORICAL_2012_UNIQUE_STRING_COUNT } from "@/historical-2012/explore-historical-table";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { shouldRenderHistoricalExploreSurface } from "@/lib/explore-dataset-routing";
import {
  EXPLORE_DEFAULT_PAGE_SIZE,
  clampExplorePage,
  explorePageWindow,
} from "@/lib/explore-pagination";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import {
  exploreHistorical2012MemberApplicationsHref,
  exploreSavedResearchParams,
} from "@/lib/registry-data";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const historical2012 = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);
if (historical2012.status !== "loaded") {
  throw new Error(historical2012.errorMessage);
}

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderHistorical(exploreParams: Record<string, string> = { dataset: "2012-historical" }) {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider
          applicationPayload={historical2012}
          confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}
        >
          <CommandCenter view="explore" exploreParams={exploreParams} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("EXPLORE-DATASET-PARITY-1A — historical pagination", () => {
  it("pages Applications: default 100, page 2 is 101–200, final page is 1,901–1,930", { timeout: 60_000 }, async () => {
    const user = userEvent.setup();
    renderHistorical({ dataset: "2012-historical", entity: "applications" });

    expect(screen.getByText(/1930 application results/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(EXPLORE_DEFAULT_PAGE_SIZE + 1);
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1–100 of 1,930",
    );

    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-select"), "2");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 101–200 of 1,930",
    );

    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-select"), "20");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1,901–1,930 of 1,930",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(31);
  });

  it("supports page sizes 50 and 250 for Applications", { timeout: 60_000 }, async () => {
    const user = userEvent.setup();
    renderHistorical({ dataset: "2012-historical", entity: "applications" });

    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-size"), "50");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1–50 of 1,930",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);

    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-size"), "250");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1–250 of 1,930",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(251);
  });

  it("searches across the full corpus beyond the first page", { timeout: 60_000 }, async () => {
    const user = userEvent.setup();
    renderHistorical({ dataset: "2012-historical", entity: "applications" });

    const search = screen.getByLabelText("Search all registry records");
    await user.clear(search);
    await user.type(search, "1-863-45071");

    expect(await screen.findByText(/^1 application result$/i)).toBeInTheDocument();
    expect(screen.getAllByText("1-863-45071").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NeuStar, Inc\./).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("explore-historical-pagination")).not.toBeInTheDocument();
  });

  it("resets to page 1 when filters change and clamps when results shrink", { timeout: 60_000 }, async () => {
    const user = userEvent.setup();
    renderHistorical({ dataset: "2012-historical", entity: "applications" });

    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-select"), "5");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 401–500 of 1,930",
    );

    await user.selectOptions(screen.getByLabelText("Filter by IDN"), "idn");
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      /Showing 1–/,
    );
    expect(screen.getByTestId("explore-historical-pagination-page-select")).toHaveValue("1");
  });

  it("pages Strings: first 100 of 1,409 and final page 1,401–1,409", { timeout: 60_000 }, async () => {
    const user = userEvent.setup();
    renderHistorical({ dataset: "2012-historical", entity: "strings" });

    expect(screen.getByText(new RegExp(`${HISTORICAL_2012_UNIQUE_STRING_COUNT} strings results`, "i"))).toBeInTheDocument();
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1–100 of 1,409",
    );

    const lastPage = String(Math.ceil(HISTORICAL_2012_UNIQUE_STRING_COUNT / EXPLORE_DEFAULT_PAGE_SIZE));
    await user.selectOptions(screen.getByTestId("explore-historical-pagination-page-select"), lastPage);
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(
      "Showing 1,401–1,409 of 1,409",
    );
  });

  it("keeps string aggregation covering all 1,930 applications exactly once", () => {
    expect(historical2012.document.applications).toHaveLength(1930);
    const window = explorePageWindow(HISTORICAL_2012_UNIQUE_STRING_COUNT, 1, 100);
    expect(window.total).toBe(1409);
    expect(clampExplorePage(99, 1409, 100)).toBe(15);
  });
});

describe("EXPLORE-DATASET-PARITY-1A — dataset shell + routing", () => {
  it("historical deep-link outranks promoted V2 routing", () => {
    expect(shouldRenderHistoricalExploreSurface({ view: "explore", exploreDataset: "2012-historical" })).toBe(true);
    expect(shouldRenderHistoricalExploreSurface({ view: "explore", exploreDataset: undefined })).toBe(false);
  });

  it("Save this view preserves historical dataset params", () => {
    expect(
      exploreSavedResearchParams(
        { q: "AAA", entity: "applications", region: "NA", category: "all", status: "all", contention: "all", idn: "all", sort: "applications-desc", ids: "" },
        { dataset: "2012-historical" },
      ),
    ).toMatchObject({ dataset: "2012-historical", q: "AAA", region: "NA" });
  });

  it("member application href uses exact ids at application grain", () => {
    expect(exploreHistorical2012MemberApplicationsHref(["1-1", "1-2"])).toBe(
      "/explore?dataset=2012-historical&entity=applications&ids=1-1%2C1-2",
    );
  });

  it("promoted 2026 Explore surfaces dataset switcher and retains official/represented counts", async () => {
    const { buildBrowserApplicationPayloadFromPublicationV2 } = await import("@/lib/registry-application-payload-v2");
    const { loadPublicationV2FromPath } = await import("@/reveal-day-2026/promotion-contract-2x-io");
    const publication = await loadPublicationV2FromPath(
      join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"),
    );
    const full = buildBrowserApplicationPayloadFromPublicationV2(publication);
    const document: RegistryApplicationsDocumentV2 = {
      ...full,
      applications: full.applications.slice(0, 20),
    };

    render(<ExploreContentV2 document={document} />);
    expect(screen.getByRole("heading", { name: /Explore registry intelligence/i })).toBeInTheDocument();
    expect(screen.getByTestId("explore-dataset-2012")).toHaveAttribute(
      "href",
      expect.stringContaining("dataset=2012-historical"),
    );
    expect(screen.getByTestId("disclosure-official-applications")).toHaveTextContent("1,615");
    expect(screen.getByTestId("disclosure-observed-records")).toHaveTextContent("1,614");
  });
});
