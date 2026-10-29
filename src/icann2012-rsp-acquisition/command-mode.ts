export type AcquisitionCommandMode =
  | "pilot"
  | "pilot-live"
  | "mapping-dry-run"
  | "mapping-live"
  | "mapping-live-plan"
  | "mapping-review"
  | "mapping-apply-review"
  | "pager-live-diagnostic"
  | "portion-live-diagnostic";

export interface CommandModeNetworkPolicy {
  mode: AcquisitionCommandMode;
  allowsOutboundHttp: boolean;
  requiresPilotLiveAuth: boolean;
  requiresMappingLiveAuth: boolean;
  requiresPagerDiagnosticAuth: boolean;
  requiresPortionDiagnosticAuth: boolean;
}

export function networkPolicyForCommand(mode: AcquisitionCommandMode): CommandModeNetworkPolicy {
  switch (mode) {
    case "pilot":
    case "mapping-dry-run":
    case "mapping-review":
    case "mapping-apply-review":
    case "mapping-live-plan":
      return {
        mode,
        allowsOutboundHttp: false,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: false,
        requiresPortionDiagnosticAuth: false,
      };
    case "pilot-live":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: true,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: false,
        requiresPortionDiagnosticAuth: false,
      };
    case "mapping-live":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: true,
        requiresPagerDiagnosticAuth: false,
        requiresPortionDiagnosticAuth: false,
      };
    case "pager-live-diagnostic":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: true,
        requiresPortionDiagnosticAuth: false,
      };
    case "portion-live-diagnostic":
      return {
        mode,
        allowsOutboundHttp: true,
        requiresPilotLiveAuth: false,
        requiresMappingLiveAuth: false,
        requiresPagerDiagnosticAuth: false,
        requiresPortionDiagnosticAuth: true,
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
