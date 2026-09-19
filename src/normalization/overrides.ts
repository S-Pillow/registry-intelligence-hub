import type { NormalizedEntity, OverrideOperation, ReconciliationState } from "./types";

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in cur) || typeof cur[part] !== "object" || cur[part] === null) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function applyOverrides(entities: NormalizedEntity[], operations: OverrideOperation[]): NormalizedEntity[] {
  const byId = new Map(entities.map((e) => [e.entityId, { ...e } as NormalizedEntity]));

  for (const op of operations) {
    const entity = byId.get(op.entityId);
    if (!entity) continue;

    if (op.kind === "set-field") {
      const record = entity as unknown as Record<string, unknown>;
      setNested(record, op.fieldPath, op.value);
      entity.lineage = {
        ...entity.lineage,
        overrideOpIds: [...entity.lineage.overrideOpIds, op.opId],
      };
      if (!entity.reconciliationNotes.includes(`Override ${op.opId}: ${op.reason}`)) {
        entity.reconciliationNotes = [...entity.reconciliationNotes, `Override ${op.opId}: ${op.reason}`];
      }
    } else if (op.kind === "annotate-reconciliation") {
      entity.reconciliationState = op.reconciliationState;
      entity.reconciliationNotes = [...entity.reconciliationNotes, `Override ${op.opId}: ${op.note}`];
      entity.lineage = {
        ...entity.lineage,
        overrideOpIds: [...entity.lineage.overrideOpIds, op.opId],
      };
    }
    byId.set(op.entityId, entity);
  }

  return [...byId.values()].sort((a, b) => a.entityId.localeCompare(b.entityId));
}

export function validateOverrideRegistryVersion(registryVersion: string, expected: string): void {
  if (registryVersion !== expected) {
    throw new Error(`Override registry version mismatch: expected ${expected}, got ${registryVersion}`);
  }
}

export function reconciliationStatesForReport(entities: NormalizedEntity[]): Record<ReconciliationState, number> {
  const summary: Record<ReconciliationState, number> = {
    NORMALIZED: 0,
    MATCHED: 0,
    CONFLICT: 0,
    MISSING_REFERENCE: 0,
    AMBIGUOUS_ENTITY: 0,
    SOURCE_ONLY: 0,
    REQUIRES_REVIEW: 0,
  };
  for (const e of entities) summary[e.reconciliationState]++;
  return summary;
}
