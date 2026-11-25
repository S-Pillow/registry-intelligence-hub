/**
 * Hard HTTP responses for forecast routes (RIH-FCAST-07B).
 * Prefer plain Response bodies so production serving cannot soft-200 a not-found UI.
 */

/** Curated public 503 details — never include filesystem paths or raw errno text. */
const PUBLIC_CATALOG_UNAVAILABLE_DETAILS = new Set([
  "Forecast release artifact missing",
  "Forecast release artifact SHA-256 mismatch",
  "Forecast release artifact malformed",
  "Forecast release artifact source hash mismatch",
  "Publication candidate SHA-256 mismatch",
  "Publication candidate malformed",
  "Publication candidate source hash mismatch",
  "Derived publication candidate SHA-256 mismatch",
]);

const PUBLIC_CATALOG_UNAVAILABLE_FALLBACK =
  "Forecast release catalog unavailable.";

/**
 * Map an internal load reason to a visitor-safe detail line.
 * Raw Node/fs diagnostics (paths, errno strings) must never reach the client.
 */
export function publicForecastCatalogUnavailableDetail(reason: string): string {
  const trimmed = reason.trim();
  if (PUBLIC_CATALOG_UNAVAILABLE_DETAILS.has(trimmed)) {
    return trimmed;
  }
  return PUBLIC_CATALOG_UNAVAILABLE_FALLBACK;
}

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
  const publicDetail = publicForecastCatalogUnavailableDetail(reason);
  if (publicDetail !== reason.trim()) {
    console.error(
      "[forecast] catalog unavailable (sanitized for public 503):",
      reason,
    );
  } else {
    console.error("[forecast] catalog unavailable:", reason);
  }
  return new Response(`Forecast unavailable\n\n${publicDetail}\n`, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "private, no-store",
    },
  });
}
