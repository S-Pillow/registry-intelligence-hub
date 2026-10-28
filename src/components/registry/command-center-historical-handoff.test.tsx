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
import {
  exploreHistorical2012ApplicationsHref,
  exploreHistorical2012ContentionApplicationsHref,
  exploreHistorical2012IdnApplicationsHref,
  exploreHistorical2012StringsHref,
  roundPulseSupportingRecords,
  buildRoundPulse,
} from "@/lib/registry-data";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import fixture from "@/data/fixtures/registry-applications.json";

const historical2012Loaded = resolveHistorical2012BrowserPayload(
  parse2012ApplicationPayloadJson(
    readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
  ),
  APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
);

const registryResolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);

function renderCommandCenter(
  historicalResolution: typeof historical2012Loaded,
  presentation: "pre-reveal" | "rehearsal" = "pre-reveal",
) {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider resolution={registryResolution}>
        <HubHistorical2012Provider applicationPayload={historicalResolution} confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}>
          <CommandCenter presentation={presentation} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("Command Center — D2.0 historical Explore handoff", () => {
  it("does not expose historical handoff when 2012 payload is not loaded", () => {
    renderCommandCenter({
      status: "not-loaded",
      reason: "not-configured",
      errorMessage: "2012 historical application payload is not configured.",
    });

    expect(screen.queryByTestId("round-pulse-explore-2012-historical")).not.toBeInTheDocument();
    expect(screen.getByTestId("historical-aggregate-only-applications")).toBeInTheDocument();
    expect(screen.getByTestId("historical-aggregate-only-strings")).toBeInTheDocument();
    expect(screen.getByTestId("historical-aggregate-only-idn")).toBeInTheDocument();
    expect(screen.getByTestId("historical-aggregate-only-contention")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open 2012 application corpus/i })).not.toBeInTheDocument();
  });

  it("shows general and Applications-card handoffs with dataset=2012-historical when loaded", () => {
    renderCommandCenter(historical2012Loaded);

    const general = screen.getByTestId("round-pulse-explore-2012-historical");
    expect(general).toHaveAttribute("href", exploreHistorical2012ApplicationsHref());

    const applicationCorpusLinks = screen.getAllByRole("link", { name: /Open 2012 application corpus/i });
    expect(applicationCorpusLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of applicationCorpusLinks) {
      expect(link.getAttribute("href")).toContain("dataset=2012-historical");
      expect(link.getAttribute("href")).toContain("entity=applications");
      expect(link.getAttribute("href")).not.toMatch(/entity=strings/);
    }
  });

  it("links Unique strings card to historical Strings browse and IDN card to filtered Applications browse (D2.2)", () => {
    renderCommandCenter(historical2012Loaded);

    expect(screen.queryByTestId("historical-aggregate-only-idn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-aggregate-only-strings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("historical-aggregate-only-contention")).not.toBeInTheDocument();

    const stringsLink = screen.getByRole("link", { name: /Open 2012 string corpus/i });
    expect(stringsLink.getAttribute("href")).toBe(exploreHistorical2012StringsHref());
    expect(stringsLink.getAttribute("href")).toContain("entity=strings");
    expect(stringsLink.getAttribute("href")).not.toContain("entity=applications");

    const idnLink = screen.getByRole("link", { name: /Open 2012 IDN applications/i });
    expect(idnLink.getAttribute("href")).toBe(exploreHistorical2012IdnApplicationsHref());
    expect(idnLink.getAttribute("href")).toContain("entity=applications");
    expect(idnLink.getAttribute("href")).toContain("idn=idn");

    const contentionLink = within(screen.getByTestId("initial-string-competition")).getByRole("link", { name: /Open 2012 contention applications/i });
    expect(contentionLink.getAttribute("href")).toBe(exploreHistorical2012ContentionApplicationsHref());
    expect(contentionLink.getAttribute("href")).toContain("entity=applications");
    expect(contentionLink.getAttribute("href")).toContain("contention=in");
  });

  it("opens IDN aggregate drawer View applications to historical Explore with IDN filter", async () => {
    const user = userEvent.setup();
    renderCommandCenter(historical2012Loaded);

    await user.click(screen.getByRole("button", { name: "View intelligence for IDN applications: 116" }));
    const viewApplications = await screen.findByRole("link", { name: "View applications" });
    expect(viewApplications.getAttribute("href")).toBe(exploreHistorical2012IdnApplicationsHref());
    expect(viewApplications.getAttribute("href")).not.toContain("snap-rehearsal");
    expect(screen.queryByRole("button", { name: "+ Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch" })).not.toBeInTheDocument();
  });

  it("shows membership round provenance band on contention card only (D2.3 closeout)", () => {
    renderCommandCenter(historical2012Loaded);

    expect(screen.getByTestId("round-pulse-contention-provenance-band")).toHaveTextContent(
      "Historical membership · 2012 round",
    );
    const aggregateBands = screen.getAllByText("Historical aggregate · 2012 Reveal Day");
    expect(aggregateBands).toHaveLength(3);
  });

  it("opens contention aggregate drawer View applications to historical Explore with contention filter (D2.3)", async () => {
    const user = userEvent.setup();
    renderCommandCenter(historical2012Loaded);

    await user.click(
      screen.getByRole("button", { name: "View intelligence for Applications in initial contention: 754" }),
    );
    const viewApplications = await screen.findByRole("link", { name: "View applications" });
    expect(viewApplications.getAttribute("href")).toBe(exploreHistorical2012ContentionApplicationsHref());
    expect(viewApplications.getAttribute("href")).not.toContain("snap-rehearsal");
    expect(screen.queryByRole("button", { name: "+ Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch" })).not.toBeInTheDocument();
  });

  it("opens Applications drawer View applications to historical Explore without rehearsal fallback", async () => {
    const user = userEvent.setup();
    renderCommandCenter(historical2012Loaded);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));
    const viewApplications = await screen.findByRole("link", { name: "View applications" });
    expect(viewApplications.getAttribute("href")).toContain("dataset=2012-historical");
    expect(viewApplications.getAttribute("href")).not.toContain("snap-rehearsal");
    expect(screen.queryByText(/SUPPORTING RECORDS · 12/)).not.toBeInTheDocument();
  });

  it("does not attach rehearsal rows to historical aggregate provenance", () => {
    const pulse = buildRoundPulse(fixture.applications);
    for (const metric of pulse.filter((m) => m.historicalFact)) {
      expect(roundPulseSupportingRecords(metric)).toEqual([]);
    }
  });

  it("keeps rehearsal Round Pulse drill-down off the default page and inside Demo / Rehearsal", () => {
    renderCommandCenter(historical2012Loaded);
    expect(screen.queryByRole("link", { name: "Open Organizations in 2026 rehearsal Explore" })).not.toBeInTheDocument();
    cleanup();

    renderCommandCenter(historical2012Loaded, "rehearsal");
    const orgLink = screen.getByRole("link", { name: "Open Organizations in 2026 rehearsal Explore" });
    expect(orgLink.getAttribute("href")).toBe("/explore?entity=organizations&presentation=rehearsal");
    expect(orgLink.getAttribute("href")).not.toContain("dataset=2012-historical");
  });
});
