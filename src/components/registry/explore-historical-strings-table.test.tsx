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
import {
  HISTORICAL_2012_STRING_EXPLORE_COLUMN_HEADERS,
  HISTORICAL_2012_UNIQUE_STRING_COUNT,
} from "@/historical-2012/explore-historical-table";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { exploreHistorical2012StringsHref } from "@/lib/registry-data";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const historical2012 = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderHistoricalStringsExplore(exploreParams: Record<string, string> = {}) {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider applicationPayload={historical2012} confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}>
          <CommandCenter
            view="explore"
            exploreParams={{ dataset: "2012-historical", entity: "strings", ...exploreParams }}
          />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Explore 2012 historical — Strings browse (D2.1)", () => {
  it("shows 1409 string results with dedicated columns, first page only, and no Category/Participation", { timeout: 45_000 }, () => {
    renderHistoricalStringsExplore();

    const resultsLine = screen.getByText(new RegExp(`${HISTORICAL_2012_UNIQUE_STRING_COUNT} strings results`, "i"));
    expect(resultsLine).toHaveTextContent(/1930 underlying applications/i);

    expect(screen.queryByLabelText("Filter by category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by participation")).not.toBeInTheDocument();

    const table = screen.getByRole("table");
    HISTORICAL_2012_STRING_EXPLORE_COLUMN_HEADERS.forEach((header) => {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    });
    expect(within(table).queryByRole("columnheader", { name: "Participation" })).not.toBeInTheDocument();
    expect(within(table).queryByText("2012 Reveal Day")).not.toBeInTheDocument();
    // Full-result pagination: page 1 shows 100 of 1,409 (header + 100 body rows).
    expect(within(table).getAllByRole("row")).toHaveLength(101);
    expect(screen.getByTestId("explore-historical-pagination-status")).toHaveTextContent(/Showing 1–100 of 1,409/);
  });

  it("collapses .APP to one row with application count greater than one", () => {
    renderHistoricalStringsExplore({ q: "APP" });

    const table = screen.getByRole("table");
    expect(within(table).getAllByText(".APP")).toHaveLength(1);
    expect(within(table).getByText("13")).toBeInTheDocument();
    expect(screen.getByText(/1 string result · 13 underlying applications/i)).toBeInTheDocument();
  });

  it("normalizes q=.APP to the same single-string aggregate view", () => {
    renderHistoricalStringsExplore({ q: ".APP" });

    expect(screen.getByText(/1 string result · 13 underlying applications/i)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("shows .AAA as a single-application string row", () => {
    renderHistoricalStringsExplore({ q: "AAA" });

    const table = screen.getByRole("table");
    expect(within(table).getAllByText(".AAA")).toHaveLength(1);
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/1 string result · 1 underlying application/i)).toBeInTheDocument();
  });

  it("opens string drawer with member records, no Compare/Watch/Brief, and View applications by exact ids", async () => {
    const user = userEvent.setup();
    renderHistoricalStringsExplore({ q: "APP" });

    await user.click(
      screen.getAllByRole("button", { name: "View intelligence for .APP" }).find((button) => button.textContent === "Investigate")!,
    );

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/INTELLIGENCE DRAWER · STRING/)).toBeInTheDocument();
    expect(within(drawer).getByText("2012 Reveal Day (historical)")).toBeInTheDocument();
    expect(within(drawer).getByText(/FIELD PROVENANCE · CONTENTION/)).toBeInTheDocument();
    expect(within(drawer).getByText("historical-2012-browser/1.0.0")).toBeInTheDocument();
    expect(within(drawer).queryByText(/snap-rehearsal-2026/)).not.toBeInTheDocument();
    expect(within(drawer).getByText(/SUPPORTING RECORDS · 13/)).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "+ Compare" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Watch" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /Brief this/i })).not.toBeInTheDocument();

    const viewApplications = within(drawer).getByRole("link", { name: /View applications/i });
    const href = viewApplications.getAttribute("href") ?? "";
    expect(href).toContain("dataset=2012-historical");
    expect(href).toContain("entity=applications");
    expect(href).toContain("ids=");
    expect(href).not.toContain("entity=strings");
  });

  it("matches Command Center strings handoff href", () => {
    expect(exploreHistorical2012StringsHref()).toBe("/explore?dataset=2012-historical&entity=strings");
  });
});
