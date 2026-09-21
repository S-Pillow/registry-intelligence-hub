import { join } from "node:path";
import { RSP_BUNDLE_ID } from "./constants";

export function rspFixtureRoot(workspaceRoot: string): string {
  return join(workspaceRoot, "src/normalization/fixtures", RSP_BUNDLE_ID);
}

export function portionDir(workspaceRoot: string, applicationId: string): string {
  return join(rspFixtureRoot(workspaceRoot), "sources/portions", applicationId);
}

export function publicPortionPath(workspaceRoot: string, applicationId: string): string {
  return join(portionDir(workspaceRoot, applicationId), "public-portion.html");
}

export function fetchMetadataPath(workspaceRoot: string, applicationId: string): string {
  return join(portionDir(workspaceRoot, applicationId), "fetch-metadata.json");
}

export function quarantineDir(workspaceRoot: string, applicationId: string): string {
  return join(rspFixtureRoot(workspaceRoot), "quarantine", applicationId);
}

export function checkpointPath(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "acquisition-checkpoint.json");
}

export function pilotManifestPath(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "pilot-manifest-25.json");
}

export function pilotMappingPath(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "pilot-gtldresult-mapping.json");
}

export function applicationIndexPath(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "gtldresult-application-index.json");
}
