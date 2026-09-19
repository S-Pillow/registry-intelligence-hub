import type { NormalizationArtifacts, NormalizedEntity, ParsedRecord } from "./types";

export interface TraceResult {
  entity: NormalizedEntity | null;
  parsedRecords: ParsedRecord[];
  observationIds: string[];
  overrideOpIds: string[];
  chain: string[];
}

export function traceEntity(artifacts: NormalizationArtifacts, entityKind: string, entityId: string): TraceResult {
  const fullId = entityId.includes(":") ? entityId : `${entityKind}:${entityId}`;
  const entity = artifacts.entities.find((e) => e.entityId === fullId) ?? null;
  if (!entity) {
    return { entity: null, parsedRecords: [], observationIds: [], overrideOpIds: [], chain: ["Entity not found in build"] };
  }

  const parsedRecords = artifacts.parsedRecords.filter((r) => r.contentHash === entity.lineage.parsedRecordHash || entity.lineage.observationIds.length > 0);
  const relatedParsed = artifacts.parsedRecords.filter((r) =>
    entity.lineage.observationIds.some((obsId) => {
      const obs = artifacts.observations.find((o) => o.observationId === obsId);
      return obs?.parsedRecordHash === r.contentHash;
    }),
  );

  const chain = [
    `raw:${entity.lineage.rawSnapshotSha256}`,
    `parsed:${entity.lineage.parsedRecordHash}`,
    ...entity.lineage.observationIds.map((id) => `observation:${id}`),
    ...entity.lineage.overrideOpIds.map((id) => `override:${id}`),
    `entity:${entity.entityId} (${entity.reconciliationState})`,
  ];

  return {
    entity,
    parsedRecords: [...new Map([...parsedRecords, ...relatedParsed].map((r) => [r.contentHash, r])).values()],
    observationIds: entity.lineage.observationIds,
    overrideOpIds: entity.lineage.overrideOpIds,
    chain,
  };
}
