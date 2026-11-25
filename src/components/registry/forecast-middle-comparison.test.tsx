// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastMiddleComparison } from "@/components/registry/forecast-middle-comparison";
import { sharedMiddleScenarioScaleMax } from "@/lib/forecast-publication-candidate";

afterEach(() => cleanup());

describe("sharedMiddleScenarioScaleMax", () => {
  it("uses one shared max across extensions and ignores null", () => {
    expect(sharedMiddleScenarioScaleMax([10, 50, null, 25])).toBe(50);
    expect(sharedMiddleScenarioScaleMax([null, undefined])).toBeNull();
    expect(sharedMiddleScenarioScaleMax([0, 0])).toBe(0);
  });
});

describe("ForecastMiddleComparison", () => {
  it("charts Middle estimates on a shared scale with numeric labels", () => {
    render(
      <ForecastMiddleComparison
        availability={{ enabled: true, labels: ["small", "large"] }}
        rows={[
          { stringLabel: "small", extension: ".small", middle: 100, measuredDomainCount: 40 },
          { stringLabel: "large", extension: ".large", middle: 400, measuredDomainCount: 200 },
        ]}
      />,
    );

    const root = screen.getByTestId("forecast-middle-comparison");
    expect(root).toHaveAttribute("aria-label", expect.stringMatching(/Middle 100/));
    expect(root).toHaveAttribute("aria-label", expect.stringMatching(/Middle 400/));
    expect(screen.getByTestId("forecast-middle-comparison-small")).toHaveTextContent("100");
    expect(screen.getByTestId("forecast-middle-comparison-large")).toHaveTextContent("400");
    expect(screen.getByTestId("forecast-middle-comparison-small")).toHaveTextContent("40 measured matches");

    const smallBar = screen
      .getByTestId("forecast-middle-comparison-small")
      .querySelector("[aria-hidden] > div") as HTMLElement;
    const largeBar = screen
      .getByTestId("forecast-middle-comparison-large")
      .querySelector("[aria-hidden] > div") as HTMLElement;
    expect(smallBar.style.width).toBe("25%");
    expect(largeBar.style.width).toBe("100%");
  });

  it("does not chart missing estimates as zero-length forecasts", () => {
    render(
      <ForecastMiddleComparison
        availability={{ enabled: true, labels: ["present", "missing"] }}
        rows={[
          { stringLabel: "present", extension: ".present", middle: 80, measuredDomainCount: 10 },
          { stringLabel: "missing", extension: ".missing", middle: null, measuredDomainCount: 5 },
        ]}
      />,
    );

    expect(screen.getByTestId("forecast-middle-unavailable-missing")).toHaveTextContent(
      "Estimate unavailable",
    );
    expect(screen.getByTestId("forecast-middle-comparison-missing")).toHaveTextContent("—");
    expect(
      screen.getByTestId("forecast-middle-comparison-missing").querySelector("[aria-hidden] > div"),
    ).toBeNull();
    expect(screen.getByTestId("forecast-middle-comparison-present").querySelector("[aria-hidden] > div"))
      .not.toBeNull();
  });

  it("labels a true zero Middle estimate without treating it as missing", () => {
    render(
      <ForecastMiddleComparison
        availability={{ enabled: true, labels: ["zero"] }}
        rows={[{ stringLabel: "zero", extension: ".zero", middle: 0, measuredDomainCount: 0 }]}
      />,
    );
    expect(screen.getByTestId("forecast-middle-comparison-zero")).toHaveTextContent("0");
    expect(screen.queryByTestId("forecast-middle-unavailable-zero")).not.toBeInTheDocument();
  });
});
