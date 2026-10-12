// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { filterApplicationsByExplore } from "@/lib/registry-data";
import { exploreHistorical2012RegionHref } from "@/lib/registry-data";
import { HUB_BASE_PATH } from "@/lib/hub-paths";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { exploreFiltersFor2012Historical } from "@/historical-2012/explore-historical-table";
import { evaluateApplicationPublicationV2ActualityPromotion } from "@/reveal-day-2026/activation-2x";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { evaluateHumanApprovals } from "@/reveal-day-2026/human-approval";
import { loadPublicationV2FromPath } from "@/reveal-day-2026/promotion-contract-2x-io";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const HIST_PAYLOAD = join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json");

afterEach(() => cleanup());

async function renderPromotedExplore(exploreParams: Record<string, string>) {
  const publication = await loadPublicationV2FromPath(REVEAL_APP);
  const payload = buildBrowserApplicationPayloadFromPublicationV2(publication);
  const claim = evaluateApplicationPublicationV2ActualityPromotion(
    publication,
    DEFAULT_CLAIM_ACTUALITY_STATE,
    evaluateHumanApprovals({ stewardApprovalId: "s", productApprovalId: "p" }),
  ).nextState;
  const resolution = resolveActiveRegistryApplicationsDocument(claim, payload);
  expect(resolution.mode).toBe("promoted-2026-v2");
  expect(resolution.document).toBeNull();

  const historical = parse2012ApplicationPayloadJson(readFileSync(HIST_PAYLOAD, "utf8"));
  const historicalResolution = resolveHistorical2012BrowserPayload(
    historical,
    APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
  );
  expect(historicalResolution.status).toBe("loaded");

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
          applicationPayload={historicalResolution}
          confirmedPortfolios={{
            status: "not-loaded",
            reason: "not-configured",
            errorMessage: "test",
          }}
          structuralSummary={null}
        >
          <CommandCenter view="explore" exploreParams={exploreParams} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("HIST-EXPLORE-ROUTING-1 promoted ActiveV2 + explicit historical dataset", () => {
  it("dataset=2012-historical selects historical Explore even when ActiveV2 is promoted", async () => {
    await renderPromotedExplore({
      dataset: "2012-historical",
      entity: "applications",
      region: "NA",
    });
    expect(screen.queryByTestId("command-center-active-v2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("explore-content-v2")).not.toBeInTheDocument();
    expect(screen.getByTestId("explore-content-historical")).toBeInTheDocument();
    expect(screen.getByTestId("explore-dataset-badge")).toHaveTextContent(/2012 Reveal Day historical/i);
    expect(screen.getByText(/full 2012 Reveal Day application corpus/i)).toBeInTheDocument();
    expect(screen.getByText(/2012 historical dataset — not mixed with 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/1,614 application records currently represented/i)).not.toBeInTheDocument();
  }, 30_000);

  it(
    "historical entity=strings stays on the historical surface under ActiveV2 promotion",
    async () => {
      await renderPromotedExplore({
        dataset: "2012-historical",
        entity: "strings",
      });
      expect(screen.getByTestId("explore-content-historical")).toBeInTheDocument();
      expect(screen.queryByTestId("explore-content-v2")).not.toBeInTheDocument();
      expect(screen.getByText(/unique applied strings/i)).toBeInTheDocument();
    },
    30_000,
  );

  it("historical Applicant q search stays on the historical surface", async () => {
    await renderPromotedExplore({
      dataset: "2012-historical",
      entity: "applications",
      q: "Charleston Road Registry Inc.",
    });
    expect(screen.getByTestId("explore-content-historical")).toBeInTheDocument();
    expect(screen.queryByTestId("explore-content-v2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search all registry records")).toHaveValue(
      "Charleston Road Registry Inc.",
    );
  });

  it("plain Explore without historical dataset keeps promoted ActiveV2 ExploreContentV2", async () => {
    await renderPromotedExplore({ entity: "applications" });
    expect(screen.getByTestId("command-center-active-v2")).toBeInTheDocument();
    expect(screen.getByTestId("explore-content-v2")).toBeInTheDocument();
    expect(screen.queryByTestId("explore-content-historical")).not.toBeInTheDocument();
  });

  it("preserves basePath-safe historical region hrefs", () => {
    expect(exploreHistorical2012RegionHref("NA")).toBe(
      "/explore?dataset=2012-historical&entity=applications&region=NA",
    );
    expect(`${HUB_BASE_PATH}${exploreHistorical2012RegionHref("EUR")}`).toContain(
      `${HUB_BASE_PATH}/explore?dataset=2012-historical`,
    );
  });
});

describe("HIST-EXPLORE-ROUTING-1 historical region filter data pins", () => {
  it("filters the accepted 2012 corpus by application.region", () => {
    const historical = parse2012ApplicationPayloadJson(readFileSync(HIST_PAYLOAD, "utf8"));
    expect(historical.applications).toHaveLength(1930);

    const counts = Object.fromEntries(
      ["NA", "EUR", "AP", "LAC", "AF"].map((region) => {
        const filters = exploreFiltersFor2012Historical({
          q: "",
          entity: "applications",
          category: "all",
          region,
          status: "all",
          contention: "all",
          idn: "all",
          sort: "applications-desc",
          ids: "",
        });
        return [region, filterApplicationsByExplore(historical.applications, filters).length];
      }),
    );

    expect(counts).toEqual({
      NA: 911,
      EUR: 675,
      AP: 303,
      LAC: 24,
      AF: 17,
    });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1930);

    const all = filterApplicationsByExplore(
      historical.applications,
      exploreFiltersFor2012Historical({
        q: "",
        entity: "applications",
        category: "all",
        region: "all",
        status: "all",
        contention: "all",
        idn: "all",
        sort: "applications-desc",
        ids: "",
      }),
    );
    expect(all).toHaveLength(1930);
  });

  it("does not mutate the promoted publication bytes", () => {
    const before = createHash("sha256").update(readFileSync(REVEAL_APP)).digest("hex");
    parse2012ApplicationPayloadJson(readFileSync(HIST_PAYLOAD, "utf8"));
    const after = createHash("sha256").update(readFileSync(REVEAL_APP)).digest("hex");
    expect(after).toBe(before);
    expect(before).toBe("d925a23465d26c2437ddac1f8d8aa09ca227622a22c36d1c24d65e793132623f");
  });
});
