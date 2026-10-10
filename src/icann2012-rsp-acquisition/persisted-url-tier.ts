export const PERSISTED_URL_TIERS = ["RESTRICTED_RAW_SOURCE", "SAFE_DERIVED"] as const;

export type PersistedUrlTier = (typeof PERSISTED_URL_TIERS)[number];

const CSRF_QUERY_PATTERN = /([?&]_csrf=)[^&]*/gi;

/** Redact session query material for operator-safe derived artifacts only. */
export function sanitizeUrlForPersistence(
  url: string,
  tier: PersistedUrlTier,
): string {
  if (tier === "RESTRICTED_RAW_SOURCE") return url;
  return url.replace(CSRF_QUERY_PATTERN, "$1REDACTED");
}

/** Alias for Tapestry href attributes — same redaction contract as URLs. */
export function sanitizeHrefForPersistence(
  href: string,
  tier: PersistedUrlTier,
): string {
  return sanitizeUrlForPersistence(href, tier);
}

export function tierForPersistedUrlField(field: "resolvedUrl" | "nextPageHref" | "sourceUrl"): PersistedUrlTier {
  return field === "resolvedUrl" ? "RESTRICTED_RAW_SOURCE" : "SAFE_DERIVED";
}
