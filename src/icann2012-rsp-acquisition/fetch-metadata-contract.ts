import {
  sanitizeUrlForPersistence,
  type PersistedUrlTier,
} from "./persisted-url-tier";

const FORBIDDEN_METADATA_KEYS = new Set([
  "cookie",
  "cookies",
  "set-cookie",
  "csrf",
  "csrfToken",
  "authorization",
  "auth",
  "x-csrf-token",
]);

export interface PortionFetchMetadataRecord {
  applicationId: string;
  gtldresultAcId: number;
  resolvedUrl: string;
  finalUrl?: string;
  redirectChain?: string[];
  httpStatus: number;
  contentType?: string;
  contentLength: number;
  contentSha256: string;
  dateHeader?: string;
  etag?: string;
  lastModified?: string;
  retryAfter?: string;
  retrievedAt: string;
  runId?: string;
}

export function redactForbiddenFetchMetadataKeys(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

export interface IndexPageFetchMetadataRecord {
  pageOrdinal: number;
  /** RESTRICTED_RAW_SOURCE — may include live session query parameters. */
  resolvedUrl: string;
  /** SAFE_DERIVED operator-facing URL with `_csrf=REDACTED`. */
  resolvedUrlSafe?: string;
  finalUrl?: string;
  redirectChain?: string[];
  httpStatus: number;
  contentType?: string;
  contentLength: number;
  contentSha256: string;
  retrievedAt: string;
  runId: string;
  displayStart?: number | null;
  displayEnd?: number | null;
  displayTotal?: number | null;
  parsedRowCount: number;
  quarantinedBlockCount: number;
  nextPageHref?: string | null;
  nextPageHrefSafe?: string | null;
  persistedUrlTierResolved?: PersistedUrlTier;
  persistedUrlTierNextPage?: PersistedUrlTier;
}

export function buildIndexPageFetchMetadata(input: {
  pageOrdinal: number;
  resolvedUrl: string;
  finalUrl?: string;
  redirectChain?: string[];
  httpStatus: number;
  contentType?: string;
  contentLength: number;
  contentSha256: string;
  retrievedAt: string;
  runId: string;
  displayStart?: number | null;
  displayEnd?: number | null;
  displayTotal?: number | null;
  parsedRowCount: number;
  quarantinedBlockCount: number;
  nextPageHref?: string | null;
}): IndexPageFetchMetadataRecord {
  const nextPageHrefSafe =
    input.nextPageHref == null
      ? null
      : sanitizeUrlForPersistence(input.nextPageHref, "SAFE_DERIVED");
  return {
    ...input,
    resolvedUrlSafe: sanitizeUrlForPersistence(input.resolvedUrl, "SAFE_DERIVED"),
    nextPageHrefSafe,
    persistedUrlTierResolved: "RESTRICTED_RAW_SOURCE",
    persistedUrlTierNextPage: "SAFE_DERIVED",
  };
}

export function buildPortionFetchMetadata(input: {
  applicationId: string;
  gtldresultAcId: number;
  resolvedUrl: string;
  finalUrl?: string;
  redirectChain?: string[];
  httpStatus: number;
  contentType?: string;
  contentLength: number;
  contentSha256: string;
  dateHeader?: string;
  etag?: string;
  lastModified?: string;
  retryAfter?: string;
  retrievedAt: string;
  runId?: string;
}): PortionFetchMetadataRecord {
  return {
    applicationId: input.applicationId,
    gtldresultAcId: input.gtldresultAcId,
    resolvedUrl: input.resolvedUrl,
    finalUrl: input.finalUrl,
    redirectChain: input.redirectChain,
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    contentLength: input.contentLength,
    contentSha256: input.contentSha256,
    dateHeader: input.dateHeader,
    etag: input.etag,
    lastModified: input.lastModified,
    retryAfter: input.retryAfter,
    retrievedAt: input.retrievedAt,
    runId: input.runId,
  };
}
