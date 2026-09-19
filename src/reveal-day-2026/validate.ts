import type {
  Registry2026ApplicationRow,
  Registry2026PublicationSnapshot,
  ValidationIssue,
} from "./types";
import {
  ALLOWED_APPLICATION_KEYS,
  ALLOWED_PUBLICATION_TOP_LEVEL_KEYS,
  PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION,
} from "./types";

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

  if (record.schemaVersion !== PUBLICATION_SCHEMA_VERSION) {
    issues.push({
      code: "schema-version",
      severity: "error",
      message: `Expected schemaVersion ${PUBLICATION_SCHEMA_VERSION}, got ${String(record.schemaVersion)}`,
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
