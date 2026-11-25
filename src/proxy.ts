/**
 * Narrow Next.js Proxy for gated forecast detail/preview routes.
 * - Gate off (neither local preview nor production publication): hard HTTP 404
 * - Gate on + /forecast/preview: hard redirect to /forecast overview
 * Bare `/forecast` remains available when gated data is off (legacy fallback UI).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  buildForecastRoutesDisabledHttpResponse,
  isForecastIntegratedCatalogEnabled,
} from "@/lib/forecast-publication-gate";
import { forecastOverviewHref } from "@/lib/forecast-routes";

export function proxy(request: NextRequest) {
  if (!isForecastIntegratedCatalogEnabled()) {
    return buildForecastRoutesDisabledHttpResponse();
  }

  const { pathname } = request.nextUrl;
  if (pathname.endsWith("/forecast/preview")) {
    const url = request.nextUrl.clone();
    // Keep the current basePath prefix if present; avoid double-prefixing.
    url.pathname = pathname.replace(/\/forecast\/preview\/?$/, forecastOverviewHref());
    return NextResponse.redirect(url, 307);
  }
}

export const config = {
  matcher: [
    "/forecast/preview",
    "/forecast/:label",
    "/tools/registry-intelligence-hub/forecast/preview",
    "/tools/registry-intelligence-hub/forecast/:label",
  ],
};
