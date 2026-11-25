import { createHash } from "node:crypto";
import { ForecastPreviewError } from "./types";

const REQUIRED_TLDS = ["net", "org", "info", "biz", "app", "dev"] as const;

export type ValidatedSuffixDemandAggregate = {
  schemaVersion: 3;
  status: "complete";
  snapshotDate: string;
  manifestId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  referencePanelTlds: string[];
  domainScan: {
    status: "complete";
    referencePanelTlds: string[];
    filesVerified: number;
  };
  applicationCensus: unknown;
  candidateProvenance: unknown;
  processing: unknown;
  forecastConversion: { applied: false };
  strings: Array<{
    stringLabel: string;
    domainCount: number;
    measurementStatus?: string;
    brandDesignationObserved?: boolean | null;
    contested?: boolean | null;
    fromNormalizedApplication?: boolean | null;
    fromKnownExcluded?: boolean | null;
    origins?: string[] | null;
  }>;
};

/**
 * Validate a FCAST-04B schema-v3 suffix-demand aggregate for offline forecast preview.
 * Does not mutate the source file.
 */
export function validateSuffixDemandAggregateForPreview(
  value: unknown,
  options: {
    expectedSha256?: string;
    rawBytes?: Buffer | Uint8Array;
  } = {},
): ValidatedSuffixDemandAggregate {
  if (!value || typeof value !== "object") {
    throw new ForecastPreviewError("Aggregate must be a JSON object");
  }
  const raw = value as Record<string, unknown>;

  if (raw.schemaVersion !== 3) {
    throw new ForecastPreviewError("Aggregate schemaVersion must be 3", [
      `got=${String(raw.schemaVersion)}`,
    ]);
  }
  if (raw.status !== "complete") {
    throw new ForecastPreviewError("Aggregate status must be complete", [
      `got=${String(raw.status)}`,
    ]);
  }

  const domainScan = raw.domainScan;
  if (!domainScan || typeof domainScan !== "object") {
    throw new ForecastPreviewError("Aggregate domainScan is required");
  }
  const scan = domainScan as Record<string, unknown>;
  if (scan.status !== "complete") {
    throw new ForecastPreviewError("domainScan.status must be complete");
  }
  if (scan.filesVerified !== 6) {
    throw new ForecastPreviewError("domainScan.filesVerified must be 6", [
      `got=${String(scan.filesVerified)}`,
    ]);
  }

  const tlds = raw.referencePanelTlds;
  if (!Array.isArray(tlds) || tlds.length !== 6) {
    throw new ForecastPreviewError("referencePanelTlds must list exactly six TLDs");
  }
  const normalized = tlds.map((t) => String(t).toLowerCase());
  for (const want of REQUIRED_TLDS) {
    if (!normalized.includes(want)) {
      throw new ForecastPreviewError("referencePanelTlds missing required mid-panel TLD", [want]);
    }
  }

  const forecastConversion = raw.forecastConversion;
  if (
    !forecastConversion ||
    typeof forecastConversion !== "object" ||
    (forecastConversion as { applied?: unknown }).applied !== false
  ) {
    throw new ForecastPreviewError("forecastConversion.applied must be false on the source aggregate");
  }

  if (typeof raw.snapshotDate !== "string" || !raw.snapshotDate) {
    throw new ForecastPreviewError("snapshotDate is required");
  }
  if (typeof raw.manifestId !== "string" || !raw.manifestId) {
    throw new ForecastPreviewError("manifestId is required");
  }
  if (typeof raw.sourceId !== "string" || !raw.sourceId) {
    throw new ForecastPreviewError("sourceId is required");
  }
  if (typeof raw.sourceName !== "string" || !raw.sourceName) {
    throw new ForecastPreviewError("sourceName is required");
  }
  if (typeof raw.sourceUrl !== "string" || !raw.sourceUrl) {
    throw new ForecastPreviewError("sourceUrl is required");
  }
  if (typeof raw.attribution !== "string" || !raw.attribution) {
    throw new ForecastPreviewError("attribution is required");
  }
  if (!raw.candidateProvenance || typeof raw.candidateProvenance !== "object") {
    throw new ForecastPreviewError("candidateProvenance is required");
  }
  if (!raw.applicationCensus || typeof raw.applicationCensus !== "object") {
    throw new ForecastPreviewError("applicationCensus is required");
  }

  if (!Array.isArray(raw.strings) || raw.strings.length === 0) {
    throw new ForecastPreviewError("Aggregate strings[] must be a non-empty array");
  }

  const seen = new Set<string>();
  const strings: ValidatedSuffixDemandAggregate["strings"] = [];
  for (const [i, row] of raw.strings.entries()) {
    if (!row || typeof row !== "object") {
      throw new ForecastPreviewError(`strings[${i}] must be an object`);
    }
    const r = row as Record<string, unknown>;
    const label = typeof r.stringLabel === "string" ? r.stringLabel.trim().toLowerCase() : "";
    if (!label) {
      throw new ForecastPreviewError(`strings[${i}].stringLabel is missing`);
    }
    if (seen.has(label)) {
      throw new ForecastPreviewError("Duplicate stringLabel in aggregate", [label]);
    }
    seen.add(label);
    const domainCount = r.domainCount;
    if (typeof domainCount !== "number" || !Number.isFinite(domainCount) || domainCount < 0) {
      throw new ForecastPreviewError(`strings[${i}].domainCount must be a finite number >= 0`, [
        label,
        String(domainCount),
      ]);
    }
    if (r.measurementStatus != null && r.measurementStatus !== "measured") {
      throw new ForecastPreviewError(`strings[${i}].measurementStatus must be measured when present`, [
        label,
        String(r.measurementStatus),
      ]);
    }
    strings.push({
      stringLabel: label,
      domainCount,
      measurementStatus: typeof r.measurementStatus === "string" ? r.measurementStatus : undefined,
      brandDesignationObserved:
        r.brandDesignationObserved === true || r.brandDesignationObserved === false
          ? r.brandDesignationObserved
          : r.brandDesignationObserved === null
            ? null
            : null,
      contested:
        r.contested === true || r.contested === false
          ? r.contested
          : r.contested === null
            ? null
            : null,
      fromNormalizedApplication:
        typeof r.fromNormalizedApplication === "boolean" ? r.fromNormalizedApplication : null,
      fromKnownExcluded: typeof r.fromKnownExcluded === "boolean" ? r.fromKnownExcluded : null,
      origins: Array.isArray(r.origins) ? r.origins.map(String) : null,
    });
  }

  if (options.expectedSha256) {
    if (!options.rawBytes) {
      throw new ForecastPreviewError("expectedSha256 provided without rawBytes for verification");
    }
    const actual = createHash("sha256").update(options.rawBytes).digest("hex");
    if (actual !== options.expectedSha256.toLowerCase()) {
      throw new ForecastPreviewError("Aggregate SHA-256 mismatch", [
        `expected=${options.expectedSha256.toLowerCase()}`,
        `actual=${actual}`,
      ]);
    }
  }

  return {
    schemaVersion: 3,
    status: "complete",
    snapshotDate: raw.snapshotDate,
    manifestId: raw.manifestId,
    sourceId: raw.sourceId,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    attribution: raw.attribution,
    referencePanelTlds: normalized,
    domainScan: {
      status: "complete",
      referencePanelTlds: Array.isArray(scan.referencePanelTlds)
        ? scan.referencePanelTlds.map(String)
        : normalized,
      filesVerified: 6,
    },
    applicationCensus: raw.applicationCensus,
    candidateProvenance: raw.candidateProvenance,
    processing: raw.processing ?? null,
    forecastConversion: { applied: false },
    strings,
  };
}
