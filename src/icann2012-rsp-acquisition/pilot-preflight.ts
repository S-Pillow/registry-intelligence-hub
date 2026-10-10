import { PILOT_MANIFEST_EXPECTED_COUNT } from "./constants";
import { buildMappingByApplicationId, loadPilotManifest, resolveGtldresultAcId } from "./load-manifest";
import type { Registry2012RspMappingArtifact } from "./types";

export interface PilotPreflightCounts {
  pilotExpectedCount: number;
  pilotResolvedCount: number;
  pilotUnresolvedCount: number;
  pilotApplicationToAcId: Array<{ applicationId: string; gtldresultAcId: number | null }>;
}

export async function computePilotPreflightCounts(
  workspaceRoot: string,
  artifact: Registry2012RspMappingArtifact,
): Promise<PilotPreflightCounts> {
  const manifest = await loadPilotManifest(workspaceRoot);
  const mappingByApp = buildMappingByApplicationId(artifact);
  const pilotExpectedCount = manifest.entries.length;

  if (pilotExpectedCount !== PILOT_MANIFEST_EXPECTED_COUNT) {
    throw new Error(
      `Pilot manifest entry count ${pilotExpectedCount} !== expected ${PILOT_MANIFEST_EXPECTED_COUNT}`,
    );
  }

  const pilotApplicationToAcId = manifest.entries.map((entry) => ({
    applicationId: entry.applicationId,
    gtldresultAcId: resolveGtldresultAcId(entry.applicationId, entry, mappingByApp),
  }));

  const pilotResolvedCount = pilotApplicationToAcId.filter((r) => r.gtldresultAcId != null).length;
  const pilotUnresolvedCount = pilotExpectedCount - pilotResolvedCount;

  return {
    pilotExpectedCount,
    pilotResolvedCount,
    pilotUnresolvedCount,
    pilotApplicationToAcId,
  };
}
