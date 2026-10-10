import {
  RSP_ACQUISITION_AUTH_ENV,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PAGER_DIAGNOSTIC_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
  RSP_PORTION_DIAGNOSTIC_AUTH_ENV,
} from "./constants";

export function isLegacyAcquisitionEnvSet(): boolean {
  return process.env[RSP_ACQUISITION_AUTH_ENV] === "1";
}

export function isPilotLiveAuthorized(): boolean {
  return process.env[RSP_PILOT_LIVE_AUTH_ENV] === "1";
}

export function isMappingLiveAuthorized(): boolean {
  return process.env[RSP_MAPPING_LIVE_AUTH_ENV] === "1";
}

/** Legacy env never grants live HTTP — operation-specific gates only. */
export function assertPilotLiveAuthGate(): void {
  if (!isPilotLiveAuthorized()) {
    throw new Error(`Pilot-live requires ${RSP_PILOT_LIVE_AUTH_ENV}=1`);
  }
}

export function assertMappingLiveAuthGate(): void {
  if (!isMappingLiveAuthorized()) {
    throw new Error(`Mapping-live requires ${RSP_MAPPING_LIVE_AUTH_ENV}=1`);
  }
}

export function isPagerDiagnosticAuthorized(): boolean {
  return process.env[RSP_PAGER_DIAGNOSTIC_AUTH_ENV] === "1";
}

/** Mapping-live auth does not satisfy this gate. */
export function assertPagerDiagnosticAuthGate(): void {
  if (!isPagerDiagnosticAuthorized()) {
    throw new Error(
      `Pager diagnostic requires ${RSP_PAGER_DIAGNOSTIC_AUTH_ENV}=1. ` +
        `${RSP_MAPPING_LIVE_AUTH_ENV} does not authorize this command.`,
    );
  }
}

export function isPortionDiagnosticAuthorized(): boolean {
  return process.env[RSP_PORTION_DIAGNOSTIC_AUTH_ENV] === "1";
}

/**
 * Only the portion-diagnostic env authorizes this command.
 * Pilot-live, mapping-live, and pager-diagnostic gates do not.
 */
export function assertPortionDiagnosticAuthGate(): void {
  if (!isPortionDiagnosticAuthorized()) {
    throw new Error(
      `Portion diagnostic requires ${RSP_PORTION_DIAGNOSTIC_AUTH_ENV}=1. ` +
        `${RSP_PILOT_LIVE_AUTH_ENV}, ${RSP_MAPPING_LIVE_AUTH_ENV}, and ` +
        `${RSP_PAGER_DIAGNOSTIC_AUTH_ENV} do not authorize this command.`,
    );
  }
}
