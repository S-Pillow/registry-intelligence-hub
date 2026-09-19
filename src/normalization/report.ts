import { reconciliationStatesForReport } from "./overrides";
import type {
  EntityKind,
  NormalizationQualityReport,
  NormalizedEntity,
  Observation,
  ReconciliationRow,
  ReconciliationState,
} from "./types";
import { NORMALIZER_VERSION, OVERRIDE_REGISTRY_VERSION, PARSER_VERSION } from "./types";
import { countByKind } from "./normalize";
import { buildIdFromInput, contentHash } from "./hashes";

export function buildQualityReport(
  bundleId: string,
  bundleVersion: number,
  inputContentHash: string,
  entities: NormalizedEntity[],
  observations: Observation[],
  limitations: string[],
): NormalizationQualityReport {
  const buildId = buildIdFromInput(inputContentHash, [PARSER_VERSION, NORMALIZER_VERSION, OVERRIDE_REGISTRY_VERSION]);
  const rows: ReconciliationRow[] = [];

  for (const entity of entities) {
    if (entity.reconciliationState !== "NORMALIZED" && entity.reconciliationState !== "MATCHED") {
      rows.push({
        entityKind: entity.entityKind,
        entityId: entity.entityId,
        reconciliationState: entity.reconciliationState,
        fieldPath: null,
        detail: entity.reconciliationNotes.join("; ") || entity.reconciliationState,
        sourceObservationCount: entity.lineage.observationIds.length,
      });
    }
    for (const note of entity.reconciliationNotes) {
      if (note.startsWith("Override")) {
        rows.push({
          entityKind: entity.entityKind,
          entityId: entity.entityId,
          reconciliationState: entity.reconciliationState,
          fieldPath: null,
          detail: note,
          sourceObservationCount: entity.lineage.observationIds.length,
        });
      }
    }
  }

  rows.sort((a, b) => a.entityId.localeCompare(b.entityId) || a.detail.localeCompare(b.detail));

  return {
    reportVersion: "1.0.0",
    generatedAt: "2012-06-13T12:00:00.000Z",
    bundleId,
    bundleVersion,
    parserVersion: PARSER_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    overrideRegistryVersion: OVERRIDE_REGISTRY_VERSION,
    inputContentHash,
    buildId,
    entityCounts: countByKind(entities),
    reconciliationSummary: reconciliationStatesForReport(entities),
    rows,
    limitations,
  };
}

export function assertDeterministicReport(a: NormalizationQualityReport, b: NormalizationQualityReport): void {
  const stripGenerated = (r: NormalizationQualityReport) => ({ ...r, generatedAt: "FIXED" });
  if (contentHash(stripGenerated(a)) !== contentHash(stripGenerated(b))) {
    throw new Error("Quality reports diverged across rebuilds");
  }
}

export function summarizeStates(summary: Record<ReconciliationState, number>): string {
  return Object.entries(summary)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
}

export function totalEntities(counts: Record<EntityKind, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}
