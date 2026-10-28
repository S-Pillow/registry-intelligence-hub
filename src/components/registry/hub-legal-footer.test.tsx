// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubLegalFooter } from "@/components/registry/hub-legal-footer";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { MarketBaselineOverviewContent } from "@/components/registry/market-baseline-content";
import type { RegistryMarketOverviewModel } from "@/lib/market-baseline-ui";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { loadPublicationV2FromPath } from "@/reveal-day-2026/promotion-contract-2x-io";
import { evaluateApplicationPublicationV2ActualityPromotion } from "@/reveal-day-2026/activation-2x";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { evaluateHumanApprovals } from "@/reveal-day-2026/human-approval";
import { join } from "node:path";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");

afterEach(() => cleanup());

async function renderActiveV2(
  view: "command" | "explore" | "data-health",
  presentation: "pre-reveal" | "rehearsal" = "pre-reveal",
) {
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
          <CommandCenter view={view} presentation={presentation} />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

function overviewFixture(): RegistryMarketOverviewModel {
  return {
    status: "READY",
    userMessage: "ok",
    sourceReportingPeriod: "2026-06",
    sourcePeriodLabel: "June 2026",
    sourceSystemLabel: "ICANN Monthly Registry Reports — Transactions",
    publicationContentSha256: "a".repeat(64),
    publicationShaShort: "aaaaaaaaaaaa…",
    coverage: {
      tldCountInPublication: 3,
      availableAtSourcePeriod: 2,
      missingAtSourcePeriod: 1,
    },
    domainBaseRanking: [],
    monthOverMonthGrowthRanking: [],
    currentPeriodRows: [],
  };
}

describe("HubLegalFooter", () => {
  it("states independence and third-party source rights and links to Data & methodology", () => {
    render(<HubLegalFooter />);
    const footer = screen.getByTestId("hub-legal-footer");
    expect(footer.tagName).toBe("FOOTER");
    expect(within(footer).getByTestId("hub-legal-footer-independence")).toHaveTextContent(
      /independent research and intelligence project/i,
    );
    expect(within(footer).getByTestId("hub-legal-footer-independence")).toHaveTextContent(
      /not affiliated with or endorsed by ICANN or IANA/i,
    );
    expect(within(footer).getByTestId("hub-legal-footer-source-rights")).toHaveTextContent(
      /public third-party sources/i,
    );
    expect(within(footer).getByTestId("hub-legal-footer-source-rights")).toHaveTextContent(
      /respective ownership, copyright, licensing/i,
    );
    expect(within(footer).getByTestId("hub-legal-footer-methodology-link")).toHaveAttribute(
      "href",
      "/data-health",
    );
  });

  it("preserves rehearsal presentation on the methodology link", () => {
    render(<HubLegalFooter presentation="rehearsal" />);
    expect(screen.getByTestId("hub-legal-footer-methodology-link")).toHaveAttribute(
      "href",
      "/data-health?presentation=rehearsal",
    );
  });
});

describe("RIH-WEB-THIRD-PARTY-NOTICE-1 shell integration", () => {
  it("renders exactly one shared legal footer on Command Center", async () => {
    await renderActiveV2("command");
    expect(screen.getAllByTestId("hub-legal-footer")).toHaveLength(1);
  });

  it("renders exactly one shared legal footer on Explore", async () => {
    await renderActiveV2("explore");
    expect(screen.getAllByTestId("hub-legal-footer")).toHaveLength(1);
  });

  it("renders Data Health sources section with ICANN, IANA, and missing-is-not-zero semantics", async () => {
    await renderActiveV2("data-health");
    expect(screen.getAllByTestId("hub-legal-footer")).toHaveLength(1);
    const section = screen.getByTestId("data-health-sources-licensing");
    expect(
      within(section).getByRole("heading", { name: /Sources, licensing & third-party materials/i }),
    ).toBeInTheDocument();
    expect(section).toHaveTextContent(/ICANN/);
    expect(section).toHaveTextContent(/IANA/);
    expect(section).toHaveTextContent(/Monthly Registry Reports/);
    expect(screen.getByTestId("data-health-evidence-maturity")).toHaveTextContent(
      /does not treat missing source data as zero/i,
    );
    expect(screen.getByTestId("data-health-independence")).toHaveTextContent(
      /not affiliated with or endorsed by ICANN, IANA/i,
    );
    expect(section).not.toHaveTextContent(/Apache-2\.0/);
    expect(section).not.toHaveTextContent(/public domain/i);
    expect(section).not.toHaveTextContent(/unrestricted redistribution/i);
  });

  it("preserves rehearsal Data & methodology navigation from the shared footer", async () => {
    await renderActiveV2("command", "rehearsal");
    expect(screen.getByTestId("hub-legal-footer-methodology-link")).toHaveAttribute(
      "href",
      "/data-health?presentation=rehearsal",
    );
  });
});

describe("Registry Market source-rights note", () => {
  it("includes the MRR source-rights note near overview provenance orientation", () => {
    render(<MarketBaselineOverviewContent model={overviewFixture()} presentation="pre-reveal" />);
    const note = screen.getByTestId("registry-market-source-rights-note");
    expect(note).toHaveTextContent(/Monthly Registry Reports/i);
    expect(note).toHaveTextContent(/original ownership and terms/i);
    expect(note).toHaveTextContent(/rather than relicensing/i);
    expect(screen.getByRole("link", { name: /Data & methodology/i })).toHaveAttribute(
      "href",
      "/data-health",
    );
  });
});
