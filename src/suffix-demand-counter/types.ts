/**
 * RIH-FCAST-03 — Offline ActiveDNS suffix-demand counter types.
 *
 * Aggregate output is compatible with SuffixDemandEvidence field shapes
 * without changing the production forecast data contract.
 */

export const ACTIVEDNS_SOURCE_NAME = "ActiveDNS";
export const ACTIVEDNS_SOURCE_URL = "https://activedns.net/";

/** Initial mid-panel TLDs from RIH-FCAST-02. */
export const MID_PANEL_TLDS = ["net", "org", "info", "biz", "app", "dev"] as const;
export type MidPanelTld = (typeof MID_PANEL_TLDS)[number];

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
  semanticKeywordAnalysis: false;
  note: string;
};

export type StringDemandCount = {
  stringLabel: string;
  domainCount: number;
  /** Field-compatible with SuffixDemandEvidence when status is available. */
  suffixDemandEvidence: {
    status: "available";
    domainCount: number;
    sourceId: string;
    sourceLabel: string;
    coverageNote: string;
  };
};

export type CandidateProvenance = {
  mode: "examples" | "explicit-list" | "applications-document-v2";
  candidateListId: string;
  candidateListSha256: string;
  candidateCount: number;
  excludedBrandStrings: number;
  brandExclusionPolicy: string;
  applicationSnapshot: null | {
    snapshotId: string;
    snapshotContentHash: string;
    artifactSha256: string;
    rawSourceSha256: string;
    payloadVersion: string;
    publishedAt: string;
    retrievedAt: string;
    sourceName: string;
    sourceUrl: string;
    officialApplications: number;
    representedApplications: number;
  };
};

export type SuffixDemandAggregate = {
  schemaVersion: 1;
  status: "complete";
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  snapshotDate: string;
  manifestId: string;
  sourceId: string;
  candidateProvenance: CandidateProvenance;
  referencePanelTlds: string[];
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
  schemaVersion: 1;
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
