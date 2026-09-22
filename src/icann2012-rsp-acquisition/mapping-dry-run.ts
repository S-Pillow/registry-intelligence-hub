import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadPilotManifest } from "./load-manifest";
import {
  isRealGridSnapshotPath,
  isSyntheticGridFixturePath,
} from "./grid-evidence-paths";
import { mergeGridRowsIntoMapping, parseViewstatusGridHtml } from "./viewstatus-parser";

export type MappingResolveSource =
  | "manifest"
  | "real-grid-snapshot"
  | "approved-mapping-artifact"
  | "unresolved";

export interface MappingDryRunOptions {
  workspaceRoot: string;
  /** Real captured grid HTML under sources/index/ only. */
  gridHtmlPath?: string;
  /** CSV with columns applicationId,gtldresultAcId (steward-approved artifact). */
  mappingCsvPath?: string;
  /** JSON mapping artifact (pilot-gtldresult-mapping schema). */
  approvedMappingJsonPath?: string;
}

export interface MappingDryRunResult {
  mode: "mapping-dry-run";
  gridRowsParsed: number;
  gridQuarantinedBlocks: number;
  mappedFromGrid: number;
  manifestResolved: number;
  pilotEntries: number;
  resolved: Array<{ applicationId: string; gtldresultAcId: number | null; source: MappingResolveSource }>;
  unresolvedApplicationIds: string[];
}

async function loadOptionalMappingCsv(path: string): Promise<Map<string, number>> {
  const text = await readFile(path, "utf8");
  const map = new Map<string, number>();
  const lines = text.trim().split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.toLowerCase().includes("applicationid")) continue;
    const [applicationId, acRaw] = line.split(",").map((s) => s.trim());
    if (!applicationId || !acRaw) continue;
    map.set(applicationId, Number(acRaw));
  }
  return map;
}

async function loadApprovedMappingJson(path: string): Promise<Map<string, number>> {
  const { loadRspMappingArtifact } = await import("./load-manifest");
  const doc = await loadRspMappingArtifact(path);
  const map = new Map<string, number>();
  for (const entry of doc.entries) {
    if (entry.gtldresultAcId != null) {
      map.set(entry.applicationId, entry.gtldresultAcId);
    }
  }
  return map;
}

function assertEvidenceGridPath(resolvedPath: string, workspaceRoot: string): void {
  if (isSyntheticGridFixturePath(resolvedPath, workspaceRoot)) {
    throw new Error(
      `Grid HTML is a synthetic parser fixture (non-evidence): ${resolvedPath}. ` +
        "Use sources/index/viewstatus-page-*.html from a real snapshot pass.",
    );
  }
  if (!isRealGridSnapshotPath(resolvedPath, workspaceRoot)) {
    throw new Error(
      `Grid HTML path is not a real index snapshot under sources/index/: ${resolvedPath}`,
    );
  }
}

export async function runMappingDryRun(options: MappingDryRunOptions): Promise<MappingDryRunResult> {
  const manifest = await loadPilotManifest(options.workspaceRoot);

  let gridMap = new Map<string, number>();
  let gridQuarantinedBlocks = 0;
  if (options.gridHtmlPath) {
    const gridPath = resolve(options.gridHtmlPath);
    assertEvidenceGridPath(gridPath, options.workspaceRoot);
    const html = await readFile(gridPath, "utf8");
    const parsed = parseViewstatusGridHtml(html);
    gridQuarantinedBlocks = parsed.quarantinedBlocks.length;
    gridMap = mergeGridRowsIntoMapping(parsed.rows);
  }

  let artifactMap = new Map<string, number>();
  if (options.mappingCsvPath) {
    artifactMap = await loadOptionalMappingCsv(resolve(options.mappingCsvPath));
  }
  if (options.approvedMappingJsonPath) {
    const fromJson = await loadApprovedMappingJson(resolve(options.approvedMappingJsonPath));
    for (const [k, v] of fromJson) artifactMap.set(k, v);
  }

  const resolved: MappingDryRunResult["resolved"] = [];
  const unresolvedApplicationIds: string[] = [];
  let manifestResolved = 0;

  for (const entry of manifest.entries) {
    let acId: number | null = entry.gtldresultAcId ?? null;
    let source: MappingResolveSource = acId != null ? "manifest" : "unresolved";

    if (acId != null) {
      manifestResolved += 1;
    } else if (gridMap.has(entry.applicationId)) {
      acId = gridMap.get(entry.applicationId)!;
      source = "real-grid-snapshot";
    } else if (artifactMap.has(entry.applicationId)) {
      acId = artifactMap.get(entry.applicationId)!;
      source = "approved-mapping-artifact";
    }

    resolved.push({ applicationId: entry.applicationId, gtldresultAcId: acId, source });
    if (acId == null) unresolvedApplicationIds.push(entry.applicationId);
  }

  return {
    mode: "mapping-dry-run",
    gridRowsParsed: gridMap.size,
    gridQuarantinedBlocks,
    mappedFromGrid: gridMap.size,
    manifestResolved,
    pilotEntries: manifest.entries.length,
    resolved,
    unresolvedApplicationIds,
  };
}

export function formatMappingDryRun(result: MappingDryRunResult): string {
  const lines = [
    "icann2012-rsp mapping dry-run (no HTTP)",
    `pilotEntries: ${result.pilotEntries}`,
    `manifest-resolved: ${result.manifestResolved}`,
    `gridRowsParsed: ${result.gridRowsParsed}`,
    `gridQuarantinedBlocks: ${result.gridQuarantinedBlocks}`,
    `unresolved: ${result.unresolvedApplicationIds.length}`,
    "",
  ];
  for (const row of result.resolved) {
    lines.push(
      `${row.applicationId}\tgtldresultAcId=${row.gtldresultAcId ?? "null"}\tsource=${row.source}`,
    );
  }
  if (result.unresolvedApplicationIds.length > 0) {
    lines.push("", "mapping required for:", result.unresolvedApplicationIds.join(", "));
  }
  return lines.join("\n");
}
