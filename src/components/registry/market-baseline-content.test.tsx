// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MarketBaselineDetailContent,
  MarketBaselineOverviewContent,
} from "@/components/registry/market-baseline-content";
import type {
  RegistryMarketDetailModel,
  RegistryMarketOverviewModel,
} from "@/lib/market-baseline-ui";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { CommandCenter } from "@/components/registry/command-center";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

afterEach(() => cleanup());

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
    domainBaseRanking: [
      {
        rank: 1,
        tldAsciiLabel: "com",
        displayLabel: ".com",
        href: "/market/com",
        totalDomains: 1000,
        monthOverMonthGrowth: { available: true, value: 0.1, reason: null },
      },
    ],
    monthOverMonthGrowthRanking: [
      {
        rank: 1,
        tldAsciiLabel: "xyz",
        displayLabel: ".xyz",
        href: "/market/xyz",
        monthOverMonthGrowth: 0.2,
        totalDomains: 500,
      },
    ],
    currentPeriodRows: [
      {
        tldAsciiLabel: "com",
        displayLabel: ".com",
        href: "/market/com",
        availability: "AVAILABLE",
        dataStateLabel: "Available",
        totalDomains: 1000,
        monthOverMonthGrowth: { available: true, value: 0.1, reason: null },
        yearOverYearGrowth: { available: true, value: 0.25, reason: null },
        registrarBreadth: 10,
        topRegistrarShare: { available: true, value: 0.4, reason: null },
      },
      {
        tldAsciiLabel: "xyz",
        displayLabel: ".xyz",
        href: "/market/xyz",
        availability: "AVAILABLE",
        dataStateLabel: "Available",
        totalDomains: 500,
        monthOverMonthGrowth: { available: true, value: 0.2, reason: null },
        yearOverYearGrowth: { available: false, value: null, reason: "prior_period_unavailable" },
        registrarBreadth: 5,
        topRegistrarShare: { available: true, value: 0.3, reason: null },
      },
      {
        tldAsciiLabel: "missingtld",
        displayLabel: ".missingtld",
        href: "/market/missingtld",
        availability: "MISSING",
        dataStateLabel: "Report unavailable",
        totalDomains: null,
        monthOverMonthGrowth: null,
        yearOverYearGrowth: null,
        registrarBreadth: null,
        topRegistrarShare: null,
      },
    ],
  };
}

function availableDetail(): RegistryMarketDetailModel {
  return {
    status: "READY",
    userMessage: "ok",
    tldAsciiLabel: "com",
    displayLabel: ".com",
    sourceReportingPeriod: "2026-06",
    sourcePeriodLabel: "June 2026",
    sourceSystemLabel: "ICANN Monthly Registry Reports — Transactions",
    publicationContentSha256: "a".repeat(64),
    dataStateLabel: "Available",
    currentAvailability: "AVAILABLE",
    metrics: {
      totalDomains: 1000,
      monthOverMonthGrowth: { available: true, value: 0.1, reason: null },
      yearOverYearGrowth: { available: true, value: 0.25, reason: null },
      registrarBreadth: 10,
      topRegistrarShare: { available: true, value: 0.4, reason: null },
      top5RegistrarShare: { available: true, value: 0.8, reason: null },
      accreditedRegistrarDomains: 1000,
      specialOrSystemDomains: 0,
      netAddsCount: 12,
      netRenewCount: 34,
      deleteCount: 5,
      transferGainingCount: 1,
      transferLosingCount: 2,
    },
    historyRows: [
      {
        reportingPeriod: "2026-06",
        periodLabel: "June 2026",
        availability: "AVAILABLE",
        dataStateLabel: "Available",
        totalDomains: 1000,
        monthOverMonthGrowth: { available: true, value: 0.1, reason: null },
        yearOverYearGrowth: { available: true, value: 0.25, reason: null },
        netAddsCount: 12,
        deleteCount: 5,
        registrarBreadth: 10,
      },
      {
        reportingPeriod: "2026-05",
        periodLabel: "May 2026",
        availability: "AVAILABLE",
        dataStateLabel: "Available",
        totalDomains: 900,
        monthOverMonthGrowth: null,
        yearOverYearGrowth: null,
        netAddsCount: 8,
        deleteCount: 3,
        registrarBreadth: 9,
      },
    ],
    historyNote: null,
    topAccreditedRegistrars: [
      {
        registrarName: "Alpha Registrar",
        ianaRegistrarId: "100",
        totalDomains: 1000,
        shareOfTldTotal: { available: true, value: 1, reason: null },
      },
    ],
    specialSystemNote:
      "Special/system rows are preserved separately and excluded from registrar breadth.",
    provenance: {
      sourceSystem: "icann-mrr-transactions",
      reportingPeriod: "2026-06",
      sourceUrl: "https://example.test/com.csv",
      rawSha256: "b".repeat(64),
      rawShaShort: "bbbbbbbbbbbb…",
      normalizedContentSha256: "c".repeat(64),
      normalizedShaShort: "cccccccccccc…",
      publicationContentSha256: "a".repeat(64),
      publicationShaShort: "aaaaaaaaaaaa…",
    },
  };
}

describe("Registry Market product content", () => {
  it("renders coverage orientation from model values", () => {
    render(<MarketBaselineOverviewContent model={overviewFixture()} />);
    const orient = screen.getByTestId("registry-market-source-orientation");
    expect(orient).toHaveTextContent("June 2026");
    expect(orient).toHaveTextContent("3");
    expect(orient).toHaveTextContent("2");
    expect(orient).toHaveTextContent("1");
    expect(orient).toHaveTextContent(/does not mean the TLD has zero domains/i);
  });

  it("keeps MISSING rows visible and searchable/filterable", () => {
    render(<MarketBaselineOverviewContent model={overviewFixture()} />);
    expect(screen.getByText(".missingtld")).toBeInTheDocument();
    expect(screen.getAllByText("Report unavailable").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId("registry-market-availability-filter"), {
      target: { value: "missing" },
    });
    const explorer = screen.getByTestId("registry-market-explorer");
    expect(within(explorer).getByText(".missingtld")).toBeInTheDocument();
    expect(within(explorer).queryByText(".com")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("registry-market-availability-filter"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByTestId("registry-market-search"), {
      target: { value: "com" },
    });
    expect(within(explorer).getByText(".com")).toBeInTheDocument();
    expect(within(explorer).queryByText(".xyz")).not.toBeInTheDocument();
  });

  it("domain ranking excludes MISSING and growth uses published ranking", () => {
    render(<MarketBaselineOverviewContent model={overviewFixture()} />);
    const domain = screen.getByTestId("registry-market-domain-ranking");
    expect(within(domain).getByText(".com")).toBeInTheDocument();
    expect(within(domain).queryByText(".missingtld")).not.toBeInTheDocument();
    const growth = screen.getByTestId("registry-market-growth-ranking");
    expect(within(growth).getByText(".xyz")).toBeInTheDocument();
  });

  it("avoids market-share and customer-concentration wording", () => {
    const { container } = render(
      <MarketBaselineDetailContent model={availableDetail()} />,
    );
    expect(container.textContent).not.toMatch(/market share/i);
    expect(container.textContent).not.toMatch(/customer concentration/i);
    expect(container.textContent).not.toMatch(/\brenewal rate\b/i);
    expect(container.textContent).toMatch(/Net renew count/i);
  });

  it("renders detail metrics, history, registrars, and provenance", () => {
    render(<MarketBaselineDetailContent model={availableDetail()} />);
    expect(screen.getByTestId("registry-market-current-metrics")).toHaveTextContent("1,000");
    expect(screen.getByTestId("registry-market-activity-counts")).toHaveTextContent(
      /Net renew count/i,
    );
    expect(screen.getByTestId("registry-market-history")).toBeInTheDocument();
    expect(screen.getByTestId("registry-market-registrars")).toHaveTextContent("Alpha Registrar");
    expect(screen.getByTestId("registry-market-special-note")).toHaveTextContent(
      /Special\/system rows/i,
    );
    expect(screen.getByTestId("registry-market-provenance")).toBeInTheDocument();
  });

  it("shows probe-only history note for single-period coverage", () => {
    const model: RegistryMarketDetailModel = {
      ...availableDetail(),
      status: "MISSING_CURRENT_REPORT",
      metrics: null,
      dataStateLabel: "Report unavailable",
      currentAvailability: "MISSING",
      historyRows: [
        {
          reportingPeriod: "2026-06",
          periodLabel: "June 2026",
          availability: "MISSING",
          dataStateLabel: "Report unavailable",
          totalDomains: null,
          monthOverMonthGrowth: null,
          yearOverYearGrowth: null,
          netAddsCount: null,
          deleteCount: null,
          registrarBreadth: null,
        },
      ],
      historyNote: "Historical series was not acquired for this TLD in the Stage-D baseline.",
      topAccreditedRegistrars: [],
      specialSystemNote: null,
      provenance: null,
    };
    render(<MarketBaselineDetailContent model={model} />);
    expect(screen.getByTestId("registry-market-history-note")).toHaveTextContent(
      /Historical series was not acquired/i,
    );
  });
});

describe("Registry Market navigation", () => {
  it("highlights Registry Market in primary nav", () => {
    render(
      <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
        <HubRegistryDataProvider
          resolution={{
            status: "fail-closed",
            mode: "unavailable",
            reason: "test",
            document: null,
            documentV2: null,
          } as never}
        >
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
            <CommandCenter
              view="market"
              marketOverview={overviewFixture()}
            />
          </HubHistorical2012Provider>
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    const nav = screen.getByTestId("hub-primary-nav");
    const market = within(nav).getByRole("link", { name: "Registry Market" });
    expect(market).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Competitive Landscape" })).toBeInTheDocument();
    expect(screen.getByTestId("registry-market-overview")).toBeInTheDocument();
  });
});
