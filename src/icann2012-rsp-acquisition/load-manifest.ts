import { readFile } from "node:fs/promises";
import type {
  GtldresultPilotMappingFile,
  RspPilotManifest,
} from "./types";
import { pilotManifestPath, pilotMappingPath } from "./bundle-paths";

export async function loadPilotManifest(workspaceRoot: string): Promise<RspPilotManifest> {
  const text = await readFile(pilotManifestPath(workspaceRoot), "utf8");
  const manifest = JSON.parse(text) as RspPilotManifest;
  if (manifest.manifestVersion !== "icann2012-rsp-pilot-manifest/1.0.0") {
    throw new Error(`Unexpected pilot manifest version: ${manifest.manifestVersion}`);
  }
  return manifest;
}

export async function loadPilotMapping(workspaceRoot: string): Promise<GtldresultPilotMappingFile> {
  const text = await readFile(pilotMappingPath(workspaceRoot), "utf8");
  const mapping = JSON.parse(text) as GtldresultPilotMappingFile;
  if (mapping.mappingVersion !== "icann2012-rsp-pilot-gtldresult-mapping/1.0.0") {
    throw new Error(`Unexpected pilot mapping version: ${mapping.mappingVersion}`);
  }
  return mapping;
}

export function resolveGtldresultAcId(
  applicationId: string,
  manifestEntry: { gtldresultAcId?: number | null },
  mappingByApp: Map<string, number | null>,
): number | null {
  if (manifestEntry.gtldresultAcId != null) return manifestEntry.gtldresultAcId;
  if (mappingByApp.has(applicationId)) return mappingByApp.get(applicationId) ?? null;
  return null;
}

export function buildMappingByApplicationId(
  mapping: GtldresultPilotMappingFile,
): Map<string, number | null> {
  return new Map(mapping.entries.map((e) => [e.applicationId, e.gtldresultAcId]));
}
