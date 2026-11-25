/**
 * RIH-FCAST-05A — Offline experimental registration-forecast preview types.
 *
 * Analysis artifacts only. Not a product export endpoint or production publication.
 */

import type { ForecastScenarioRange } from "@/lib/registration-forecast";

export type ForecastPreviewRowStatus = "estimated" | "conversion_not_recommended";

export type ForecastPreviewRow = {
  stringLabel: string;
  measuredDomainCount: number;
  status: ForecastPreviewRowStatus;
  compoundWordCandidate: boolean;
  range: ForecastScenarioRange | null;
  statusNote: string;
  brandDesignationObserved: boolean | null;
  contested: boolean | null;
  fromNormalizedApplication: boolean | null;
  fromKnownExcluded: boolean | null;
  origins: string[] | null;
};

export type ForecastPreviewDocument = {
  schemaVersion: 1;
  kind: "experimental-registration-forecast-preview";
  status: "complete";
  horizonLabel: string;
  disclaimer: string;
  conversionFactors: {
    conservative: number;
    expected: number;
    optimistic: number;
  };
  conversionNote: string;
  sourceAggregate: {
    path: string;
    sha256: string;
    schemaVersion: number;
    status: string;
    snapshotDate: string;
    manifestId: string;
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    attribution: string;
    referencePanelTlds: string[];
    domainScan: unknown;
    applicationCensus: unknown;
    candidateProvenance: unknown;
    processing: unknown;
  };
  summary: {
    measuredStringCount: number;
    estimatedStringCount: number;
    conversionNotRecommendedCount: number;
    zeroMeasuredDemandCount: number;
  };
  limitations: string[];
  strings: ForecastPreviewRow[];
};

export class ForecastPreviewError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "ForecastPreviewError";
    this.details = details;
  }
}
