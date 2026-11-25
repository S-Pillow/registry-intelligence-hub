import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildForecastCatalogUnavailableHttpResponse,
  buildForecastNotFoundHttpResponse,
  publicForecastCatalogUnavailableDetail,
} from "@/lib/forecast-http-response";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("forecast HTTP responses", () => {
  it("returns a genuine HTTP 404 without forecast data", async () => {
    const res = buildForecastNotFoundHttpResponse();
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toMatch(/^Not Found/);
    expect(text.toLowerCase()).not.toMatch(/wdo|118|middle scenario|activedns/);
  });

  it("returns HTTP 503 for curated catalog failures without leaking paths", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = buildForecastCatalogUnavailableHttpResponse(
      "Forecast release artifact SHA-256 mismatch",
    );
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("Forecast unavailable");
    expect(text).toContain("SHA-256 mismatch");
    expect(text).not.toMatch(/\/root\/|\.data\//);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("keeps 503 fail-closed but strips realistic filesystem diagnostics from the body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fsReason =
      "ENOENT: no such file or directory, open '/root/rih-hist-org-lineage-1-godaddy-neustar-1a5a4e6/.data/registration-forecast/publication/experimental-registration-forecast-release-v1.json'";
    const res = buildForecastCatalogUnavailableHttpResponse(fsReason);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toMatch(/^Forecast unavailable\n/);
    expect(text).toContain("Forecast release catalog unavailable.");
    expect(text).not.toContain("/root/");
    expect(text).not.toContain(".data/registration-forecast");
    expect(text).not.toContain("ENOENT");
    expect(text).not.toContain(fsReason);
    expect(publicForecastCatalogUnavailableDetail(fsReason)).toBe(
      "Forecast release catalog unavailable.",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("sanitized"),
      fsReason,
    );
  });
});
