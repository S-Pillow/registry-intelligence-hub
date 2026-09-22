/** Crawl limits from D2.5A acquisition plan §4 — defaults until steward raises them. */
export const RSP_ACQUISITION_LIMITS = {
  pilotBatchSize: 25,
  maxApplicationsPerCalendarDay: 250,
  maxConcurrentPortionDownloads: 1,
  maxConcurrentIndexPageDownloads: 2,
  minDelayMsBetweenGtldresultRequests: 1000,
  maxRequestsPerMinute: 60,
  maxIndexGridPages: 56,
  maxRetriesPerUrl: 5,
  maxPortionBytes: 2 * 1024 * 1024,
  maxAttachmentPdfBytes: 5 * 1024 * 1024,
  maxAttachmentBytesPerApplication: 20 * 1024 * 1024,
  stagingDiskBudgetBytes: 2 * 1024 * 1024 * 1024,
  stagingDiskStopRatio: 0.9,
} as const;

export const GTLDRESULT_ORIGIN = "https://gtldresult.icann.org";

export const GTLDRESULT_PATHS = {
  statusHub: "/application-result/applicationstatus",
  viewStatusGrid: "/application-result/applicationstatus/viewstatus/",
  applicationDetails: (gtldresultAcId: number | string) =>
    `/applicationstatus/applicationdetails/${gtldresultAcId}`,
  downloadPublicPortion: (gtldresultAcId: number | string) =>
    `/applicationstatus/applicationdetails:downloadapplication/${gtldresultAcId}?t:ac=${gtldresultAcId}`,
  gridPager: (page: number) => `/applicationstatus/viewstatus.statusgrid.pager/${page}`,
} as const;

export const RSP_BUNDLE_ID = "icann2012-rsp-public-portions-v1";

/** @deprecated Does not grant live permission — operation-specific gates only. */
export const RSP_ACQUISITION_AUTH_ENV = "REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED";

export const RSP_PILOT_LIVE_AUTH_ENV = "REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED";

/** Required for mapping-live HTTP when implemented — separate from pilot-live. */
export const RSP_MAPPING_LIVE_AUTH_ENV = "REGISTRY_HUB_RSP_MAPPING_AUTHORIZED";

export const PILOT_MANIFEST_EXPECTED_COUNT = 25 as const;

export const RETRY_BACKOFF_MS = [4000, 8000, 16000, 32000, 60000] as const;
