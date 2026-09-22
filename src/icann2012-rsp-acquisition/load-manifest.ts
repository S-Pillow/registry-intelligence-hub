import { readFile } from "node:fs/promises";
import type { Registry2012RspMappingArtifact, RspPilotManifest } from "./types";
import { pilotManifestPath, pilotMappingPath } from "./bundle-paths";

export async function loadPilotManifest(workspaceRoot: string): Promise<RspPilotManifest> {
  const text = await readFile(pilotManifestPath(workspaceRoot), "utf8");
  const manifest = JSON.parse(text) as RspPilotManifest;
  if (manifest.manifestVersion !== "icann2012-rsp-pilot-manifest/1.0.0") {
    throw new Error(`Unexpected pilot manifest version: ${manifest.manifestVersion}`);
  }
  return manifest;
}

function assertRegistryMappingArtifact(doc: Registry2012RspMappingArtifact): Registry2012RspMappingArtifact {
  if (doc.mappingVersion !== "registry-2012-rsp-mapping/1.0.0") {
    throw new Error(`Unexpected mapping version: ${doc.mappingVersion}`);
  }
  if (doc.artifactPurpose !== "TEST_ONLY" && doc.artifactPurpose !== "EVIDENCE") {
    throw new Error(`Invalid artifactPurpose: ${doc.artifactPurpose}`);
  }
  if (doc.approvalState !== "DRAFT" && doc.approvalState !== "APPROVED") {
    throw new Error(`Invalid approvalState: ${doc.approvalState}`);
  }
  return doc;
}

export async function loadRspMappingArtifact(path: string): Promise<Registry2012RspMappingArtifact> {
  const text = await readFile(path, "utf8");
  const doc = JSON.parse(text) as { mappingVersion?: string };
  if (doc.mappingVersion === "registry-2012-rsp-mapping/1.0.0") {
    return assertRegistryMappingArtifact(doc as Registry2012RspMappingArtifact);
  }
  if (doc.mappingVersion === "icann2012-rsp-pilot-gtldresult-mapping/1.0.0") {
    throw new Error(
      "Legacy icann2012-rsp-pilot-gtldresult-mapping/1.0.0 is not supported — migrate to registry-2012-rsp-mapping/1.0.0",
    );
  }
  throw new Error(`Unexpected mapping version: ${(doc as { mappingVersion?: string }).mappingVersion}`);
}

export async function loadPilotMapping(workspaceRoot: string): Promise<Registry2012RspMappingArtifact> {
  return loadRspMappingArtifact(pilotMappingPath(workspaceRoot));
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
  mapping: Registry2012RspMappingArtifact,
): Map<string, number | null> {
  return new Map(mapping.entries.map((e) => [e.applicationId, e.gtldresultAcId]));
}
