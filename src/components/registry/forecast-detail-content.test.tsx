// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastDetailContent } from "@/components/registry/forecast-detail-content";
import { FORECAST_PUBLIC_SCENARIO_LABELS, type ForecastCatalogView } from "@/lib/forecast-publication-candidate";

afterEach(() => cleanup());

function catalog(): ForecastCatalogView {
  return {
    heading: "Experimental Registration Forecast — 2026",
    summary: {
      measuredStringCount: 1,
      estimatedStringCount: 1,
      conversionNotRecommendedCount: 0,
      zeroMeasuredDemandCount: 0,
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
    labelSet: ["wdo"],
    strings: [
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
    ],
  };
}

describe("ForecastDetailContent", () => {
  it("shows WDO values, Unknown metadata, Low/Middle/High language, and ActiveDNS attribution", () => {
    const view = catalog();
    render(<ForecastDetailContent catalog={view} row={view.strings[0]!} />);
    expect(screen.getByTestId("forecast-detail-heading")).toHaveTextContent(".wdo");
    expect(screen.getByTestId("forecast-detail-summary")).toHaveTextContent("62");
    expect(screen.getByTestId("forecast-detail-summary")).toHaveTextContent("Forecast availability");
    expect(screen.getByTestId("forecast-scenario-bars")).toHaveTextContent("50");
    expect(screen.getByTestId("forecast-scenario-bars")).toHaveTextContent("118");
    expect(screen.getByTestId("forecast-scenario-bars")).toHaveTextContent("198");
    expect(screen.getByTestId("forecast-scenario-bars")).toHaveTextContent(/Low scenario/i);
    expect(screen.getByTestId("forecast-detail-context")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("forecast-detail-context")).toHaveTextContent(
      "Known proposed extension; application details unavailable in the current RIH export",
    );
    expect(screen.getByTestId("forecast-detail-context").textContent?.toLowerCase()).not.toMatch(
      /known-excluded|rejected|ineligible/,
    );
    expect(screen.getByTestId("forecast-methodology-disclosure")).toHaveTextContent("https://activedns.net/");
    expect(screen.getByTestId("forecast-methodology-disclosure").textContent?.toLowerCase()).not.toMatch(
      /toyroom/,
    );
  });
});
