import { join } from "node:path";
import { rspFixtureRoot } from "./bundle-paths";

/** Committed parser/unit-test HTML — never counts as mapping evidence. */
export function syntheticGridFixturesDir(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "fixtures/synthetic");
}

export function defaultSyntheticGridParserFixturePath(workspaceRoot: string): string {
  return join(syntheticGridFixturesDir(workspaceRoot), "viewstatus-grid-parser.fixture.html");
}

/** Real captured viewstatus grid snapshots only (immutable index pass). */
export function realGridSnapshotsDir(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "sources/index");
}

/** Sanitized VPS checkpoint HTML (P0.3D) — parser/remediation regression only. */
export function sanitizedLiveFixturesDir(workspaceRoot: string): string {
  return join(rspFixtureRoot(workspaceRoot), "fixtures/sanitized-live");
}

export function defaultSanitizedLiveMappingRunDir(workspaceRoot: string): string {
  return join(sanitizedLiveFixturesDir(workspaceRoot), "mapping-20260922-vps-01");
}

export function sanitizedLivePageHtmlPath(workspaceRoot: string, pageOrdinal: number): string {
  return join(
    defaultSanitizedLiveMappingRunDir(workspaceRoot),
    `page-${String(pageOrdinal).padStart(4, "0")}.html`,
  );
}

export function isSyntheticGridFixturePath(resolvedPath: string, workspaceRoot: string): boolean {
  const normalized = resolvedPath.replace(/\\/g, "/");
  const syntheticDir = syntheticGridFixturesDir(workspaceRoot).replace(/\\/g, "/");
  if (normalized.startsWith(`${syntheticDir}/`)) return true;
  // Legacy path before I1A separation.
  return normalized.includes("/fixtures/viewstatus-page-1.fixture.html");
}

export function isRealGridSnapshotPath(resolvedPath: string, workspaceRoot: string): boolean {
  const normalized = resolvedPath.replace(/\\/g, "/");
  const indexDir = realGridSnapshotsDir(workspaceRoot).replace(/\\/g, "/");
  return normalized.startsWith(`${indexDir}/`) && normalized.endsWith(".html");
}
