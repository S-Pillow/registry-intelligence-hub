import { readFile } from "node:fs/promises";
import type {
  ArtifactPurpose,
  ApprovalState,
  RawSnapshotRecord,
  Registry2012RspMappingArtifact,
  RspMappingEntry,
} from "./types";
import { assertAllowedGtldresultRequestUrl, NetworkTargetPolicyError } from "./network-target-policy";
import { rspFixtureRoot } from "./bundle-paths";

const PLACEHOLDER_HASH_RE =
  /^(0{64}|f{64}|placeholder|not-a-real-hash|deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef)$/i;

const SYNTHETIC_SOURCE_CLASSES = new Set([
  "SYNTHETIC_TEST",
  "PLACEHOLDER",
  "TEST_FIXTURE",
  "SYNTHETIC",
]);

export interface EvidenceSnapshotIndex {
  byId: Map<string, RawSnapshotRecord>;
}

export async function loadEvidenceSnapshotIndex(workspaceRoot: string): Promise<EvidenceSnapshotIndex> {
  const path = `${rspFixtureRoot(workspaceRoot)}/raw-snapshots.json`;
  const text = await readFile(path, "utf8");
  const doc = JSON.parse(text) as { snapshots?: RawSnapshotRecord[] };
  const byId = new Map<string, RawSnapshotRecord>();
  for (const snap of doc.snapshots ?? []) {
    byId.set(snap.snapshotId, snap);
  }
  return { byId };
}

export function isProductionEligibleArtifact(artifact: Registry2012RspMappingArtifact): boolean {
  return artifact.artifactPurpose === "EVIDENCE" && artifact.approvalState === "APPROVED";
}

export interface MappingRowEligibilityIssue {
  applicationId: string;
  code: string;
  detail: string;
}

export interface ArtifactEligibilityResult {
  artifactPurpose: ArtifactPurpose;
  approvalState: ApprovalState;
  productionEligible: boolean;
  mappedCount: number;
  unresolvedCount: number;
  snapshotCount: number;
  rowIssues: MappingRowEligibilityIssue[];
  artifactIssues: string[];
}

function isPlaceholderHash(hash: string | undefined): boolean {
  if (!hash) return true;
  return PLACEHOLDER_HASH_RE.test(hash.trim());
}

function validateProductionRow(
  entry: RspMappingEntry,
  snapshots: EvidenceSnapshotIndex,
): MappingRowEligibilityIssue[] {
  const issues: MappingRowEligibilityIssue[] = [];
  const app = entry.applicationId;

  if (entry.gtldresultAcId == null) {
    issues.push({ applicationId: app, code: "UNRESOLVED_AC_ID", detail: "gtldresultAcId is null" });
    return issues;
  }

  if (SYNTHETIC_SOURCE_CLASSES.has(entry.mappingSourceClass)) {
    issues.push({
      applicationId: app,
      code: "SYNTHETIC_SOURCE_CLASS",
      detail: `mappingSourceClass=${entry.mappingSourceClass}`,
    });
  }

  const snapId = entry.evidenceSnapshotId?.trim();
  if (!snapId) {
    issues.push({ applicationId: app, code: "MISSING_EVIDENCE_SNAPSHOT", detail: "evidenceSnapshotId empty" });
  } else if (!snapshots.byId.has(snapId)) {
    issues.push({
      applicationId: app,
      code: "UNKNOWN_EVIDENCE_SNAPSHOT",
      detail: `evidenceSnapshotId=${snapId}`,
    });
  }

  const sourceUrl = entry.sourceUrl?.trim() ?? "";
  if (!sourceUrl) {
    issues.push({ applicationId: app, code: "EMPTY_SOURCE_URL", detail: "sourceUrl required for evidence rows" });
  } else {
    try {
      assertAllowedGtldresultRequestUrl(sourceUrl);
    } catch (err) {
      issues.push({
        applicationId: app,
        code: "UNTRUSTED_SOURCE_URL",
        detail: err instanceof NetworkTargetPolicyError ? err.message : String(err),
      });
    }
  }

  if (isPlaceholderHash(entry.evidenceContentSha256)) {
    issues.push({
      applicationId: app,
      code: "PLACEHOLDER_EVIDENCE_HASH",
      detail: "evidenceContentSha256 is missing or placeholder",
    });
  }

  if (entry.mappingSourceClass === "STEWARD_APPROVED_MANUAL") {
    if (!snapId || !snapshots.byId.has(snapId)) {
      issues.push({
        applicationId: app,
        code: "MANUAL_WITHOUT_AUDITABLE_EVIDENCE",
        detail: "STEWARD_APPROVED_MANUAL requires a committed evidence snapshot",
      });
    }
  }

  return issues;
}

export function evaluateMappingArtifactEligibility(
  artifact: Registry2012RspMappingArtifact,
  snapshots: EvidenceSnapshotIndex,
): ArtifactEligibilityResult {
  const artifactIssues: string[] = [];
  const productionEligible = isProductionEligibleArtifact(artifact);

  if (!productionEligible) {
    if (artifact.artifactPurpose === "TEST_ONLY") {
      artifactIssues.push("artifactPurpose=TEST_ONLY — cannot satisfy live preflight");
    }
    if (artifact.approvalState !== "APPROVED") {
      artifactIssues.push(`approvalState=${artifact.approvalState} — live requires APPROVED`);
    }
  }

  const seenAc = new Map<number, string>();
  const seenApp = new Map<string, number>();
  const rowIssues: MappingRowEligibilityIssue[] = [];

  let mappedCount = 0;
  let unresolvedCount = 0;

  for (const entry of artifact.entries) {
    if (entry.gtldresultAcId != null) {
      mappedCount += 1;
      const prevApp = seenAc.get(entry.gtldresultAcId);
      if (prevApp && prevApp !== entry.applicationId) {
        rowIssues.push({
          applicationId: entry.applicationId,
          code: "DUPLICATE_AC_ID",
          detail: `gtldresultAcId=${entry.gtldresultAcId} also mapped to ${prevApp}`,
        });
      }
      seenAc.set(entry.gtldresultAcId, entry.applicationId);
    } else {
      unresolvedCount += 1;
    }

    const prevAc = seenApp.get(entry.applicationId);
    if (prevAc != null && prevAc !== entry.gtldresultAcId) {
      rowIssues.push({
        applicationId: entry.applicationId,
        code: "CONFLICTING_ROW",
        detail: "duplicate applicationId with different gtldresultAcId",
      });
    }
    seenApp.set(entry.applicationId, entry.gtldresultAcId ?? -1);

    if (productionEligible && entry.gtldresultAcId != null) {
      rowIssues.push(...validateProductionRow(entry, snapshots));
    }
  }

  return {
    artifactPurpose: artifact.artifactPurpose,
    approvalState: artifact.approvalState,
    productionEligible,
    mappedCount,
    unresolvedCount,
    snapshotCount: snapshots.byId.size,
    rowIssues,
    artifactIssues,
  };
}

/** Fail closed before any live HTTP when artifact or rows are not production-eligible. */
export function assertLivePreflightEligible(
  artifact: Registry2012RspMappingArtifact,
  evaluation: ArtifactEligibilityResult,
): void {
  if (!evaluation.productionEligible) {
    throw new Error(
      `Live preflight rejected: ${evaluation.artifactIssues.join("; ") || "artifact not EVIDENCE+APPROVED"}`,
    );
  }
  if (evaluation.rowIssues.length > 0) {
    const sample = evaluation.rowIssues
      .slice(0, 5)
      .map((i) => `${i.applicationId}:${i.code}`)
      .join(", ");
    throw new Error(`Live preflight rejected mapping evidence issues (${evaluation.rowIssues.length}): ${sample}`);
  }
}
