import type {
  Registry2026ApplicationRow,
  Registry2026PublicationSnapshot,
  ValidationIssue,
} from "./types";
import {
  ALLOWED_APPLICATION_KEYS,
  ALLOWED_LINEAGE_KEYS,
  ALLOWED_PUBLICATION_TOP_LEVEL_KEYS,
  INTAKE_ADAPTER_VERSION,
  PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_SCHEMA_VERSION_V11,
  SUPPORTED_PUBLICATION_SCHEMA_VERSIONS,
} from "./types";
import type { PublicationLineage } from "./types";

/** Conservative bounds — real Reveal Day expected well above rehearsal; catches empty/truncated dumps. */
export const ROW_COUNT_BOUNDS = {
  minApplications: 100,
  maxApplications: 50_000,
} as const;

const REHEARSAL_FIXTURE_ID_PREFIX = "rehearsal-";
const REHEARSAL_SNAPSHOT_PREFIX = "snap-rehearsal-";

export function isRehearsalPublication(snapshot: Registry2026PublicationSnapshot): boolean {
  if (snapshot.publicationKind === "rehearsal-for-pipeline-only") return true;
  if (snapshot.fixtureId?.startsWith(REHEARSAL_FIXTURE_ID_PREFIX)) return true;
  if (snapshot.snapshotId.startsWith(REHEARSAL_SNAPSHOT_PREFIX)) return true;
  return false;
}

function isValidUlabel(label: string): boolean {
  if (!label.length || label.length > 63) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

function isValidIdnALabel(aLabel: string): boolean {
  if (!aLabel.startsWith("xn--")) return false;
  return aLabel.length >= 5 && aLabel.length <= 63;
}

export function validatePublicationSnapshot(
  raw: unknown,
  options: { enforceProductionRowBounds: boolean },
): { snapshot?: Registry2026PublicationSnapshot; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (raw === null || typeof raw !== "object") {
    issues.push({ code: "invalid-root", severity: "error", message: "Publication root must be an object" });
    return { issues };
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(ALLOWED_PUBLICATION_TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      issues.push({
        code: "unexpected-field",
        severity: "error",
        message: `Unexpected top-level field: ${key}`,
        path: key,
      });
    }
  }

  const schemaVersion = record.schemaVersion;
  if (!(SUPPORTED_PUBLICATION_SCHEMA_VERSIONS as readonly string[]).includes(String(schemaVersion))) {
    issues.push({
      code: "schema-version",
      severity: "error",
      message: `Unsupported schemaVersion ${String(schemaVersion)} — bump publication schema instead of relaxing validation`,
    });
  }

  if (record.parserVersion !== PARSER_VERSION) {
    issues.push({
      code: "parser-version",
      severity: "error",
      message: `Expected parserVersion ${PARSER_VERSION}, got ${String(record.parserVersion)}`,
    });
  }

  const publicationKind = record.publicationKind;
  if (publicationKind !== "immutable-publication" && publicationKind !== "rehearsal-for-pipeline-only") {
    issues.push({
      code: "publication-kind",
      severity: "error",
      message: `Invalid publicationKind: ${String(publicationKind)}`,
    });
  }

  if (typeof record.snapshotId !== "string" || !record.snapshotId.trim()) {
    issues.push({ code: "missing-snapshot-id", severity: "error", message: "snapshotId is required" });
  }

  const publicationKindForLineage = record.publicationKind;
  if (
    publicationKindForLineage === "immutable-publication"
    && schemaVersion === PUBLICATION_SCHEMA_VERSION_V11
  ) {
    validateLineage(record.lineage, issues);
  } else if (
    publicationKindForLineage === "immutable-publication"
    && schemaVersion === PUBLICATION_SCHEMA_VERSION
    && !record.lineage
  ) {
    issues.push({
      code: "missing-lineage",
      severity: "error",
      message:
        "immutable-publication requires registry-2026-publication/1.1.0 with explicit raw lineage — manual JSON promotion path is forbidden",
    });
  }

  if (!Array.isArray(record.applications)) {
    issues.push({ code: "missing-applications", severity: "error", message: "applications must be an array" });
    return { issues };
  }

  const apps = record.applications as unknown[];
  if (options.enforceProductionRowBounds) {
    if (apps.length < ROW_COUNT_BOUNDS.minApplications) {
      issues.push({
        code: "row-count-low",
        severity: "error",
        message: `Application count ${apps.length} below minimum ${ROW_COUNT_BOUNDS.minApplications} for immutable publication`,
      });
    }
    if (apps.length > ROW_COUNT_BOUNDS.maxApplications) {
      issues.push({
        code: "row-count-high",
        severity: "error",
        message: `Application count ${apps.length} exceeds maximum ${ROW_COUNT_BOUNDS.maxApplications}`,
      });
    }
  }

  const seenIds = new Set<string>();
  const parsedApps: Registry2026ApplicationRow[] = [];

  for (let i = 0; i < apps.length; i++) {
    const row = apps[i];
    const path = `applications[${i}]`;
    if (row === null || typeof row !== "object") {
      issues.push({ code: "invalid-row", severity: "error", message: "Application row must be an object", path });
      continue;
    }
    const rowRecord = row as Record<string, unknown>;
    for (const key of Object.keys(rowRecord)) {
      if (!(ALLOWED_APPLICATION_KEYS as readonly string[]).includes(key)) {
        issues.push({
          code: "unexpected-application-field",
          severity: "error",
          message: `Unexpected field on application row: ${key}`,
          path: `${path}.${key}`,
        });
      }
    }

    const id = rowRecord.id;
    if (typeof id !== "string" || !/^APP-\d+$/.test(id)) {
      issues.push({
        code: "malformed-application-id",
        severity: "error",
        message: `Malformed application id: ${String(id)}`,
        path: `${path}.id`,
      });
    } else if (seenIds.has(id)) {
      issues.push({
        code: "duplicate-application-id",
        severity: "error",
        message: `Duplicate application id: ${id}`,
        path: `${path}.id`,
      });
    } else {
      seenIds.add(id);
    }

    const idn = rowRecord.idn === true;
    const stringLabel = rowRecord.string;
    if (typeof stringLabel !== "string" || !stringLabel.trim()) {
      issues.push({
        code: "malformed-string",
        severity: "error",
        message: `Missing string label: ${String(stringLabel)}`,
        path: `${path}.string`,
      });
    } else if (!idn && !isValidUlabel(stringLabel)) {
      issues.push({
        code: "malformed-string",
        severity: "error",
        message: `Malformed ASCII string ulabel: ${String(stringLabel)}`,
        path: `${path}.string`,
      });
    }

    if (idn) {
      const aLabel = rowRecord.aLabel;
      if (typeof aLabel !== "string" || !isValidIdnALabel(aLabel)) {
        issues.push({
          code: "malformed-idn",
          severity: "error",
          message: `IDN row requires valid aLabel (xn--…): ${String(aLabel)}`,
          path: `${path}.aLabel`,
        });
      }
    }

    if (typeof rowRecord.applicant !== "string" || !rowRecord.applicant.trim()) {
      issues.push({ code: "missing-applicant", severity: "error", message: "applicant is required", path: `${path}.applicant` });
    }

    parsedApps.push(row as Registry2026ApplicationRow);
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) return { issues };

  const snapshot = record as Registry2026PublicationSnapshot;
  return { snapshot, issues };
}

export function validationFailed(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

function validateLineage(raw: unknown, issues: ValidationIssue[]): void {
  if (raw === null || typeof raw !== "object") {
    issues.push({ code: "missing-lineage", severity: "error", message: "lineage object is required for immutable publication 1.1.0" });
    return;
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(ALLOWED_LINEAGE_KEYS as readonly string[]).includes(key)) {
      issues.push({
        code: "unexpected-lineage-field",
        severity: "error",
        message: `Unexpected lineage field: ${key}`,
        path: `lineage.${key}`,
      });
    }
  }
  const lineage = record as PublicationLineage;
  if (lineage.intakeAdapterVersion !== INTAKE_ADAPTER_VERSION) {
    issues.push({
      code: "intake-adapter-version",
      severity: "error",
      message: `Expected intakeAdapterVersion ${INTAKE_ADAPTER_VERSION}`,
    });
  }
  if (typeof lineage.rawSha256 !== "string" || lineage.rawSha256.length < 32) {
    issues.push({ code: "lineage-raw-sha", severity: "error", message: "lineage.rawSha256 must be the immutable pipeline blob hash" });
  }
  if (typeof lineage.manifestAttemptId !== "string" || !lineage.manifestAttemptId.trim()) {
    issues.push({ code: "lineage-attempt", severity: "error", message: "lineage.manifestAttemptId is required" });
  }
  if (typeof lineage.fetchUrl !== "string" || !lineage.fetchUrl.trim()) {
    issues.push({ code: "lineage-url", severity: "error", message: "lineage.fetchUrl is required" });
  }
  if (!Array.isArray(lineage.redirectChain)) {
    issues.push({ code: "lineage-redirects", severity: "error", message: "lineage.redirectChain must be an array (empty if none)" });
  }
}
