import {
  APS_CONTENTION_CSV_ARTIFACT_ROLE,
  APS_CONTENTION_CSV_NORMALIZER_VERSION,
  APS_CONTENTION_CSV_PARSER_VERSION,
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  OFFICIAL_VS_EXACT_STRING_NOTE,
  type ContentionMembershipSnapshotV1,
} from "./contention-membership-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "./publication-v2-types";

export type ContentionValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
};

export function validateContentionMembershipSnapshot(
  raw: unknown,
): { snapshot?: ContentionMembershipSnapshotV1; issues: ContentionValidationIssue[] } {
  const issues: ContentionValidationIssue[] = [];
  if (raw === null || typeof raw !== "object") {
    issues.push({ code: "invalid-root", severity: "error", message: "Contention snapshot root must be an object" });
    return { issues };
  }
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== CONTENTION_MEMBERSHIP_SCHEMA_VERSION) {
    issues.push({
      code: "schema-version",
      severity: "error",
      message: `Expected ${CONTENTION_MEMBERSHIP_SCHEMA_VERSION}`,
    });
  }
  if (record.snapshotKind !== "official-contention-membership-sidecar") {
    issues.push({ code: "snapshot-kind", severity: "error", message: "snapshotKind must be official-contention-membership-sidecar" });
  }
  if (record.parserVersion !== APS_CONTENTION_CSV_PARSER_VERSION) {
    issues.push({ code: "parser-version", severity: "error", message: "Unexpected parserVersion" });
  }
  if (record.normalizerVersion !== APS_CONTENTION_CSV_NORMALIZER_VERSION) {
    issues.push({ code: "normalizer-version", severity: "error", message: "Unexpected normalizerVersion" });
  }

  const pin = record.applicationPublicationPin as Record<string, unknown> | undefined;
  if (!pin || typeof pin !== "object") {
    issues.push({ code: "missing-app-pin", severity: "error", message: "applicationPublicationPin required" });
  } else {
    if (pin.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
      issues.push({ code: "app-pin-schema", severity: "error", message: "applicationPublicationPin.schemaVersion must be 2.0.0" });
    }
    if (typeof pin.applicationGraphContentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(pin.applicationGraphContentSha256)) {
      issues.push({ code: "app-pin-hash", severity: "error", message: "applicationPublicationPin.applicationGraphContentSha256 invalid" });
    }
  }

  const lineage = record.lineage as Record<string, unknown> | undefined;
  if (!lineage || lineage.artifactRole !== APS_CONTENTION_CSV_ARTIFACT_ROLE) {
    issues.push({ code: "artifact-role", severity: "error", message: "lineage.artifactRole must be Reveal Day contention export" });
  }

  const quality = record.quality as Record<string, unknown> | undefined;
  if (!quality || quality.evidenceSeparationNote !== OFFICIAL_VS_EXACT_STRING_NOTE) {
    issues.push({
      code: "exact-string-separation",
      severity: "error",
      message: "quality.evidenceSeparationNote must state official != exact-string",
    });
  }
  if (quality && quality.applicationCoverageUnchangedByContentionJoin !== true) {
    issues.push({
      code: "coverage-independence",
      severity: "error",
      message: "Contention join must not claim to complete Application coverage",
    });
  }

  const sets = record.contentionSets;
  if (!Array.isArray(sets)) {
    issues.push({ code: "missing-sets", severity: "error", message: "contentionSets must be an array" });
    return { issues };
  }

  const memberIds = new Set<string>();
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i] as Record<string, unknown>;
    const path = `contentionSets[${i}]`;
    if (!set || typeof set.officialContentionSetId !== "string" || !set.officialContentionSetId) {
      issues.push({ code: "missing-set-id", severity: "error", message: "officialContentionSetId required", path });
      continue;
    }
    if (!Array.isArray(set.members)) {
      issues.push({ code: "missing-members", severity: "error", message: "members required", path });
      continue;
    }
    for (let j = 0; j < set.members.length; j++) {
      const m = set.members[j] as Record<string, unknown>;
      const mPath = `${path}.members[${j}]`;
      if (typeof m.applicationId !== "string" || !m.applicationId) {
        issues.push({ code: "missing-member-id", severity: "error", message: "applicationId required", path: mPath });
      } else if ((m.applicationId as string).endsWith("-R")) {
        issues.push({ code: "replacement-member", severity: "error", message: "-R members forbidden", path: mPath });
      } else {
        memberIds.add(m.applicationId as string);
      }
      if (Object.hasOwn(m, "organization") || Object.hasOwn(m, "resolvedOrganization")) {
        issues.push({
          code: "org-resolution-leak",
          severity: "error",
          message: "Org Name must remain publishedOrgName only; no resolved organization field",
          path: mPath,
        });
      }
      if (typeof m.publishedOrgName !== "string") {
        issues.push({ code: "missing-published-org", severity: "error", message: "publishedOrgName required", path: mPath });
      }
    }
  }

  if (issues.some((i) => i.severity === "error")) return { issues };
  return { snapshot: record as ContentionMembershipSnapshotV1, issues };
}

export function contentionValidationFailed(issues: ContentionValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
