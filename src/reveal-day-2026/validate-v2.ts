import {
  APS_APPLICATION_CSV_ARTIFACT_ROLE,
  APS_APPLICATION_CSV_NORMALIZER_VERSION,
  APS_APPLICATION_CSV_PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "./publication-v2-types";

export type ValidationV2Issue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
};

const FORBIDDEN_APPLICATION_KEYS = [
  "organization",
  "category",
  "returning",
  "confidence",
  "contentionSet",
  "string",
  "aLabel",
  "replacement",
  "idn",
] as const;

function assertNoForbiddenKeys(app: Registry2026ApplicationV2, path: string, issues: ValidationV2Issue[]): void {
  const record = app as unknown as Record<string, unknown>;
  for (const key of FORBIDDEN_APPLICATION_KEYS) {
    if (Object.hasOwn(record, key)) {
      issues.push({
        code: "forbidden-derived-field",
        severity: "error",
        message: `Application must not fabricate or carry legacy field "${key}"`,
        path: `${path}.${key}`,
      });
    }
  }
}

export function validatePublicationV2(raw: unknown): { snapshot?: Registry2026PublicationV2; issues: ValidationV2Issue[] } {
  const issues: ValidationV2Issue[] = [];
  if (raw === null || typeof raw !== "object") {
    issues.push({ code: "invalid-root", severity: "error", message: "Publication root must be an object" });
    return { issues };
  }
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    issues.push({
      code: "schema-version",
      severity: "error",
      message: `Expected ${PUBLICATION_SCHEMA_VERSION_V20}`,
    });
  }
  if (record.publicationKind !== "immutable-publication") {
    issues.push({ code: "publication-kind", severity: "error", message: "2.0.0 production builds must be immutable-publication" });
  }
  if (record.parserVersion !== APS_APPLICATION_CSV_PARSER_VERSION) {
    issues.push({ code: "parser-version", severity: "error", message: "Unexpected parserVersion" });
  }
  if (record.normalizerVersion !== APS_APPLICATION_CSV_NORMALIZER_VERSION) {
    issues.push({ code: "normalizer-version", severity: "error", message: "Unexpected normalizerVersion" });
  }
  if (typeof record.snapshotId !== "string" || !record.snapshotId.trim()) {
    issues.push({ code: "missing-snapshot-id", severity: "error", message: "snapshotId required" });
  }

  const lineage = record.lineage as Record<string, unknown> | undefined;
  if (!lineage || typeof lineage !== "object") {
    issues.push({ code: "missing-lineage", severity: "error", message: "lineage required" });
  } else if (lineage.artifactRole !== APS_APPLICATION_CSV_ARTIFACT_ROLE) {
    issues.push({ code: "artifact-role", severity: "error", message: "lineage.artifactRole must be APS Application export" });
  }

  const aggregates = record.officialAggregates as Record<string, unknown> | undefined;
  const coverage = record.coverage as Record<string, unknown> | undefined;
  if (!aggregates || typeof aggregates.officialApplicationCount !== "number") {
    issues.push({ code: "missing-official-aggregates", severity: "error", message: "officialAggregates required" });
  }
  if (!coverage || typeof coverage.normalizedApplicationRecordsObserved !== "number") {
    issues.push({ code: "missing-coverage", severity: "error", message: "coverage required" });
  }

  const apps = record.applications;
  if (!Array.isArray(apps)) {
    issues.push({ code: "missing-applications", severity: "error", message: "applications must be an array" });
    return { issues };
  }

  const ids = new Set<string>();
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i] as Registry2026ApplicationV2;
    const path = `applications[${i}]`;
    if (!app || typeof app !== "object") {
      issues.push({ code: "invalid-application", severity: "error", message: "invalid application object", path });
      continue;
    }
    assertNoForbiddenKeys(app, path, issues);
    if (typeof app.applicationId !== "string" || !app.applicationId.trim()) {
      issues.push({ code: "missing-application-id", severity: "error", message: "applicationId required", path });
    } else if (app.applicationId.endsWith("-R")) {
      issues.push({
        code: "replacement-as-application",
        severity: "error",
        message: "Replacement source rows must not become Applications",
        path,
      });
    } else if (ids.has(app.applicationId)) {
      issues.push({ code: "duplicate-application-id", severity: "error", message: `duplicate ${app.applicationId}`, path });
    } else {
      ids.add(app.applicationId);
    }
    if (typeof app.applicant !== "string" || !app.applicant.trim()) {
      issues.push({ code: "missing-applicant", severity: "error", message: "applicant required", path });
    }
    if (!app.appliedString?.sourceRowId || !app.appliedString.label) {
      issues.push({ code: "missing-applied-string", severity: "error", message: "appliedString required", path });
    }
    if (app.replacementString) {
      if (!app.replacementString.sourceRowId.endsWith("-R")) {
        issues.push({
          code: "replacement-id",
          severity: "error",
          message: "replacementString.sourceRowId must end with -R",
          path: `${path}.replacementString`,
        });
      }
      if (app.replacementString.sourceRowId.slice(0, -2) !== app.applicationId) {
        issues.push({
          code: "replacement-base-mismatch",
          severity: "error",
          message: "replacementString must link to applicationId via -R suffix",
          path: `${path}.replacementString`,
        });
      }
    }
  }

  if (
    coverage
    && typeof coverage.normalizedApplicationRecordsObserved === "number"
    && coverage.normalizedApplicationRecordsObserved !== apps.length
  ) {
    issues.push({
      code: "coverage-count-mismatch",
      severity: "error",
      message: "coverage.normalizedApplicationRecordsObserved must equal applications.length",
    });
  }

  if (
    aggregates
    && coverage
    && typeof aggregates.officialApplicationCount === "number"
    && typeof coverage.normalizedApplicationRecordsObserved === "number"
    && aggregates.officialApplicationCount === coverage.normalizedApplicationRecordsObserved
    && Array.isArray((coverage.applicationRecordCoverage as { knownExcludedRecords?: unknown[] } | undefined)?.knownExcludedRecords)
    && ((coverage.applicationRecordCoverage as { knownExcludedRecords: unknown[] }).knownExcludedRecords.length > 0)
  ) {
    issues.push({
      code: "official-collapsed-into-observed",
      severity: "error",
      message: "officialApplicationCount must remain distinct from observed coverage while exclusions exist",
    });
  }

  if (issues.some((i) => i.severity === "error")) return { issues };
  return { snapshot: record as Registry2026PublicationV2, issues };
}

export function validationV2Failed(issues: ValidationV2Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
