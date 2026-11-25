// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastOverviewContent } from "@/components/registry/forecast-overview-content";
import {
  FORECAST_PUBLIC_SCENARIO_LABELS,
  type ForecastCatalogView,
} from "@/lib/forecast-publication-candidate";

afterEach(() => cleanup());

function catalog(): ForecastCatalogView {
  return {
    heading: "Experimental Registration Forecast — 2026",
    summary: {
      measuredStringCount: 3,
      estimatedStringCount: 2,
      conversionNotRecommendedCount: 1,
      zeroMeasuredDemandCount: 1,
    },
    conversionFactors: { conservative: 0.8, expected: 1.9, optimistic: 3.2 },
    publicScenarioLabels: { ...FORECAST_PUBLIC_SCENARIO_LABELS },
    snapshotDate: "2026-11-07",
    referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
    sourceName: "ActiveDNS",
    sourceUrl: "https://activedns.net/",
    attribution: "ActiveDNS attribution",
    sourcePreviewSha256: "p",
    sourceAggregateSha256: "a",
    disclaimer: "Experimental estimates, not facts.",
    methodologySummary: "Literal suffix matching on a mid-panel snapshot.",
    limitations: [],
    labelSet: ["ity", "wdo", "ab"],
    strings: [
      {
        stringLabel: "ity",
        extension: ".ity",
        measuredDomainCount: 1000,
        status: "estimated",
        scenarios: { low: 800, middle: 1900, high: 3200 },
        brandDesignationObserved: false,
        contested: false,
        origins: ["applied-string"],
        sourceDetail: "Original proposed extension · Recorded in an ICANN application",
      },
      {
        stringLabel: "wdo",
        extension: ".wdo",
        measuredDomainCount: 62,
        status: "estimated",
        scenarios: { low: 50, middle: 118, high: 198 },
        brandDesignationObserved: null,
        contested: null,
        origins: ["known-excluded-primary-string"],
        sourceDetail:
          "Known proposed extension; application details unavailable in the current RIH export · Brand designation unknown",
      },
      {
        stringLabel: "ab",
        extension: ".ab",
        measuredDomainCount: 0,
        status: "conversion_not_recommended",
        scenarios: null,
        brandDesignationObserved: false,
        contested: false,
        origins: ["applied-string"],
        sourceDetail: "Original proposed extension · Recorded in an ICANN application",
      },
    ],
  };
}

describe("ForecastOverviewContent", () => {
  it("compares Middle estimates on a shared scale and avoids Top wording", () => {
    render(<ForecastOverviewContent catalog={catalog()} />);
    const spotlight = screen.getByTestId("forecast-overview-spotlight");
    expect(spotlight).toHaveTextContent("Middle scenario comparison (current listing)");
    expect(spotlight.textContent?.toLowerCase()).not.toMatch(/\btop listed\b/);
    expect(screen.getByTestId("forecast-middle-comparison")).toBeInTheDocument();
    expect(screen.getByTestId("forecast-middle-comparison-ity")).toHaveTextContent("1,900");
    expect(screen.getByTestId("forecast-middle-comparison-wdo")).toHaveTextContent("118");
    expect(screen.getByTestId("forecast-overview-table")).toHaveTextContent("Forecast availability");
    expect(screen.getByTestId("forecast-overview-row-wdo")).toHaveTextContent(
      "Known proposed extension; application details unavailable in the current RIH export",
    );
    expect(screen.getByTestId("forecast-overview-row-wdo").textContent?.toLowerCase()).not.toMatch(
      /known-excluded/,
    );
  });
});
