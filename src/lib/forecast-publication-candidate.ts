/**
 * RIH-FCAST-06 — Deterministic sanitized publication-candidate types + projection.
 * Numerical values are copied from the accepted FCAST-05A preview only.
 * Public UI labels: Low / Middle / High (maps to conservative / expected / optimistic).
 */

import { FORECAST_CONVERSION_FACTORS } from "@/lib/registration-forecast";
import type { ForecastPreviewDocument, ForecastPreviewRow } from "@/registration-forecast-preview/types";

export const FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH =
  ".data/registration-forecast/experimental-forecast-publication-candidate.json";

export const FORECAST_PUBLIC_SCENARIO_LABELS = {
  low: "Low scenario",
  middle: "Middle scenario",
  high: "High scenario",
} as const;

export type ForecastPublicationScenarioBand = {
  low: number;
  middle: number;
  high: number;
};

export type ForecastPublicationString = {
  stringLabel: string;
  measuredDomainCount: number;
  status: "estimated" | "conversion_not_recommended";
  /** Null when conversion is not recommended — never fabricate. */
  scenarios: ForecastPublicationScenarioBand | null;
  brandDesignationObserved: boolean | null;
  contested: boolean | null;
  origins: string[] | null;
  fromNormalizedApplication: boolean | null;
  fromKnownExcluded: boolean | null;
};

export type ForecastPublicationCandidate = {
  schemaVersion: 1;
  kind: "experimental-registration-forecast-publication-candidate";
  status: "unpublished-candidate";
  horizonLabel: string;
  disclaimer: string;
  methodologySummary: string;
  /** Internal factor keys preserved for calculation contract; UI uses Low/Middle/High. */
  conversionFactors: {
    conservative: number;
    expected: number;
    optimistic: number;
  };
  publicScenarioLabels: typeof FORECAST_PUBLIC_SCENARIO_LABELS;
  snapshotDate: string;
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  referencePanelTlds: string[];
  sourcePreviewSha256: string;
  sourceAggregateSha256: string;
  summary: {
    measuredStringCount: number;
    estimatedStringCount: number;
    conversionNotRecommendedCount: number;
    zeroMeasuredDemandCount: number;
  };
  limitations: string[];
  strings: ForecastPublicationString[];
};

export type ForecastStringView = {
  stringLabel: string;
  extension: string;
  measuredDomainCount: number;
  status: "estimated" | "conversion_not_recommended";
  scenarios: ForecastPublicationScenarioBand | null;
  brandDesignationObserved: boolean | null;
  contested: boolean | null;
  origins: string[] | null;
  sourceDetail: string;
};

export type ForecastCatalogView = {
  heading: "Experimental Registration Forecast — 2026";
  summary: ForecastPublicationCandidate["summary"];
  conversionFactors: ForecastPublicationCandidate["conversionFactors"];
  publicScenarioLabels: typeof FORECAST_PUBLIC_SCENARIO_LABELS;
  snapshotDate: string;
  referencePanelTlds: string[];
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  sourcePreviewSha256: string;
  sourceAggregateSha256: string;
  disclaimer: string;
  methodologySummary: string;
  limitations: string[];
  strings: ForecastStringView[];
  labelSet: string[];
};

export function assertConversionFactorsUnchanged(factors: {
  conservative: number;
  expected: number;
  optimistic: number;
}): void {
  if (
    factors.conservative !== FORECAST_CONVERSION_FACTORS.conservative ||
    factors.expected !== FORECAST_CONVERSION_FACTORS.expected ||
    factors.optimistic !== FORECAST_CONVERSION_FACTORS.optimistic
  ) {
    throw new Error("Publication candidate must not alter conversion factors");
  }
}

function projectPublicationString(row: ForecastPreviewRow): ForecastPublicationString {
  return {
    stringLabel: row.stringLabel,
    measuredDomainCount: row.measuredDomainCount,
    status: row.status,
    scenarios: row.range
      ? {
          low: row.range.conservative,
          middle: row.range.expected,
          high: row.range.optimistic,
        }
      : null,
    brandDesignationObserved: row.brandDesignationObserved,
    contested: row.contested,
    origins: row.origins ?? null,
    fromNormalizedApplication: row.fromNormalizedApplication,
    fromKnownExcluded: row.fromKnownExcluded,
  };
}

/**
 * Build a minimal sanitized publication candidate from the accepted preview document.
 * Excludes absolute paths, ActiveDNS domain lists, and unrelated aggregate blobs.
 */
export function buildForecastPublicationCandidate(options: {
  preview: ForecastPreviewDocument;
  sourcePreviewSha256: string;
}): ForecastPublicationCandidate {
  const { preview, sourcePreviewSha256 } = options;
  assertConversionFactorsUnchanged(preview.conversionFactors);

  const strings = preview.strings.map(projectPublicationString);
  // Stable lexicographic order for deterministic output.
  strings.sort((a, b) => a.stringLabel.localeCompare(b.stringLabel));

  return {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-publication-candidate",
    status: "unpublished-candidate",
    horizonLabel: preview.horizonLabel,
    disclaimer:
      "These figures are experimental estimates, not facts. Measured matches count existing domains whose second-level names equal or literally end with the proposed string. Scenario values apply fixed experimental factors and are not statistically validated market predictions.",
    methodologySummary:
      "Measured matches use literal suffix matching on an ActiveDNS mid-panel snapshot (.net, .org, .info, .biz, .app, .dev). .com and other TLDs are not represented. Low / Middle / High scenarios multiply the measured count by 0.8 / 1.9 / 3.2 for an approximately four-year horizon. Common word endings can produce many matches without establishing registration intent. Brand, withdrawn, contested, and uncertain strings remain included when measured.",
    conversionFactors: { ...preview.conversionFactors },
    publicScenarioLabels: { ...FORECAST_PUBLIC_SCENARIO_LABELS },
    snapshotDate: preview.sourceAggregate.snapshotDate,
    sourceName: preview.sourceAggregate.sourceName,
    sourceUrl: preview.sourceAggregate.sourceUrl,
    attribution: preview.sourceAggregate.attribution,
    referencePanelTlds: [...preview.sourceAggregate.referencePanelTlds],
    sourcePreviewSha256,
    sourceAggregateSha256: preview.sourceAggregate.sha256,
    summary: { ...preview.summary },
    limitations: [
      ...preview.limitations.filter((line) => !/toyroom/i.test(line)),
      "Publication candidate is unpublished local preparation only — not a live product export.",
    ],
    strings,
  };
}

function sourceDetailFor(row: ForecastPublicationString): string {
  const bits: string[] = [];
  if (row.fromKnownExcluded) bits.push("known-excluded");
  if (row.fromNormalizedApplication) bits.push("application record");
  if (row.origins?.length) bits.push(row.origins.join(" + "));
  if (row.brandDesignationObserved === true) bits.push("Brand observed");
  if (row.brandDesignationObserved === null && row.fromKnownExcluded) bits.push("Brand unknown");
  return bits.length ? bits.join(" · ") : "Observed string";
}

export function projectForecastCatalogView(
  candidate: ForecastPublicationCandidate,
): ForecastCatalogView {
  assertConversionFactorsUnchanged(candidate.conversionFactors);
  const strings: ForecastStringView[] = candidate.strings.map((row) => ({
    stringLabel: row.stringLabel,
    extension: `.${row.stringLabel}`,
    measuredDomainCount: row.measuredDomainCount,
    status: row.status,
    scenarios: row.scenarios,
    brandDesignationObserved: row.brandDesignationObserved,
    contested: row.contested,
    origins: row.origins,
    sourceDetail: sourceDetailFor(row),
  }));
  return {
    heading: "Experimental Registration Forecast — 2026",
    summary: { ...candidate.summary },
    conversionFactors: { ...candidate.conversionFactors },
    publicScenarioLabels: { ...candidate.publicScenarioLabels },
    snapshotDate: candidate.snapshotDate,
    referencePanelTlds: [...candidate.referencePanelTlds],
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    attribution: candidate.attribution,
    sourcePreviewSha256: candidate.sourcePreviewSha256,
    sourceAggregateSha256: candidate.sourceAggregateSha256,
    disclaimer: candidate.disclaimer,
    methodologySummary: candidate.methodologySummary,
    limitations: [...candidate.limitations],
    strings,
    labelSet: strings.map((s) => s.stringLabel),
  };
}

export function findForecastStringView(
  catalog: ForecastCatalogView,
  label: string,
): ForecastStringView | null {
  const normalized = label.trim().toLowerCase().replace(/^\.+/, "");
  return catalog.strings.find((s) => s.stringLabel === normalized) ?? null;
}

/** Stable JSON stringify for reproducible hashing. */
export function stableStringifyForecastCandidate(value: unknown): string {
  return `${stableValue(value)}\n`;
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValue(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableValue(obj[k])}`).join(",")}}`;
}
