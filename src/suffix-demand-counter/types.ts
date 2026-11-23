/**
 * RIH-FCAST-03 / 03A — Offline ActiveDNS suffix-demand counter types.
 *
 * Aggregate output is compatible with SuffixDemandEvidence field shapes
 * without changing the production forecast data contract.
 */

export const ACTIVEDNS_SOURCE_NAME = "ActiveDNS";
export const ACTIVEDNS_SOURCE_URL = "https://activedns.net/";

/** Initial mid-panel TLDs from RIH-FCAST-02. */
export const MID_PANEL_TLDS = ["net", "org", "info", "biz", "app", "dev"] as const;
export type MidPanelTld = (typeof MID_PANEL_TLDS)[number];

export type CandidateMode = "example-list" | "applications-document-v2";

export type CandidateProvenance = {
  mode: CandidateMode;
  /** Absolute or operator-supplied path for applications mode; null for example-list. */
  applicationsDocumentPath: string | null;
  snapshotId: string | null;
  snapshotContentHash: string | null;
  publishedAt: string | null;
  payloadMode: string | null;
  documentSha256: string | null;
  totalForecastUnits: number;
  eligibleCandidateCount: number;
  brandExcludedCount: number;
  brandExcludedLabels: string[];
  note: string;
};

export type PanelFileSpec = {
  /** ASCII TLD without leading dot, e.g. "net". */
  tld: string;
  /** Basename of the gzip list file expected under the input directory. */
  filename: string;
  /** SHA-256 (hex) of the gzip-compressed file bytes. */
  sha256: string;
  /** Declared record count from the ActiveDNS index / header Domains field. */
  declaredDomains: number;
};

export type PanelManifest = {
  manifestId: string;
  sourceName: string;
  sourceUrl: string;
  /** Snapshot calendar date as YYYY-MM-DD (matches file header Generated). */
  snapshotDate: string;
  /** Optional human note for operators. */
  description?: string;
  panel: PanelFileSpec[];
};

export type FileVerification = {
  tld: string;
  filename: string;
  path: string;
  expectedSha256: string;
  actualSha256: string;
  sha256Match: boolean;
  expectedDeclaredDomains: number;
  headerGenerated: string | null;
  headerTld: string | null;
  headerDomains: number | null;
  headerOk: boolean;
  acceptedRecords: number;
  rejectedRecords: number;
  duplicateRecords: number;
  headerLines: number;
};

export type MatchingPolicy = {
  normalization: "ascii-lowercase-ldh";
  comparison: "case-insensitive";
  rule: "second-level-label equals candidate OR literal endsWith candidate";
  implementation: "reversed-suffix-trie";
  duplicateDetection: "sorted-adjacent-previous-domain";
  semanticKeywordAnalysis: false;
  note: string;
};

export type StringDemandCount = {
  stringLabel: string;
  domainCount: number;
  contested: boolean;
  brandExcluded: false;
  /** Field-compatible with SuffixDemandEvidence when status is available. */
  suffixDemandEvidence: {
    status: "available";
    domainCount: number;
    sourceId: string;
    sourceLabel: string;
    coverageNote: string;
  };
};

export type SuffixDemandAggregate = {
  schemaVersion: 2;
  status: "complete";
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  snapshotDate: string;
  manifestId: string;
  sourceId: string;
  referencePanelTlds: string[];
  candidateProvenance: CandidateProvenance;
  matching: MatchingPolicy;
  files: FileVerification[];
  processing: {
    acceptedRecords: number;
    rejectedRecords: number;
    duplicateRecords: number;
    headerLines: number;
  };
  strings: StringDemandCount[];
  limitations: string[];
  /** Explicit: these panel counts are not full-market registration forecasts. */
  forecastConversion: {
    applied: false;
    reason: string;
  };
};

export type CounterFailure = {
  schemaVersion: 2;
  status: "failed";
  reason: string;
  manifestId: string | null;
  details: string[];
};

export class SuffixDemandCounterError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "SuffixDemandCounterError";
    this.details = details;
  }
}
