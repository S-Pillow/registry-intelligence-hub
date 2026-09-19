import { readFile } from "node:fs/promises";
import { contentHash } from "../normalization/hashes";
import { normalizeApplications, summarizeNormalization } from "./normalize";
import type { DryRunDiagnostics, Registry2026PublicationSnapshot } from "./types";
import {
  NORMALIZER_VERSION,
  PARSER_VERSION,
  VALIDATION_METHOD_VERSION,
} from "./types";
import { isRehearsalPublication, validatePublicationSnapshot, validationFailed } from "./validate";

export async function loadPublicationSnapshotFromPath(
  snapshotPath: string,
): Promise<Registry2026PublicationSnapshot> {
  const text = await readFile(snapshotPath, "utf8");
  const raw = JSON.parse(text) as unknown;
  const rehearsalGuess =
    typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).publicationKind === "rehearsal-for-pipeline-only";
  const { snapshot, issues } = validatePublicationSnapshot(raw, {
    enforceProductionRowBounds: !rehearsalGuess,
  });
  if (!snapshot || validationFailed(issues)) {
    const messages = issues.filter((i) => i.severity === "error").map((i) => i.message);
    throw new Error(`Publication validation failed:\n${messages.join("\n")}`);
  }
  return snapshot;
}

export function runDryRunIngestion(snapshot: Registry2026PublicationSnapshot): DryRunDiagnostics {
  const { issues } = validatePublicationSnapshot(snapshot, {
    enforceProductionRowBounds: snapshot.publicationKind === "immutable-publication",
  });
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const { observations, unresolvedFields } = normalizeApplications(snapshot.applications);
  const counts = summarizeNormalization(observations);
  const rehearsal = isRehearsalPublication(snapshot);

  return {
    methodVersions: {
      parser: PARSER_VERSION,
      normalizer: NORMALIZER_VERSION,
      validation: VALIDATION_METHOD_VERSION,
    },
    publicationKind: snapshot.publicationKind,
    snapshotId: snapshot.snapshotId,
    snapshotContentHash: contentHash({
      snapshotId: snapshot.snapshotId,
      applications: snapshot.applications,
    }),
    recordCounts: {
      applications: counts.observationCount,
      uniqueStrings: counts.uniqueStrings,
      idnApplications: counts.idnApplications,
      distinctOrganizations: counts.distinctOrganizations,
    },
    normalization: {
      observationCount: observations.length,
      unresolvedFieldCount: unresolvedFields.length,
      unresolvedFields,
    },
    validation: {
      ok: errors.length === 0,
      errors,
      warnings,
    },
    provenance: {
      publishedAt: snapshot.publishedAt,
      retrievedAt: snapshot.retrievedAt,
      sourceName: snapshot.source.name,
      sourceUrl: snapshot.source.url,
    },
    contaminationCheck: {
      rehearsalMarkersPresent: rehearsal,
      blockedForRealPromotion: rehearsal,
    },
  };
}
