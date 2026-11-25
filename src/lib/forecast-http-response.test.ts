import { describe, expect, it } from "vitest";
import {
  buildForecastCatalogUnavailableHttpResponse,
  buildForecastNotFoundHttpResponse,
} from "@/lib/forecast-http-response";

describe("forecast HTTP responses", () => {
  it("returns a genuine HTTP 404 without forecast data", async () => {
    const res = buildForecastNotFoundHttpResponse();
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toMatch(/^Not Found/);
    expect(text.toLowerCase()).not.toMatch(/wdo|118|middle scenario|activedns/);
  });

  it("returns HTTP 503 for catalog load failures without leaking paths", async () => {
    const res = buildForecastCatalogUnavailableHttpResponse(
      "Forecast release artifact SHA-256 mismatch",
    );
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("Forecast unavailable");
    expect(text).toContain("SHA-256 mismatch");
    expect(text).not.toMatch(/\/root\/|\.data\//);
  });
});
