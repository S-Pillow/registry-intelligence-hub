import {
  sanitizeUrlForPersistence,
  type PersistedUrlTier,
} from "./persisted-url-tier";
import type { PersistedPagerTransaction } from "./types";

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
  /** SAFE_DERIVED application-details URL used for discovery. */
  detailsUrl?: string;
  /** SAFE_DERIVED official server-provided download href (never a manufactured URL). */
  serverProvidedHref?: string;
  /** SAFE_DERIVED resolved public-portion URL actually fetched. */
  resolvedUrl: string;
  /** SAFE_DERIVED final same-origin URL after redirects. */
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
  /** Always current_public_portion for ICANN public-portion downloads. */
  applicationVersionBasis?: "current_public_portion";
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
  /** SAFE_DERIVED server href with sensitive query values redacted. */
  serverProvidedHref?: string | null;
  /** SAFE_DERIVED request URL. Root-relative /applicationstatus paths are not remounted. */
  effectiveRequestUrl?: string | null;
  /** SAFE_DERIVED pager hop. Booleans only; cookie values are never stored. */
  pagerTransaction?: PersistedPagerTransaction | null;
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
  serverProvidedHref?: string | null;
  effectiveRequestUrl?: string | null;
  pagerTransaction?: PersistedPagerTransaction | null;
}): IndexPageFetchMetadataRecord {
  const nextPageHrefSafe =
    input.nextPageHref == null
      ? null
      : sanitizeUrlForPersistence(input.nextPageHref, "SAFE_DERIVED");
  const pagerTransaction = redactPagerTransaction(input.pagerTransaction);
  return {
    ...input,
    resolvedUrlSafe: sanitizeUrlForPersistence(input.resolvedUrl, "SAFE_DERIVED"),
    nextPageHrefSafe,
    serverProvidedHref:
      input.serverProvidedHref == null
        ? null
        : sanitizeUrlForPersistence(input.serverProvidedHref, "SAFE_DERIVED"),
    effectiveRequestUrl:
      input.effectiveRequestUrl == null
        ? null
        : sanitizeUrlForPersistence(input.effectiveRequestUrl, "SAFE_DERIVED"),
    pagerTransaction,
    persistedUrlTierResolved: "RESTRICTED_RAW_SOURCE",
    persistedUrlTierNextPage: "SAFE_DERIVED",
  };
}

function redactPagerTransaction(
  transaction: PersistedPagerTransaction | null | undefined,
): PersistedPagerTransaction | null {
  if (transaction == null) return null;
  const redact = (value: string | null) =>
    value == null ? null : sanitizeUrlForPersistence(value, "SAFE_DERIVED");
  return {
    serverProvidedHref: redact(transaction.serverProvidedHref),
    pagerRequestedUrl: redact(transaction.pagerRequestedUrl),
    pagerStatus: transaction.pagerStatus,
    redirectLocation: redact(transaction.redirectLocation),
    redirectCount: transaction.redirectCount,
    finalUrl: redact(transaction.finalUrl),
    sessionCookieSent: transaction.sessionCookieSent === true,
    intermediateSetCookieObserved: transaction.intermediateSetCookieObserved === true,
    displayStart: transaction.displayStart,
    displayEnd: transaction.displayEnd,
    displayTotal: transaction.displayTotal,
  };
}

export function buildPortionFetchMetadata(input: {
  applicationId: string;
  gtldresultAcId: number;
  detailsUrl?: string;
  serverProvidedHref?: string;
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
  applicationVersionBasis?: "current_public_portion";
}): PortionFetchMetadataRecord {
  const redact = (url: string | undefined): string | undefined =>
    url == null ? undefined : sanitizeUrlForPersistence(url, "SAFE_DERIVED");
  return {
    applicationId: input.applicationId,
    gtldresultAcId: input.gtldresultAcId,
    detailsUrl: redact(input.detailsUrl),
    serverProvidedHref: redact(input.serverProvidedHref),
    resolvedUrl: sanitizeUrlForPersistence(input.resolvedUrl, "SAFE_DERIVED"),
    finalUrl: redact(input.finalUrl),
    redirectChain: input.redirectChain?.map((u) => sanitizeUrlForPersistence(u, "SAFE_DERIVED")),
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
    applicationVersionBasis: input.applicationVersionBasis ?? "current_public_portion",
  };
}
