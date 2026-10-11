import type {
  ApplicationChangeType,
  ChangeRecord,
  FieldChange,
  TrackedApplicationFields,
} from "@/change-intel/types";
import { TRACKED_APPLICATION_FIELD_KEYS } from "@/change-intel/tracked-fields";
import { makeChangeId } from "@/change-intel/hash";

function fieldChangesBetween(
  before: TrackedApplicationFields,
  after: TrackedApplicationFields,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of TRACKED_APPLICATION_FIELD_KEYS) {
    if (before[field] !== after[field]) {
      changes.push({ field, before: before[field], after: after[field] });
    }
  }
  return changes;
}

function baseRecord(input: {
  observationId: string;
  observedAt: string;
  changeType: ApplicationChangeType;
  applicationId: string;
  ordinal: number;
  appliedForString: string | null;
  applicantLegalName: string | null;
  fieldChanges: FieldChange[];
  before: Partial<TrackedApplicationFields> | null;
  after: Partial<TrackedApplicationFields> | null;
}): ChangeRecord {
  return {
    changeId: makeChangeId(input.observationId, input.changeType, input.applicationId, input.ordinal),
    observedAt: input.observedAt,
    sourceType: "application",
    changeType: input.changeType,
    applicationId: input.applicationId,
    appliedForString: input.appliedForString,
    applicantLegalName: input.applicantLegalName,
    fieldChanges: input.fieldChanges,
    contentionSetId: null,
    before: input.before,
    after: input.after,
    primaryImpact: "MARKET_CHANGE",
    impactReasons: [],
    applicantApplicationCount: null,
    applicantContentionCount: null,
    rspPublicPosture: null,
    exploreHref: input.applicationId
      ? `/explore?q=${encodeURIComponent(input.applicationId)}`
      : null,
    competitiveLandscapeHref: "/competitive-landscape",
  };
}

/** Diff tracked Application maps by stable applicationId. */
export function diffApplications(input: {
  observationId: string;
  observedAt: string;
  previous: TrackedApplicationFields[];
  current: TrackedApplicationFields[];
}): ChangeRecord[] {
  const prev = new Map(input.previous.map((a) => [a.applicationId, a]));
  const curr = new Map(input.current.map((a) => [a.applicationId, a]));
  const ids = [...new Set([...prev.keys(), ...curr.keys()])].sort((a, b) => a.localeCompare(b));
  const out: ChangeRecord[] = [];
  let ordinal = 0;

  for (const id of ids) {
    const before = prev.get(id);
    const after = curr.get(id);
    if (!before && after) {
      ordinal += 1;
      out.push(
        baseRecord({
          observationId: input.observationId,
          observedAt: input.observedAt,
          changeType: "APPLICATION_NOW_PRESENT",
          applicationId: id,
          ordinal,
          appliedForString: after.appliedForString,
          applicantLegalName: after.applicantLegalName,
          fieldChanges: [],
          before: null,
          after,
        }),
      );
      continue;
    }
    if (before && !after) {
      ordinal += 1;
      out.push(
        baseRecord({
          observationId: input.observationId,
          observedAt: input.observedAt,
          changeType: "APPLICATION_NO_LONGER_PRESENT",
          applicationId: id,
          ordinal,
          appliedForString: before.appliedForString,
          applicantLegalName: before.applicantLegalName,
          fieldChanges: [],
          before,
          after: null,
        }),
      );
      continue;
    }
    if (before && after) {
      const fields = fieldChangesBetween(before, after);
      if (fields.length === 0) continue;
      ordinal += 1;
      out.push(
        baseRecord({
          observationId: input.observationId,
          observedAt: input.observedAt,
          changeType: "APPLICATION_FIELD_CHANGED",
          applicationId: id,
          ordinal,
          appliedForString: after.appliedForString,
          applicantLegalName: after.applicantLegalName,
          fieldChanges: fields,
          before,
          after,
        }),
      );
    }
  }
  return out;
}
