import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rspFixtureRoot } from "./bundle-paths";
import { loadPilotManifest } from "./load-manifest";
import { mergeGridRowsIntoMapping, parseViewstatusGridHtml } from "./viewstatus-parser";

export interface MappingDryRunOptions {
  workspaceRoot: string;
  /** Optional path to committed grid HTML; defaults to bundle test fixture page 1. */
  gridHtmlPath?: string;
  /** Optional CSV with columns applicationId,gtldresultAcId for offline merges. */
  mappingCsvPath?: string;
}

export interface MappingDryRunResult {
  mode: "mapping-dry-run";
  gridRowsParsed: number;
  mappedFromGrid: number;
  pilotEntries: number;
  resolved: Array<{ applicationId: string; gtldresultAcId: number | null; source: string }>;
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

export async function runMappingDryRun(options: MappingDryRunOptions): Promise<MappingDryRunResult> {
  const manifest = await loadPilotManifest(options.workspaceRoot);
  const gridPath =
    options.gridHtmlPath ??
    join(rspFixtureRoot(options.workspaceRoot), "fixtures/viewstatus-page-1.fixture.html");
  const html = await readFile(gridPath, "utf8");
  const gridMap = mergeGridRowsIntoMapping(parseViewstatusGridHtml(html));

  let csvMap = new Map<string, number>();
  if (options.mappingCsvPath) {
    csvMap = await loadOptionalMappingCsv(options.mappingCsvPath);
  }

  const resolved: MappingDryRunResult["resolved"] = [];
  const unresolvedApplicationIds: string[] = [];

  for (const entry of manifest.entries) {
    let acId: number | null = entry.gtldresultAcId ?? null;
    let source = "manifest";
    if (acId == null && gridMap.has(entry.applicationId)) {
      acId = gridMap.get(entry.applicationId)!;
      source = "grid-html";
    } else if (acId == null && csvMap.has(entry.applicationId)) {
      acId = csvMap.get(entry.applicationId)!;
      source = "mapping-csv";
    }
    resolved.push({ applicationId: entry.applicationId, gtldresultAcId: acId, source });
    if (acId == null) unresolvedApplicationIds.push(entry.applicationId);
  }

  return {
    mode: "mapping-dry-run",
    gridRowsParsed: gridMap.size,
    mappedFromGrid: gridMap.size,
    pilotEntries: manifest.entries.length,
    resolved,
    unresolvedApplicationIds,
  };
}

export function formatMappingDryRun(result: MappingDryRunResult): string {
  const lines = [
    "icann2012-rsp mapping dry-run (no HTTP)",
    `pilotEntries: ${result.pilotEntries}`,
    `gridRowsParsed: ${result.gridRowsParsed}`,
    `unresolved: ${result.unresolvedApplicationIds.length}`,
    "",
  ];
  for (const row of result.resolved) {
    lines.push(`${row.applicationId}\tgtldresultAcId=${row.gtldresultAcId ?? "null"}\tsource=${row.source}`);
  }
  if (result.unresolvedApplicationIds.length > 0) {
    lines.push("", "mapping required for:", result.unresolvedApplicationIds.join(", "));
  }
  return lines.join("\n");
}
