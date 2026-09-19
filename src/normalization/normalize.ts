import type { LoadedFixtureBundle } from "./load-bundle";
import { applyOrganizationPromotions } from "./organization-promotion";
import { applyOverrides } from "./overrides";
import type {
  ApplicationEntity,
  AppliedStringEntity,
  ApplicantEntity,
  ContentionSetEntity,
  EntityKind,
  FieldValue,
  NormalizedEntity,
  Observation,
  OrganizationEntity,
  ParsedRecord,
  RegistryOperatorEntity,
  RoundEntity,
  TldEntity,
} from "./types";
import { NORMALIZER_VERSION } from "./types";

const NORMALIZED_AT = "2012-06-13T12:00:00.000Z";

function emptyLineage(record: ParsedRecord, observationIds: string[], overrideOpIds: string[] = []) {
  return {
    rawSnapshotSha256: record.rawSnapshotRef.sha256,
    parsedRecordHash: record.contentHash,
    observationIds,
    overrideOpIds,
  };
}

function mergeFieldValues<T>(values: FieldValue<T>[]): { merged: FieldValue<T>; conflict: boolean } {
  if (values.length === 0) {
    return { merged: { value: null, semantics: "unknown", provenance: [] }, conflict: false };
  }
  const known = values.filter((v) => v.semantics === "known");
  if (known.length === 0) return { merged: values[0], conflict: false };
  const first = known[0];
  const conflict = known.some((v) => JSON.stringify(v.value) !== JSON.stringify(first.value));
  if (conflict) {
    return {
      merged: {
        value: first.value,
        semantics: "unresolved",
        provenance: known.flatMap((v) => v.provenance),
      },
      conflict: true,
    };
  }
  return {
    merged: {
      value: first.value,
      semantics: "known",
      provenance: known.flatMap((v) => v.provenance),
    },
    conflict: false,
  };
}

function appliedStringIdFor(ulabel: string, alabel: string | null): string {
  return alabel ? `applied-string:${alabel}` : `applied-string:${ulabel.toLowerCase()}`;
}

function applicantIdFor(applicationId: string): string {
  return `applicant:${applicationId}`;
}

export function normalizeFromObservations(
  loaded: LoadedFixtureBundle,
  parsedRecords: ParsedRecord[],
  observations: Observation[],
): NormalizedEntity[] {
  const roundId = `round:gtld-${loaded.definition.roundProgramYear}`;
  const primaryRecord = parsedRecords[0];

  const round: RoundEntity = {
    entityKind: "round",
    entityId: roundId,
    label: `New gTLD Program ${loaded.definition.roundProgramYear}`,
    programYear: loaded.definition.roundProgramYear,
    reconciliationState: "NORMALIZED",
    reconciliationNotes: [loaded.definition.coverageNote],
    lineage: emptyLineage(primaryRecord, []),
    normalizerVersion: NORMALIZER_VERSION,
    normalizedAt: NORMALIZED_AT,
  };

  const appObsByKey = new Map<string, Observation[]>();
  for (const obs of observations.filter((o) => o.entityKind === "application")) {
    const list = appObsByKey.get(obs.naturalKey) ?? [];
    list.push(obs);
    appObsByKey.set(obs.naturalKey, list);
  }

  const knownContentionIds = new Set(
    parsedRecords
      .filter((r) => r.recordType === "contention-set")
      .map((r) => String(r.payload.setId)),
  );

  const entities: NormalizedEntity[] = [round];
  const strings = new Map<string, AppliedStringEntity>();
  const applicants = new Map<string, ApplicantEntity>();
  const organizations = new Map<string, OrganizationEntity>();
  const tlds = new Map<string, TldEntity>();

  for (const [applicationId, obsList] of appObsByKey) {
    const merge = (field: string) => mergeFieldValues(obsList.map((o) => o.facts[field] as FieldValue<unknown>));
    const appIdField = merge("applicationId") as { merged: FieldValue<string>; conflict: boolean };
    const legalName = merge("applicantLegalName") as { merged: FieldValue<string>; conflict: boolean };
    const jurisdiction = merge("applicantJurisdiction") as { merged: FieldValue<string | null>; conflict: boolean };
    const ulabel = merge("stringUlabel") as { merged: FieldValue<string>; conflict: boolean };
    const alabel = merge("stringAlabel") as { merged: FieldValue<string | null>; conflict: boolean };
    const isIdn = merge("isIdn") as { merged: FieldValue<boolean>; conflict: boolean };
    const contentionFromObs = merge("contentionSetId") as { merged: FieldValue<string | null>; conflict: boolean };
    const officialContentionSetId = loaded.contentionMembershipByApplicationId.get(applicationId) ?? null;
    const contentionSetId: { merged: FieldValue<string | null>; conflict: boolean } = officialContentionSetId
      ? {
          merged: {
            value: officialContentionSetId,
            semantics: "known",
            provenance: contentionFromObs.merged.provenance,
          },
          conflict: false,
        }
      : contentionFromObs;
    const priority = merge("priorityNumber") as { merged: FieldValue<number | null>; conflict: boolean };
    const orgHint = merge("organizationHint") as { merged: FieldValue<string | null>; conflict: boolean };

    const obsIds = obsList.map((o) => o.observationId);
    const record = parsedRecords.find((r) => r.contentHash === obsList[0].parsedRecordHash) ?? primaryRecord;

    let reconciliationState = "NORMALIZED" as ApplicationEntity["reconciliationState"];
    const notes: string[] = [];
    if (legalName.conflict) {
      reconciliationState = "CONFLICT";
      notes.push("Conflicting applicant legal names across sources");
    }
    const sourceFiles = new Set(
      obsList.map((o) => parsedRecords.find((r) => r.contentHash === o.parsedRecordHash)?.locator.sourceFile),
    );
    if (obsList.length === 1 && sourceFiles.has("secondary-applications.jsonl")) {
      reconciliationState = "SOURCE_ONLY";
      notes.push("Only present in secondary source fixture");
    }
    if (contentionSetId.merged.value && !knownContentionIds.has(contentionSetId.merged.value)) {
      reconciliationState = "MISSING_REFERENCE";
      notes.push(`Contention set ${contentionSetId.merged.value} not found in bundle`);
    }
    if (orgHint.merged.semantics === "unresolved" && orgHint.merged.value) {
      notes.push("Organization hint requires steward resolution — candidates emitted only");
    }

    const stringId = appliedStringIdFor(String(ulabel.merged.value), alabel.merged.value);
    if (!strings.has(stringId)) {
      strings.set(stringId, {
        entityKind: "applied-string",
        entityId: stringId,
        uLabel: ulabel.merged as FieldValue<string>,
        aLabel: alabel.merged as FieldValue<string | null>,
        isIdn: isIdn.merged as FieldValue<boolean>,
        reconciliationState: ulabel.conflict || alabel.conflict ? "CONFLICT" : "NORMALIZED",
        reconciliationNotes: [],
        lineage: emptyLineage(record, obsIds),
        normalizerVersion: NORMALIZER_VERSION,
        normalizedAt: NORMALIZED_AT,
      });
    }

    const tldId = `tld:${String(ulabel.merged.value).toLowerCase()}`;
    if (!tlds.has(tldId)) {
      tlds.set(tldId, {
        entityKind: "tld",
        entityId: tldId,
        label: ulabel.merged as FieldValue<string>,
        reconciliationState: "MATCHED",
        reconciliationNotes: ["TLD label derived from applied string U-label"],
        lineage: emptyLineage(record, obsIds),
        normalizerVersion: NORMALIZER_VERSION,
        normalizedAt: NORMALIZED_AT,
      });
    }

    const applicantEntityId = applicantIdFor(applicationId);
    if (!applicants.has(applicantEntityId)) {
      applicants.set(applicantEntityId, {
        entityKind: "applicant",
        entityId: applicantEntityId,
        legalName: legalName.merged as FieldValue<string>,
        jurisdiction: jurisdiction.merged as FieldValue<string | null>,
        reconciliationState: legalName.conflict ? "CONFLICT" : "NORMALIZED",
        reconciliationNotes: legalName.conflict ? ["Legal name conflict across observations"] : [],
        lineage: emptyLineage(record, obsIds),
        normalizerVersion: NORMALIZER_VERSION,
        normalizedAt: NORMALIZED_AT,
      });
    }

    if (orgHint.merged.value && orgHint.merged.semantics !== "unavailable") {
      const orgId = `organization:candidate-root:${applicationId}`;
      if (!organizations.has(orgId)) {
        const candidateHints = obsList
          .map((o) => o.facts.organizationHint)
          .filter((f): f is FieldValue<string> => Boolean(f && f.value));
        organizations.set(orgId, {
          entityKind: "organization",
          entityId: orgId,
          candidates: candidateHints.map((hint, idx) => ({
            candidateId: `${orgId}:c${idx + 1}`,
            displayName: String(hint.value),
            confidence: candidateHints.length > 1 ? "low" : "medium",
            rationale: "Conservative resolution — applicant organization hint only, no forced merge",
            sourceObservationIds: obsIds,
          })),
          reconciliationState: candidateHints.length > 1 ? "AMBIGUOUS_ENTITY" : "REQUIRES_REVIEW",
          reconciliationNotes: ["Organization entity stores candidates only"],
          lineage: emptyLineage(record, obsIds),
          normalizerVersion: NORMALIZER_VERSION,
          normalizedAt: NORMALIZED_AT,
        });
      }
    }

    const application: ApplicationEntity = {
      entityKind: "application",
      entityId: `application:${applicationId}`,
      applicationId: appIdField.merged as FieldValue<string>,
      roundId,
      appliedStringId: { ...ulabel.merged, value: stringId, semantics: "known" } as FieldValue<string>,
      applicantId: { value: applicantEntityId, semantics: "known", provenance: legalName.merged.provenance },
      contentionSetId: contentionSetId.merged as FieldValue<string | null>,
      priorityNumber: priority.merged as FieldValue<number | null>,
      reconciliationState,
      reconciliationNotes: notes,
      lineage: emptyLineage(record, obsIds),
      normalizerVersion: NORMALIZER_VERSION,
      normalizedAt: NORMALIZED_AT,
    };
    entities.push(application);
  }

  for (const entity of strings.values()) entities.push(entity);
  for (const entity of applicants.values()) entities.push(entity);
  for (const entity of organizations.values()) entities.push(entity);
  for (const entity of tlds.values()) entities.push(entity);

  for (const record of parsedRecords.filter((r) => r.recordType === "contention-set")) {
    const setId = String(record.payload.setId);
    const applicationIds = (record.payload.applicationIds as string[]) ?? [];
    const cs: ContentionSetEntity = {
      entityKind: "contention-set",
      entityId: `contention-set:${setId}`,
      setId: { value: setId, semantics: "known", provenance: [{ parsedRecordHash: record.contentHash, fieldPath: "setId", observedAt: record.parsedAt, effectiveAt: record.rawSnapshotRef.effectiveAt }] },
      applicationIds: {
        value: applicationIds,
        semantics: "known",
        provenance: [{ parsedRecordHash: record.contentHash, fieldPath: "applicationIds", observedAt: record.parsedAt, effectiveAt: record.rawSnapshotRef.effectiveAt }],
      },
      matchKind: {
        value: (record.payload.matchKind as "exact" | "similarity") ?? "unknown",
        semantics: "known",
        provenance: [{ parsedRecordHash: record.contentHash, fieldPath: "matchKind", observedAt: record.parsedAt, effectiveAt: record.rawSnapshotRef.effectiveAt }],
      },
      reconciliationState: "NORMALIZED",
      reconciliationNotes: [],
      lineage: emptyLineage(record, []),
      normalizerVersion: NORMALIZER_VERSION,
      normalizedAt: NORMALIZED_AT,
    };
    entities.push(cs);
  }

  for (const record of parsedRecords.filter((r) => r.recordType === "registry-operator")) {
    const opId = String(record.payload.operatorId);
    const tldLabels = (record.payload.tldLabels as string[]) ?? [];
    const ro: RegistryOperatorEntity = {
      entityKind: "registry-operator",
      entityId: `registry-operator:${opId}`,
      operatorName: {
        value: String(record.payload.operatorName),
        semantics: "known",
        provenance: [{ parsedRecordHash: record.contentHash, fieldPath: "operatorName", observedAt: record.parsedAt, effectiveAt: record.rawSnapshotRef.effectiveAt }],
      },
      relatedTldIds: {
        value: tldLabels.map((l) => `tld:${l.toLowerCase()}`),
        semantics: "known",
        provenance: [{ parsedRecordHash: record.contentHash, fieldPath: "tldLabels", observedAt: record.parsedAt, effectiveAt: record.rawSnapshotRef.effectiveAt }],
      },
      reconciliationState: "SOURCE_ONLY",
      reconciliationNotes: ["Post-delegation operator linkage not validated in this slice"],
      lineage: emptyLineage(record, []),
      normalizerVersion: NORMALIZER_VERSION,
      normalizedAt: NORMALIZED_AT,
    };
    entities.push(ro);
  }

  const withOverrides = applyOverrides(entities, loaded.overrides.operations);
  return applyOrganizationPromotions(withOverrides, loaded.organizationPromotions);
}

export function countByKind(entities: NormalizedEntity[]): Record<EntityKind, number> {
  const counts: Record<EntityKind, number> = {
    round: 0,
    application: 0,
    "applied-string": 0,
    tld: 0,
    applicant: 0,
    organization: 0,
    "registry-operator": 0,
    "contention-set": 0,
  };
  for (const e of entities) counts[e.entityKind]++;
  return counts;
}
