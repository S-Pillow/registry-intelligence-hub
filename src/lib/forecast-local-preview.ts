/**
 * RIH-FCAST-05B — Local forecast preview gate, projection, and table helpers.
 * Crypto validation + filesystem loading live in forecast-local-preview-server.ts.
 * This module is safe to import from Client Components.
 */

import type { ForecastPreviewDocument, ForecastPreviewRow } from "@/registration-forecast-preview/types";

export const FORECAST_LOCAL_PREVIEW_RELATIVE_PATH =
  ".data/registration-forecast/experimental-forecast-preview.json";

export const FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256 =
  "3e60229cae3f0950948215557f5b5fed59c5de1230165babd6c00ab89cd3bc58";

export const FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256 =
  "287be9f443f45c740e3a0ff3e743e82c46d8bb98e2a55b748511bace9b1d5158";

export const FORECAST_LOCAL_PREVIEW_PAGE_SIZE = 25;

export type ForecastLocalPreviewRowView = {
  stringLabel: string;
  extension: string;
  measuredDomainCount: number;
  conservative: number | null;
  expected: number | null;
  optimistic: number | null;
  conversionStatus: "estimated" | "conversion_not_recommended";
  statusNote: string;
  brandDesignationObserved: boolean | null;
  contested: boolean | null;
  origins: string[] | null;
  fromKnownExcluded: boolean | null;
  fromNormalizedApplication: boolean | null;
  sourceDetail: string;
};

export type ForecastLocalPreviewViewModel = {
  heading: "Experimental Registration Forecast — 2026";
  summary: {
    measuredStringCount: number;
    estimatedStringCount: number;
    conversionNotRecommendedCount: number;
    zeroMeasuredDemandCount: number;
  };
  conversionFactors: {
    conservative: number;
    expected: number;
    optimistic: number;
  };
  snapshotDate: string;
  referencePanelTlds: string[];
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  previewSha256: string;
  sourceAggregateSha256: string;
  disclaimer: string;
  conversionNote: string;
  limitations: string[];
  rows: ForecastLocalPreviewRowView[];
};

export type ForecastLocalPreviewSortKey = "expected" | "measured" | "extension";
export type ForecastLocalPreviewSortDir = "asc" | "desc";

export function isForecastLocalPreviewEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.RIH_FORECAST_LOCAL_PREVIEW === "1";
}

export function projectForecastLocalPreviewViewModel(
  doc: ForecastPreviewDocument,
  previewSha256: string,
): ForecastLocalPreviewViewModel {
  return {
    heading: "Experimental Registration Forecast — 2026",
    summary: { ...doc.summary },
    conversionFactors: { ...doc.conversionFactors },
    snapshotDate: doc.sourceAggregate.snapshotDate,
    referencePanelTlds: [...doc.sourceAggregate.referencePanelTlds],
    sourceName: doc.sourceAggregate.sourceName,
    sourceUrl: doc.sourceAggregate.sourceUrl,
    attribution: doc.sourceAggregate.attribution,
    previewSha256,
    sourceAggregateSha256: doc.sourceAggregate.sha256,
    disclaimer: doc.disclaimer,
    conversionNote: doc.conversionNote,
    limitations: [...doc.limitations],
    rows: doc.strings.map(projectRow),
  };
}

function projectRow(row: ForecastPreviewRow): ForecastLocalPreviewRowView {
  const origins = row.origins ?? null;
  const sourceBits: string[] = [];
  if (row.fromKnownExcluded) sourceBits.push("known-excluded");
  if (row.fromNormalizedApplication) sourceBits.push("normalized-app");
  if (origins?.length) sourceBits.push(origins.join("+"));
  if (row.brandDesignationObserved === true) sourceBits.push("brand-observed");
  if (row.brandDesignationObserved === null && row.fromKnownExcluded) {
    sourceBits.push("brand-unknown");
  }
  return {
    stringLabel: row.stringLabel,
    extension: `.${row.stringLabel}`,
    measuredDomainCount: row.measuredDomainCount,
    conservative: row.range?.conservative ?? null,
    expected: row.range?.expected ?? null,
    optimistic: row.range?.optimistic ?? null,
    conversionStatus: row.status,
    statusNote: row.statusNote,
    brandDesignationObserved: row.brandDesignationObserved,
    contested: row.contested,
    origins,
    fromKnownExcluded: row.fromKnownExcluded,
    fromNormalizedApplication: row.fromNormalizedApplication,
    sourceDetail: sourceBits.length ? sourceBits.join(" · ") : "observed",
  };
}

/** Normalize search input: strip leading dots, lowercase, trim. */
export function normalizeExtensionSearch(query: string): string {
  return query.trim().toLowerCase().replace(/^\.+/, "");
}

export function filterForecastPreviewRows(
  rows: readonly ForecastLocalPreviewRowView[],
  query: string,
): ForecastLocalPreviewRowView[] {
  const q = normalizeExtensionSearch(query);
  if (!q) return [...rows];
  return rows.filter(
    (row) => row.stringLabel.includes(q) || row.extension.toLowerCase().includes(q),
  );
}

export function sortForecastPreviewRows(
  rows: readonly ForecastLocalPreviewRowView[],
  sortKey: ForecastLocalPreviewSortKey,
  sortDir: ForecastLocalPreviewSortDir,
): ForecastLocalPreviewRowView[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "extension") {
      cmp = a.stringLabel.localeCompare(b.stringLabel);
    } else if (sortKey === "measured") {
      cmp = a.measuredDomainCount - b.measuredDomainCount;
    } else {
      // expected: nulls always after numeric estimates
      const aNull = a.expected == null;
      const bNull = b.expected == null;
      if (aNull && bNull) cmp = 0;
      else if (aNull) cmp = 1; // a after b regardless of dir intent for null placement
      else if (bNull) cmp = -1;
      else cmp = (a.expected ?? 0) - (b.expected ?? 0);
      // When comparing two numbers, apply direction; when one is null, keep nulls after.
      if (!aNull && !bNull) cmp *= dir;
      return cmp || a.stringLabel.localeCompare(b.stringLabel);
    }
    cmp *= dir;
    return cmp || a.stringLabel.localeCompare(b.stringLabel);
  });
}

export function paginateForecastPreviewRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = FORECAST_LOCAL_PREVIEW_PAGE_SIZE,
): { page: number; pageCount: number; rows: T[] } {
  const safePageSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageCount,
    rows: rows.slice(start, start + safePageSize),
  };
}

export function formatUnknownBoolean(value: boolean | null): "Yes" | "No" | "Unknown" {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}
