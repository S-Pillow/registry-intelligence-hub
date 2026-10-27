import type {
  AcquisitionDiscoverySource,
  AcquisitionRunScope,
  AcquisitionRunScopeMode,
} from "./types";
import { STAGE_D_HISTORY_PERIOD_COUNT } from "./types";

/**
 * Record authoritative acquisition scope from invocation facts known at
 * orchestration time. Do not infer FULL_STAGE_D from observed counts alone.
 */
export function buildAcquisitionRunScope(args: {
  callerSuppliedPages: boolean;
  probeLimit: number | null | undefined;
  skipHistory: boolean;
  discoverySource: AcquisitionDiscoverySource;
  discoveredTldCount: number;
  probedTldCount: number;
  historyPeriodCount: number;
}): AcquisitionRunScope {
  const probeLimit = args.probeLimit == null ? null : args.probeLimit;
  const historyMode =
    !args.skipHistory && args.historyPeriodCount === STAGE_D_HISTORY_PERIOD_COUNT
      ? "FULL_24_MONTH"
      : "SKIPPED_OR_BOUNDED";
  const intendedProbeUniverse: AcquisitionRunScope["intendedProbeUniverse"] =
    !args.callerSuppliedPages && probeLimit == null
      ? "ALL_DISCOVERED_TLDS"
      : "BOUNDED";

  const discoveryTrusted =
    args.discoverySource === "ICANN_FULL_DISCOVERY"
    || args.discoverySource === "QUALIFIED_DISCOVERY_CACHE";

  const forcedBounded =
    args.callerSuppliedPages
    || probeLimit != null
    || args.skipHistory
    || historyMode !== "FULL_24_MONTH"
    || intendedProbeUniverse !== "ALL_DISCOVERED_TLDS"
    || !discoveryTrusted
    || args.discoverySource === "CALLER_SUPPLIED"
    || args.discoverySource === "LEGACY_UNQUALIFIED_CACHE";

  const mode: AcquisitionRunScopeMode = forcedBounded ? "BOUNDED" : "FULL_STAGE_D";

  return {
    mode,
    discoverySource: args.discoverySource,
    probeLimit,
    historyMode,
    intendedProbeUniverse,
    discoveredTldCount: args.discoveredTldCount,
    probedTldCount: args.probedTldCount,
  };
}
