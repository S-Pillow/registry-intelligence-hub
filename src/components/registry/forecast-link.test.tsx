// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastAvailabilityProvider } from "@/components/registry/forecast-availability-provider";
import { ForecastLink } from "@/components/registry/forecast-link";

afterEach(() => cleanup());

describe("ForecastLink", () => {
  it("renders an active detail link only when the label is available", () => {
    render(
      <ForecastAvailabilityProvider enabled labels={["agt", "wdo"]}>
        <ForecastLink label=".agt" />
        <ForecastLink label="missing" fallback={<span data-testid="fallback">nope</span>} />
      </ForecastAvailabilityProvider>,
    );
    expect(screen.getByTestId("forecast-link-agt")).toHaveAttribute("href", "/forecast/agt");
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("forecast-link-missing")).not.toBeInTheDocument();
  });

  it("renders nothing when forecast access is disabled", () => {
    render(
      <ForecastAvailabilityProvider enabled={false} labels={["agt"]}>
        <ForecastLink label="agt" fallback={<span data-testid="disabled-fallback">plain</span>} />
      </ForecastAvailabilityProvider>,
    );
    expect(screen.getByTestId("disabled-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("forecast-link-agt")).not.toBeInTheDocument();
  });
});
