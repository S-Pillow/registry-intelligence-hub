import { describe, expect, it } from "vitest";
import {
  decodeForecastLabelParam,
  encodeForecastLabelParam,
  forecastDetailHref,
  forecastOverviewHref,
  normalizeForecastLabel,
} from "@/lib/forecast-routes";

describe("forecast routes", () => {
  it("normalizes labels with or without a leading dot", () => {
    expect(normalizeForecastLabel(".WDO")).toBe("wdo");
    expect(normalizeForecastLabel("agt")).toBe("agt");
  });

  it("builds exact string detail hrefs", () => {
    expect(forecastOverviewHref()).toBe("/forecast");
    expect(forecastDetailHref(".agt")).toBe("/forecast/agt");
    expect(forecastDetailHref("")).toBeNull();
    expect(decodeForecastLabelParam(encodeForecastLabelParam("xn--io0a7i"))).toBe("xn--io0a7i");
  });

  it("keeps original and replacement labels as distinct destinations", () => {
    expect(forecastDetailHref("agt")).toBe("/forecast/agt");
    expect(forecastDetailHref("master")).toBe("/forecast/master");
    expect(forecastDetailHref("agt")).not.toBe(forecastDetailHref("master"));
  });
});
