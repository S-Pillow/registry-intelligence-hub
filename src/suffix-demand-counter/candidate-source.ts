import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { domainToASCII } from "node:url";
import {
  buildForecastUnits,
  isConfirmedClosedBrandUnit,
} from "@/lib/registration-forecast";
import {
  isBrowserApplicationPayloadDocumentV2,
  type BrowserApplicationV2,
} from "@/lib/registry-applications-document-v2";
import { isValidLdhLabel } from "./match";
import { SuffixDemandCounterError, type CandidateProvenance } from "./types";

const SHA256_RE = /^[a-f0-9]{64}$/i;

function requiredText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOfficialApsUrl(value: unknown): boolean {
  if (!requiredText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "newgtldprogram-aps.icann.org";
  } catch {
    return false;
  }
}

/**
 * Load an explicitly supplied, authoritative, complete 2026 browser-document
 * snapshot. Never load the built-in rehearsal/example fixture as a substitute.
 */
export async function loadAuthoritative2026Candidates(
  documentPath: string,
): Promise<{ labels: string[]; provenance: CandidateProvenance }> {
  let bytes: Buffer;
  try {
    bytes = await readFile(documentPath);
  } catch (err) {
    throw new SuffixDemandCounterError("2026 applications document unavailable", [
      err instanceof Error ? err.message : String(err),
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new SuffixDemandCounterError("2026 applications document is not valid JSON");
  }
  if (!isBrowserApplicationPayloadDocumentV2(parsed)) {
    throw new SuffixDemandCounterError("Invalid RegistryApplicationsDocumentV2 payload");
  }

  const doc = parsed;
  const coverage = doc.applicationRecordCoverage;
  if (
    doc.payloadMode !== "promoted-2026" ||
    !requiredText(doc.snapshotId) ||
    !requiredText(doc.snapshotContentHash) ||
    !SHA256_RE.test(doc.snapshotContentHash) ||
    !requiredText(doc.rawSha256) ||
    !SHA256_RE.test(doc.rawSha256) ||
    !requiredText(doc.publicationSchemaVersion) ||
    doc.publicationSchemaVersion !== "registry-2026-publication/2.0.0" ||
    !requiredText(doc.source?.name) ||
    !isOfficialApsUrl(doc.source?.url) ||
    doc.source?.evidenceClass !== "public-aps-export" ||
    !isOfficialApsUrl(doc.officialAggregates?.provenance?.sourceUrl) ||
    !SHA256_RE.test(doc.officialAggregates?.provenance?.contentSha256 ?? "") ||
    !requiredText(doc.publishedAt) ||
    !requiredText(doc.retrievedAt) ||
    !doc.bundleManifest ||
    doc.bundleManifest.applicationGraphContentSha256 !== doc.snapshotContentHash ||
    !SHA256_RE.test(doc.bundleManifest.officialAggregatesContentSha256 ?? "") ||
    !SHA256_RE.test(doc.bundleManifest.coverageDescriptorSha256 ?? "") ||
    !coverage ||
    coverage.completeness !== "complete" ||
    !Array.isArray(coverage.knownExcludedRecords) ||
    coverage.knownExcludedRecords.length !== 0 ||
    !Array.isArray(doc.knownExcludedRecords) ||
    doc.knownExcludedRecords.length !== 0 ||
    !Number.isSafeInteger(doc.officialApplications) ||
    doc.officialApplications < 1 ||
    doc.officialApplications !== doc.observedApplicationRecords ||
    doc.applications.length !== doc.observedApplicationRecords ||
    coverage.observed !== doc.observedApplicationRecords ||
    coverage.official !== doc.officialApplications ||
    doc.officialAggregates?.officialApplicationCount !== doc.officialApplications
  ) {
    throw new SuffixDemandCounterError(
      "2026 applications document is not a validated, complete promoted round snapshot",
      ["Full-round candidates require complete reconciled application coverage, valid source pins, and the promoted-2026 payload."],
    );
  }

  const ids = new Set<string>();
  for (const [index, app] of doc.applications.entries()) {
    const candidate = app as BrowserApplicationV2;
    if (
      !candidate ||
      !requiredText(candidate.applicationId) ||
      !requiredText(candidate.applicant) ||
      !requiredText(candidate.applicationStatus) ||
      !requiredText(candidate.appliedString?.label) ||
      typeof candidate.designations?.brand !== "boolean" ||
      (candidate.replacementString && (
        !requiredText(candidate.replacementString.label) ||
        !requiredText(candidate.replacementString.sourceRowId) ||
        !requiredText(candidate.replacementString.applicationType) ||
        !requiredText(candidate.replacementString.applicationStatus)
      )) ||
      ids.has(candidate.applicationId)
    ) {
      throw new SuffixDemandCounterError(`Invalid or duplicate 2026 application at index ${index}`);
    }
    ids.add(candidate.applicationId);
  }

  const units = buildForecastUnits(doc);
  const eligible = units.filter((unit) => !isConfirmedClosedBrandUnit(unit));
  const excludedBrandStrings = units.length - eligible.length;
  const normalized = new Set<string>();
  for (const unit of eligible) {
    const ascii = domainToASCII(unit.stringLabel).toLowerCase();
    if (!isValidLdhLabel(ascii)) {
      throw new SuffixDemandCounterError(`Invalid selected/current candidate extension: ${unit.stringLabel}`);
    }
    normalized.add(ascii);
  }
  const labels = [...normalized].sort();
  if (!labels.length) {
    throw new SuffixDemandCounterError("No eligible 2026 extension strings in authoritative snapshot");
  }

  return {
    labels,
    provenance: {
      mode: "applications-document-v2",
      candidateListId: `2026-selected-current-${doc.snapshotId}`,
      candidateListSha256: createHash("sha256").update(labels.join("\n")).digest("hex"),
      candidateCount: labels.length,
      excludedBrandStrings,
      brandExclusionPolicy: "All applications for a selected string are Brand-designated (proxy only; registration policy not established)",
      applicationSnapshot: {
        snapshotId: doc.snapshotId,
        snapshotContentHash: doc.snapshotContentHash,
        artifactSha256: createHash("sha256").update(bytes).digest("hex"),
        rawSourceSha256: doc.rawSha256,
        payloadVersion: doc.payloadVersion,
        publishedAt: doc.publishedAt,
        retrievedAt: doc.retrievedAt,
        sourceName: doc.source.name,
        sourceUrl: doc.source.url,
        officialApplications: doc.officialApplications,
        representedApplications: doc.observedApplicationRecords,
      },
    },
  };
}
