import { RSP_ACQUISITION_LIMITS } from "./constants";

/** Truthful live-run HTTP expectations (mapping-live-plan performs zero HTTP). */
export const MAPPING_LIVE_LIVE_RUN_EXPECTATIONS = {
  planNetworkRequests: 0 as const,
  liveRunNetworkRequired: true as const,
  /** Session bootstrap GET before grid pagination (status hub). */
  liveRunBootstrapRequestsExpected: 1 as const,
  liveRunUniquePageRequestsExpected:
    "unknown until server pagination discovery" as const,
  liveRunObservedHistoricalShape: "approximately 56 grid pages" as const,
  liveRunPageSafetyCap: RSP_ACQUISITION_LIMITS.mappingLivePageSafetyCap,
  liveRunRetryPolicy: "bounded" as const,
} as const;

export type MappingLiveLiveRunExpectations = typeof MAPPING_LIVE_LIVE_RUN_EXPECTATIONS;
