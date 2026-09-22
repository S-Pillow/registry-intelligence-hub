import {
  RSP_ACQUISITION_AUTH_ENV,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
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
