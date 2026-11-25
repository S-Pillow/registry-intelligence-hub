import { describe, expect, it } from "vitest";
import {
  buildForecastRoutesDisabledHttpResponse,
  isForecastIntegratedCatalogEnabled,
  isForecastPublicationEnabled,
} from "@/lib/forecast-publication-gate";

describe("forecast publication gates", () => {
  it("keeps production publication disabled by default", () => {
    expect(isForecastPublicationEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(
      isForecastPublicationEnabled({
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "0",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("enables production publication without requiring NODE_ENV=development", () => {
    expect(
      isForecastPublicationEnabled({
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isForecastIntegratedCatalogEnabled({
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("preserves local development preview gating", () => {
    expect(
      isForecastIntegratedCatalogEnabled({
        NODE_ENV: "development",
        RIH_FORECAST_LOCAL_PREVIEW: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isForecastIntegratedCatalogEnabled({
        NODE_ENV: "production",
        RIH_FORECAST_LOCAL_PREVIEW: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("returns a hard 404 body without forecast content", async () => {
    const res = buildForecastRoutesDisabledHttpResponse();
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toMatch(/wdo|118|Middle scenario|activedns/i);
  });
});
