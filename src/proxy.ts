/**
 * Narrow Next.js Proxy for gated forecast routes (RIH-FCAST-05C / 07A / 07B).
 * - Gate off: hard HTTP 404 for detail/preview; bare /forecast passes through (legacy fallback)
 * - Gate on: validate catalog; missing label → hard 404; catalog error → hard 503
 * - Gate on + /forecast/preview → hard redirect to overview
 */
import { NextResponse, type NextRequest } from "next/server";
import { loadForecastCatalog } from "@/lib/forecast-catalog-server";
import {
  buildForecastCatalogUnavailableHttpResponse,
  buildForecastNotFoundHttpResponse,
} from "@/lib/forecast-http-response";
import {
  buildForecastRoutesDisabledHttpResponse,
  isForecastIntegratedCatalogEnabled,
} from "@/lib/forecast-publication-gate";
import { decodeForecastLabelParam, forecastOverviewHref } from "@/lib/forecast-routes";

function isForecastOverviewPath(pathname: string): boolean {
  return /\/forecast\/?$/.test(pathname);
}

function isForecastPreviewPath(pathname: string): boolean {
  return pathname.endsWith("/forecast/preview");
}

function forecastLabelFromPath(pathname: string): string | null {
  if (isForecastOverviewPath(pathname) || isForecastPreviewPath(pathname)) return null;
  const match = pathname.match(/\/forecast\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  return decodeForecastLabelParam(match[1]);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const overview = isForecastOverviewPath(pathname);
  const preview = isForecastPreviewPath(pathname);
  const label = forecastLabelFromPath(pathname);

  if (!isForecastIntegratedCatalogEnabled()) {
    if (overview) return; // legacy /forecast fallback
    return buildForecastRoutesDisabledHttpResponse();
  }

  const loaded = await loadForecastCatalog();
  if (loaded.status === "error") {
    return buildForecastCatalogUnavailableHttpResponse(loaded.reason);
  }
  if (loaded.status !== "ok") {
    if (overview) return;
    return buildForecastRoutesDisabledHttpResponse();
  }

  if (preview) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/forecast\/preview\/?$/, forecastOverviewHref());
    return NextResponse.redirect(url, 307);
  }

  if (label != null) {
    if (!label || !loaded.catalog.labelSet.includes(label)) {
      return buildForecastNotFoundHttpResponse();
    }
  }
}

export const config = {
  matcher: [
    "/forecast",
    "/forecast/preview",
    "/forecast/:label",
    "/tools/registry-intelligence-hub/forecast",
    "/tools/registry-intelligence-hub/forecast/preview",
    "/tools/registry-intelligence-hub/forecast/:label",
  ],
};
