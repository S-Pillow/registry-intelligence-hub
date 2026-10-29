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

export function stagingIndexRunDir(stagingRoot: string, runId: string): string {
  return join(stagingRoot, "sources/index", runId);
}

export function stagingIndexPageHtmlPath(
  stagingRoot: string,
  runId: string,
  pageOrdinal: number,
): string {
  const padded = String(pageOrdinal).padStart(4, "0");
  return join(stagingIndexRunDir(stagingRoot, runId), `page-${padded}.html`);
}

export function stagingIndexPageFetchMetadataPath(
  stagingRoot: string,
  runId: string,
  pageOrdinal: number,
): string {
  const padded = String(pageOrdinal).padStart(4, "0");
  return join(stagingIndexRunDir(stagingRoot, runId), `page-${padded}.fetch.json`);
}

export function stagingMappingArtifactPath(stagingRoot: string, runId: string): string {
  return join(stagingRoot, "registry-2012-rsp-mapping", runId, "mapping.json");
}

/** Approved derivative sibling — never overwrites DRAFT mapping.json. */
export function stagingMappingApprovedArtifactPath(stagingRoot: string, runId: string): string {
  return join(stagingRoot, "registry-2012-rsp-mapping", runId, "mapping.approved.json");
}

export function stagingMappingReviewReportPath(stagingRoot: string, runId: string): string {
  return join(stagingRoot, "registry-hub-rsp-mapping-review-report", runId, "mapping-review-report.json");
}

export function stagingEvidenceBundleManifestPath(stagingRoot: string, runId: string): string {
  return join(stagingRoot, "registry-hub-rsp-mapping-evidence-bundle", runId, "manifest.json");
}
