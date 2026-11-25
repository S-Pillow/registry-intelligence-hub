/**
 * Centralized experimental forecast route builders (RIH-FCAST-06).
 * App-router paths only — Next.js applies basePath automatically for Link/router.
 */

/** Normalize a proposed extension for routing/lookup: trim, lowercase, strip leading dots. */
export function normalizeForecastLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, "");
}

/** Encode a normalized label for a path segment (preserves xn-- IDN A-labels). */
export function encodeForecastLabelParam(label: string): string {
  const normalized = normalizeForecastLabel(label);
  return encodeURIComponent(normalized);
}

export function decodeForecastLabelParam(param: string): string {
  try {
    return normalizeForecastLabel(decodeURIComponent(param));
  } catch {
    return normalizeForecastLabel(param);
  }
}

/** Overview browse/search surface. */
export function forecastOverviewHref(): string {
  return "/forecast";
}

/** Per-extension experimental forecast detail. */
export function forecastDetailHref(label: string): string | null {
  const normalized = normalizeForecastLabel(label);
  if (!normalized) return null;
  return `/forecast/${encodeForecastLabelParam(normalized)}`;
}

/** Legacy local-preview path; redirects to overview when the gated experience is on. */
export function forecastLocalPreviewHref(): string {
  return "/forecast/preview";
}

export function isForecastDetailPath(pathname: string): boolean {
  const cleaned = pathname.replace(/\/+$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  // With or without basePath prefix
  const idx = parts.lastIndexOf("forecast");
  if (idx < 0) return false;
  const rest = parts.slice(idx + 1);
  return rest.length === 1 && rest[0] !== "preview";
}
