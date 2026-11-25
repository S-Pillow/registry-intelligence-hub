/**
 * Narrow Next.js Proxy gate for the local forecast preview route.
 * Returns a real HTTP 404 before the App Router streams a soft-200 shell
 * when the development preview flag is off (see Next.js loading status-codes docs).
 */
import { resolveForecastLocalPreviewProxy } from "@/lib/forecast-local-preview";

export function proxy() {
  return resolveForecastLocalPreviewProxy();
}

export const config = {
  // Match both the app-relative path and the deployed basePath form.
  matcher: [
    "/forecast/preview",
    "/tools/registry-intelligence-hub/forecast/preview",
  ],
};
