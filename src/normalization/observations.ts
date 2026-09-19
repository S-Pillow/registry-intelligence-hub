import type { FieldValue, Observation, ParsedRecord } from "./types";

function field<T>(value: T | null, semantics: FieldValue<T>["semantics"], record: ParsedRecord, fieldPath: string): FieldValue<T> {
  return {
    value,
    semantics,
    provenance: [
      {
        parsedRecordHash: record.contentHash,
        fieldPath,
        observedAt: record.parsedAt,
        effectiveAt: record.rawSnapshotRef.effectiveAt,
      },
    ],
  };
}

export function observationsFromParsedRecords(records: ParsedRecord[]): Observation[] {
  const observations: Observation[] = [];

  for (const record of records) {
    if (record.recordType === "application-row" || record.recordType === "reveal-day-application-row") {
      const p = record.payload;
      const applicationId = String(p.applicationId);
      const isRevealDay = record.recordType === "reveal-day-application-row";
      observations.push({
        observationId: `obs:application:${applicationId}:${record.contentHash.slice(0, 8)}`,
        entityKind: "application",
        naturalKey: applicationId,
        parsedRecordHash: record.contentHash,
        parserVersion: record.parserVersion,
        facts: {
          applicationId: field(applicationId, "known", record, "applicationId"),
          priorityNumber: field(
            typeof p.priorityNumber === "number" ? p.priorityNumber : null,
            isRevealDay ? "unknown" : "known",
            record,
            "priorityNumber",
          ),
          stringUlabel: field(String(p.stringUlabel), "known", record, "stringUlabel"),
          stringAlabel: field(p.stringAlabel ? String(p.stringAlabel) : null, p.isIdn ? "known" : "not-applicable", record, "stringAlabel"),
          isIdn: field(Boolean(p.isIdn), "known", record, "isIdn"),
          applicantLegalName: field(String(p.applicantLegalName), "known", record, "applicantLegalName"),
          applicantJurisdiction: field(p.applicantJurisdiction ? String(p.applicantJurisdiction) : null, "known", record, "applicantJurisdiction"),
          contentionSetId: field(
            p.contentionSetId ? String(p.contentionSetId) : null,
            p.contentionSetId ? "known" : "not-applicable",
            record,
            "contentionSetId",
          ),
          organizationHint: field(
            p.organizationHint ? String(p.organizationHint) : null,
            p.organizationHint ? "unresolved" : isRevealDay ? "unavailable" : "unresolved",
            record,
            "organizationHint",
          ),
        },
      });
    }
  }

  return observations;
}
