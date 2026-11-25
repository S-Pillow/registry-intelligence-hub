// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastLocalPreviewContent } from "@/components/registry/forecast-local-preview-content";
import type { ForecastLocalPreviewViewModel } from "@/lib/forecast-local-preview";

afterEach(() => cleanup());

function buildView(): ForecastLocalPreviewViewModel {
  return {
    heading: "Experimental Registration Forecast — 2026",
    summary: {
      measuredStringCount: 4,
      estimatedStringCount: 3,
      conversionNotRecommendedCount: 1,
      zeroMeasuredDemandCount: 1,
    },
    conversionFactors: { conservative: 0.8, expected: 1.9, optimistic: 3.2 },
    snapshotDate: "2026-11-07",
    referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
    sourceName: "ActiveDNS",
    sourceUrl: "https://activedns.net/",
    attribution: "ActiveDNS mid-panel attribution fixture",
    previewSha256: "fixture",
    sourceAggregateSha256: "source-fixture",
    disclaimer: "Estimates, not facts.",
    conversionNote: "Experimental factors only.",
    limitations: ["Partial inventory"],
    rows: [
      {
        stringLabel: "wdo",
        extension: ".wdo",
        measuredDomainCount: 62,
        conservative: 50,
        expected: 118,
        optimistic: 198,
        conversionStatus: "estimated",
        statusNote: "experimental",
        brandDesignationObserved: false,
        contested: false,
        origins: ["knownExcludedRecords.primaryString"],
        fromKnownExcluded: true,
        fromNormalizedApplication: false,
        sourceDetail: "known-excluded · knownExcludedRecords.primaryString",
      },
      {
        stringLabel: "hub",
        extension: ".hub",
        measuredDomainCount: 10,
        conservative: 8,
        expected: 19,
        optimistic: 32,
        conversionStatus: "estimated",
        statusNote: "experimental",
        brandDesignationObserved: true,
        contested: false,
        origins: ["appliedString.label"],
        fromKnownExcluded: false,
        fromNormalizedApplication: true,
        sourceDetail: "normalized-app · appliedString.label · brand-observed",
      },
      {
        stringLabel: "ab",
        extension: ".ab",
        measuredDomainCount: 5,
        conservative: null,
        expected: null,
        optimistic: null,
        conversionStatus: "conversion_not_recommended",
        statusNote: "not recommended",
        brandDesignationObserved: null,
        contested: null,
        origins: null,
        fromKnownExcluded: true,
        fromNormalizedApplication: null,
        sourceDetail: "known-excluded · brand-unknown",
      },
      {
        stringLabel: "zero",
        extension: ".zero",
        measuredDomainCount: 0,
        conservative: 0,
        expected: 0,
        optimistic: 0,
        conversionStatus: "estimated",
        statusNote: "zero demand",
        brandDesignationObserved: false,
        contested: false,
        origins: ["appliedString.label"],
        fromKnownExcluded: false,
        fromNormalizedApplication: true,
        sourceDetail: "normalized-app · appliedString.label",
      },
    ],
  };
}

describe("ForecastLocalPreviewContent", () => {
  it("renders heading, summary, methodology disclosures, and WDO values", () => {
    render(<ForecastLocalPreviewContent view={buildView()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Experimental Registration Forecast — 2026",
    );
    const summary = screen.getByTestId("forecast-local-preview-summary");
    expect(summary).toHaveTextContent("4");
    expect(summary).toHaveTextContent("3");
    expect(summary).toHaveTextContent("1");

    const methodology = screen.getByTestId("forecast-local-preview-methodology");
    expect(methodology).toHaveTextContent(/Measured demand/i);
    expect(methodology).toHaveTextContent(/Estimated registrations/i);
    expect(methodology).toHaveTextContent("https://activedns.net/");
    expect(methodology).toHaveTextContent("November 7, 2026");
    expect(methodology).toHaveTextContent(".net");
    expect(methodology).toHaveTextContent(".com and other TLDs are not represented");
    expect(methodology).toHaveTextContent(/Brand, withdrawn, contested/i);
    expect(methodology).toHaveTextContent(/literal/i);

    const wdo = screen.getByTestId("forecast-local-preview-row-wdo");
    expect(wdo).toHaveTextContent(".wdo");
    expect(wdo).toHaveTextContent("62");
    expect(wdo).toHaveTextContent("50");
    expect(wdo).toHaveTextContent("118");
    expect(wdo).toHaveTextContent("198");
  });

  it("searches with and without a leading dot and shows empty state", () => {
    render(<ForecastLocalPreviewContent view={buildView()} />);
    const input = screen.getByTestId("forecast-local-preview-search");

    fireEvent.change(input, { target: { value: ".wdo" } });
    expect(screen.getByTestId("forecast-local-preview-row-wdo")).toBeInTheDocument();
    expect(screen.queryByTestId("forecast-local-preview-row-hub")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "WDO" } });
    expect(screen.getByTestId("forecast-local-preview-row-wdo")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(screen.getByTestId("forecast-local-preview-empty")).toHaveTextContent(
      /No extensions match/i,
    );
  });

  it("keeps Brand-designated rows visible and shows Unknown for null flags", () => {
    render(<ForecastLocalPreviewContent view={buildView()} />);
    expect(screen.getByTestId("forecast-local-preview-row-hub")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("forecast-local-preview-detail-toggle-ab"));
    const detail = screen.getByTestId("forecast-local-preview-detail-ab");
    expect(detail).toHaveTextContent("Unknown");
    expect(within(detail).getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
  });

  it("distinguishes null estimates from legitimate zero values", () => {
    render(<ForecastLocalPreviewContent view={buildView()} />);
    const ab = screen.getByTestId("forecast-local-preview-row-ab");
    expect(ab).toHaveTextContent("Conversion not recommended");
    expect(ab.textContent).toMatch(/—/);

    const zero = screen.getByTestId("forecast-local-preview-row-zero");
    expect(zero).toHaveTextContent("0");
    expect(zero).not.toHaveTextContent("—");
  });

  it("exposes a mobile sideways-scroll affordance and sort aria labels", () => {
    render(<ForecastLocalPreviewContent view={buildView()} />);
    expect(screen.getByTestId("forecast-local-preview-scroll-hint")).toHaveTextContent(
      /Scroll sideways/i,
    );
    expect(screen.getByRole("button", { name: /Sort by Expected/i })).toBeInTheDocument();
  });
});
