// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastScenarioBars } from "@/components/registry/forecast-scenario-bars";

afterEach(() => cleanup());

describe("ForecastScenarioBars", () => {
  it("renders accessible scenario comparison and unavailable state", () => {
    const { rerender } = render(
      <ForecastScenarioBars scenarios={{ low: 50, middle: 118, high: 198 }} measuredDomainCount={62} />,
    );
    const bars = screen.getByTestId("forecast-scenario-bars");
    expect(bars).toHaveAttribute("role", "img");
    expect(bars).toHaveAccessibleName(/Low 50, Middle 118, High 198/i);
    expect(bars).toHaveTextContent(/not confidence intervals/i);

    rerender(<ForecastScenarioBars scenarios={null} measuredDomainCount={5} />);
    expect(screen.getByTestId("forecast-scenario-unavailable")).toHaveTextContent(/not recommended/i);
    expect(screen.getByTestId("forecast-scenario-unavailable")).toHaveTextContent("5");
  });
});
