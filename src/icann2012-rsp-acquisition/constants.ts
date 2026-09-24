/** Crawl limits from D2.5A acquisition plan §4 — defaults until steward raises them. */
export const RSP_ACQUISITION_LIMITS = {
  pilotBatchSize: 25,
  maxApplicationsPerCalendarDay: 250,
  maxConcurrentPortionDownloads: 1,
  maxConcurrentIndexPageDownloads: 2,
  minDelayMsBetweenGtldresultRequests: 1000,
  maxRequestsPerMinute: 60,
  maxIndexGridPages: 56,
  /** Hard stop for mapping-live pagination loops (~56 live pages + headroom). */
  mappingLivePageSafetyCap: 60,
  maxRetriesPerUrl: 5,
  maxPortionBytes: 2 * 1024 * 1024,
  maxAttachmentPdfBytes: 5 * 1024 * 1024,
  maxAttachmentBytesPerApplication: 20 * 1024 * 1024,
  stagingDiskBudgetBytes: 2 * 1024 * 1024 * 1024,
  stagingDiskStopRatio: 0.9,
} as const;

export const GTLDRESULT_ORIGIN = "https://gtldresult.icann.org";

/**
 * Status-grid family. Mapping crawl and pager diagnostic keep this prefix.
 * Do not reuse it for application details or public-portion downloads.
 */
const GTLDRESULT_STATUS_GRID_ROOT = "/application-result/applicationstatus";

/**
 * Application-details family. Official ICANN paths are under `/applicationstatus`
 * with no `/application-result` mount prefix.
 */
const GTLDRESULT_APPLICATION_DETAILS_ROOT = "/applicationstatus";

export const GTLDRESULT_PATHS = {
  statusHub: GTLDRESULT_STATUS_GRID_ROOT,
  viewStatusGrid: `${GTLDRESULT_STATUS_GRID_ROOT}/viewstatus/`,
  gridPager: (page: number) =>
    `${GTLDRESULT_STATUS_GRID_ROOT}/viewstatus.statusgrid.pager/${page}`,
  applicationDetails: (gtldresultAcId: number | string) =>
    `${GTLDRESULT_APPLICATION_DETAILS_ROOT}/applicationdetails/${gtldresultAcId}`,
  downloadPublicPortion: (gtldresultAcId: number | string) =>
    `${GTLDRESULT_APPLICATION_DETAILS_ROOT}/applicationdetails:downloadapplication/${gtldresultAcId}?t:ac=${gtldresultAcId}`,
} as const;

export const RSP_BUNDLE_ID = "icann2012-rsp-public-portions-v1";

/** @deprecated Does not grant live permission — operation-specific gates only. */
export const RSP_ACQUISITION_AUTH_ENV = "REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED";

export const RSP_PILOT_LIVE_AUTH_ENV = "REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED";

/** Required for mapping-live HTTP when implemented — separate from pilot-live. */
export const RSP_MAPPING_LIVE_AUTH_ENV = "REGISTRY_HUB_RSP_MAPPING_AUTHORIZED";

/**
 * Required for the bounded pager-live diagnostic only.
 * Mapping-live authorization does not grant this command.
 */
export const RSP_PAGER_DIAGNOSTIC_AUTH_ENV = "REGISTRY_HUB_RSP_PAGER_DIAGNOSTIC_AUTHORIZED";

/**
 * Required for the one-application public-portion diagnostic only.
 * Pilot-live, mapping-live, and pager-diagnostic authorization do not grant it.
 */
export const RSP_PORTION_DIAGNOSTIC_AUTH_ENV = "REGISTRY_HUB_RSP_PORTION_DIAGNOSTIC_AUTHORIZED";

/** Known approved mapping entry for the one-app portion diagnostic. BOSCH is validation-only. */
export const PORTION_DIAGNOSTIC_APPLICATION_ID = "1-1945-29108";
export const PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID = 170;

/**
 * Two exchanges (details, then the server-provided portion), each at most one
 * request plus five same-origin redirects.
 */
export const PORTION_DIAGNOSTIC_MAX_REDIRECTS_PER_EXCHANGE = 5;
export const PORTION_DIAGNOSTIC_EXCHANGE_COUNT = 2;
export const PORTION_DIAGNOSTIC_HTTP_CEILING =
  PORTION_DIAGNOSTIC_EXCHANGE_COUNT * (1 + PORTION_DIAGNOSTIC_MAX_REDIRECTS_PER_EXCHANGE);

export const PILOT_MANIFEST_EXPECTED_COUNT = 25 as const;

export const RETRY_BACKOFF_MS = [4000, 8000, 16000, 32000, 60000] as const;
