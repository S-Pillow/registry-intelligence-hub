/**
 * Client-safe forecast access gates (RIH-FCAST-07A).
 * Local development preview remains NODE_ENV=development + RIH_FORECAST_LOCAL_PREVIEW=1.
 * Production publication is independently controlled and defaults to disabled.
 */

import { isForecastLocalPreviewEnabled } from "@/lib/forecast-local-preview";

/** Independent production publication gate — does not require NODE_ENV=development. */
export function isForecastPublicationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.RIH_FORECAST_PUBLICATION_ENABLED === "1";
}

/**
 * True when the integrated forecast catalog may be loaded:
 * local preview gate OR production publication gate.
 */
export function isForecastIntegratedCatalogEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isForecastLocalPreviewEnabled(env) || isForecastPublicationEnabled(env);
}

/**
 * Hard HTTP 404 when neither local preview nor production publication is enabled.
 * Omits forecast data and absolute paths.
 */
export function buildForecastRoutesDisabledHttpResponse(): Response {
  return new Response("Not Found\n\nForecast routes are unavailable.\n", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "private, no-store",
    },
  });
}
