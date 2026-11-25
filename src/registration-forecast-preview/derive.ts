import {
  FORECAST_CONVERSION_FACTORS,
  FORECAST_ESTIMATE_DISCLAIMER,
  FORECAST_HORIZON_LABEL,
  estimateRegistrationsFromSuffixDemand,
  isCompoundWordCandidate,
} from "@/lib/registration-forecast";
import type { ValidatedSuffixDemandAggregate } from "./validate-aggregate";
import type { ForecastPreviewDocument, ForecastPreviewRow } from "./types";
import { ForecastPreviewError } from "./types";

export function buildForecastPreviewDocument(options: {
  aggregate: ValidatedSuffixDemandAggregate;
  sourcePath: string;
  sourceSha256: string;
}): ForecastPreviewDocument {
  const { aggregate, sourcePath, sourceSha256 } = options;
  const rows: ForecastPreviewRow[] = [];
  const seen = new Set<string>();

  for (const item of aggregate.strings) {
    if (seen.has(item.stringLabel)) {
      throw new ForecastPreviewError("Duplicate string prevented during preview derivation", [
        item.stringLabel,
      ]);
    }
    seen.add(item.stringLabel);

    const compound = isCompoundWordCandidate(item.stringLabel);
    if (compound) {
      const range = estimateRegistrationsFromSuffixDemand(item.domainCount);
      rows.push({
        stringLabel: item.stringLabel,
        measuredDomainCount: item.domainCount,
        status: "estimated",
        compoundWordCandidate: true,
        range,
        statusNote: `Experimental estimate from measuredDomainCount × conversion (${FORECAST_CONVERSION_FACTORS.conservative} / ${FORECAST_CONVERSION_FACTORS.expected} / ${FORECAST_CONVERSION_FACTORS.optimistic}). Horizon: ${FORECAST_HORIZON_LABEL}. Not a validated predictive model.`,
        brandDesignationObserved: item.brandDesignationObserved ?? null,
        contested: item.contested ?? null,
        fromNormalizedApplication: item.fromNormalizedApplication ?? null,
        fromKnownExcluded: item.fromKnownExcluded ?? null,
        origins: item.origins ?? null,
      });
    } else {
      rows.push({
        stringLabel: item.stringLabel,
        measuredDomainCount: item.domainCount,
        status: "conversion_not_recommended",
        compoundWordCandidate: false,
        range: null,
        statusNote:
          "Measured suffix demand retained. The experimental 0.8 / 1.9 / 3.2 conversion band is reserved for word-like / compound strings (length ≥ 3). This is not zero demand and not unavailable demand.",
        brandDesignationObserved: item.brandDesignationObserved ?? null,
        contested: item.contested ?? null,
        fromNormalizedApplication: item.fromNormalizedApplication ?? null,
        fromKnownExcluded: item.fromKnownExcluded ?? null,
        origins: item.origins ?? null,
      });
    }
  }

  // Stable lexicographic order for deterministic output.
  rows.sort((a, b) => a.stringLabel.localeCompare(b.stringLabel));

  const estimatedStringCount = rows.filter((r) => r.status === "estimated").length;
  const conversionNotRecommendedCount = rows.filter(
    (r) => r.status === "conversion_not_recommended",
  ).length;
  const zeroMeasuredDemandCount = rows.filter((r) => r.measuredDomainCount === 0).length;

  if (rows.length !== aggregate.strings.length) {
    throw new ForecastPreviewError("Preview row count diverged from measured input count");
  }

  return {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-preview",
    status: "complete",
    horizonLabel: FORECAST_HORIZON_LABEL,
    disclaimer: `${FORECAST_ESTIMATE_DISCLAIMER} Offline analysis artifact only — not a production publication or product export endpoint.`,
    conversionFactors: { ...FORECAST_CONVERSION_FACTORS },
    conversionNote:
      "Factors are transparent experimental assumptions inspired by publicly described Toyroom scenario bands. They are not calibrated market forecasts and do not establish launch eligibility, open-registration policy, or full-market coverage.",
    sourceAggregate: {
      path: sourcePath,
      sha256: sourceSha256,
      schemaVersion: aggregate.schemaVersion,
      status: aggregate.status,
      snapshotDate: aggregate.snapshotDate,
      manifestId: aggregate.manifestId,
      sourceId: aggregate.sourceId,
      sourceName: aggregate.sourceName,
      sourceUrl: aggregate.sourceUrl,
      attribution: aggregate.attribution,
      referencePanelTlds: aggregate.referencePanelTlds,
      domainScan: aggregate.domainScan,
      applicationCensus: aggregate.applicationCensus,
      candidateProvenance: aggregate.candidateProvenance,
      processing: aggregate.processing,
    },
    summary: {
      measuredStringCount: rows.length,
      estimatedStringCount,
      conversionNotRecommendedCount,
      zeroMeasuredDemandCount,
    },
    limitations: [
      "Estimates are derived only from measured ActiveDNS mid-panel suffix-demand counts × experimental factors 0.8 / 1.9 / 3.2.",
      "Reference panel is .net / .org / .info / .biz / .app / .dev only — .com and other TLDs are absent; counts understate broader suffix demand.",
      "ActiveDNS observed domains are not equivalent to all registered domains.",
      "Application census coverage remains partial/observed; this preview does not assert a complete 2026 round inventory.",
      "WDO, Brand-designated strings, withdrawn/contested/incomplete attributes are retained for observed-string measurement; Brand is not used as a forecast exclusion filter in this preview.",
      "conversion_not_recommended rows retain measuredDomainCount with range=null — they are not silent zeros.",
      "Factors are experimental assumptions, not validated forecasting accuracy.",
      "Offline analysis artifact only — not website integration, not a verified market prediction publication.",
    ],
    strings: rows,
  };
}

/** Deterministic JSON with sorted object keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

export function forecastPreviewToCsv(document: ForecastPreviewDocument): string {
  const header = [
    "stringLabel",
    "measuredDomainCount",
    "status",
    "compoundWordCandidate",
    "conservative",
    "expected",
    "optimistic",
    "brandDesignationObserved",
    "contested",
    "fromNormalizedApplication",
    "fromKnownExcluded",
    "origins",
    "statusNote",
  ];
  const lines = [header.join(",")];
  for (const row of document.strings) {
    lines.push(
      [
        csvEscape(row.stringLabel),
        String(row.measuredDomainCount),
        csvEscape(row.status),
        String(row.compoundWordCandidate),
        row.range ? String(row.range.conservative) : "",
        row.range ? String(row.range.expected) : "",
        row.range ? String(row.range.optimistic) : "",
        row.brandDesignationObserved === null ? "" : String(row.brandDesignationObserved),
        row.contested === null ? "" : String(row.contested),
        row.fromNormalizedApplication === null ? "" : String(row.fromNormalizedApplication),
        row.fromKnownExcluded === null ? "" : String(row.fromKnownExcluded),
        csvEscape((row.origins ?? []).join("|")),
        csvEscape(row.statusNote),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
