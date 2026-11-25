/**
 * Narrow Next.js Proxy for gated forecast detail/preview routes.
 * - Gate off: hard HTTP 404 before App Router soft-200 streaming
 * - Gate on + /forecast/preview: hard redirect to /forecast overview
 * Bare `/forecast` remains available when gated data is off.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  buildForecastLocalPreviewDisabledHttpResponse,
  isForecastLocalPreviewEnabled,
} from "@/lib/forecast-local-preview";
import { forecastOverviewHref } from "@/lib/forecast-routes";

export function proxy(request: NextRequest) {
  if (!isForecastLocalPreviewEnabled()) {
    return buildForecastLocalPreviewDisabledHttpResponse();
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
