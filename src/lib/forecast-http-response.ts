/**
 * Hard HTTP responses for forecast routes (RIH-FCAST-07B).
 * Prefer plain Response bodies so production serving cannot soft-200 a not-found UI.
 */

export function buildForecastNotFoundHttpResponse(
  detail = "Forecast not found.\n",
): Response {
  return new Response(`Not Found\n\n${detail}`, {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "private, no-store",
    },
  });
}

/** Fail-closed when the publication gate is on but the release catalog cannot be loaded. */
export function buildForecastCatalogUnavailableHttpResponse(reason: string): Response {
  return new Response(`Forecast unavailable\n\n${reason}\n`, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "private, no-store",
    },
  });
}
