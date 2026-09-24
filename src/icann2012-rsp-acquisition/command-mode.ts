export type AcquisitionCommandMode =
  | "pilot"
  | "pilot-live"
  | "mapping-dry-run"
  | "mapping-live"
  | "mapping-live-plan"
  | "mapping-review"
  | "pager-live-diagnostic";

export interface CommandModeNetworkPolicy {
  mode: AcquisitionCommandMode;
  allowsOutboundHttp: boolean;
  requiresPilotLiveAuth: boolean;
  requiresMappingLiveAuth: boolean;
  requiresPagerDiagnosticAuth: boolean;
}

export function networkPolicyForCommand(mode: AcquisitionCommandMode): CommandModeNetworkPolicy {
  switch (mode) {
    case "pilot":
    case "mapping-dry-run":
    case "mapping-review":
    case "mapping-live-plan":
      return {
        mode,
        allowsOutboundHttp: false,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: false,
      };
    case "pilot-live":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: true,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: false,
      };
    case "mapping-live":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: true,
        requiresPagerDiagnosticAuth: false,
      };
    case "pager-live-diagnostic":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: true,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
