import { TRACKED_APPLICATION_FIELD_KEYS } from "@/change-intel/tracked-fields";
import type {
  ChangeMateriality,
  ChangeRecord,
  ChangeType,
  FieldChange,
  PrimaryImpact,
} from "@/change-intel/types";

const MATERIAL_FIELD_KEYS = new Set<FieldChange["field"]>([
  "applicantLegalName",
  "appliedForString",
  "applicationStatus",
  "brand",
  "community",
  "idn",
  "geoSelfDesignated",
]);

const CONTEXTUAL_ONLY_FIELD_KEYS = new Set<FieldChange["field"]>([
  "processingStage",
  "applicationType",
  "country",
  "region",
]);

const KNOWN_CHANGE_TYPES = new Set<ChangeType>([
  "APPLICATION_NOW_PRESENT",
  "APPLICATION_NO_LONGER_PRESENT",
  "APPLICATION_FIELD_CHANGED",
  "CONTENTION_MEMBERSHIP_ADDED",
  "CONTENTION_MEMBERSHIP_REMOVED",
]);

const KNOWN_TRACKED_FIELDS = new Set<string>(TRACKED_APPLICATION_FIELD_KEYS);

export type MaterialityClassification =
  | { materiality: ChangeMateriality; defined: true }
  | { materiality: "MATERIAL"; defined: false; reason: "unsupported-change-type" | "unsupported-field" };

function fieldKeys(changes: FieldChange[]): FieldChange["field"][] {
  return changes.map((c) => c.field);
}

/**
 * Deterministic MATERIAL / CONTEXTUAL classification.
 * Fail closed: unknown change types or tracked fields classify as MATERIAL
 * with defined=false so callers/tests can assert unsupported handling.
 */
export function classifyChangeMateriality(change: ChangeRecord): MaterialityClassification {
  if (!KNOWN_CHANGE_TYPES.has(change.changeType)) {
    return { materiality: "MATERIAL", defined: false, reason: "unsupported-change-type" };
  }

  if (
    change.changeType === "APPLICATION_NOW_PRESENT"
    || change.changeType === "APPLICATION_NO_LONGER_PRESENT"
    || change.changeType === "CONTENTION_MEMBERSHIP_ADDED"
    || change.changeType === "CONTENTION_MEMBERSHIP_REMOVED"
  ) {
    return { materiality: "MATERIAL", defined: true };
  }

  // APPLICATION_FIELD_CHANGED
  for (const fc of change.fieldChanges) {
    if (!KNOWN_TRACKED_FIELDS.has(fc.field)) {
      return { materiality: "MATERIAL", defined: false, reason: "unsupported-field" };
    }
  }

  const impact: PrimaryImpact = change.primaryImpact;
  if (impact === "GODADDY_DIRECT" || impact === "GODADDY_CONTENTION") {
    return { materiality: "MATERIAL", defined: true };
  }

  const keys = fieldKeys(change.fieldChanges);
  if (keys.some((k) => MATERIAL_FIELD_KEYS.has(k))) {
    return { materiality: "MATERIAL", defined: true };
  }

  if (keys.length > 0 && keys.every((k) => CONTEXTUAL_ONLY_FIELD_KEYS.has(k))) {
    return { materiality: "CONTEXTUAL", defined: true };
  }

  // Empty field list on FIELD_CHANGED or unclassified mix — fail closed as MATERIAL.
  return { materiality: "MATERIAL", defined: true };
}

export function changeMateriality(change: ChangeRecord): ChangeMateriality {
  return classifyChangeMateriality(change).materiality;
}
