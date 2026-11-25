/**
 * RIH-FCAST-03 / 03A / 04B — Offline ActiveDNS suffix-demand counter types.
 *
 * Aggregate output remains compatible with SuffixDemandEvidence field shapes
 * without changing the production forecast data contract.
 */

export const ACTIVEDNS_SOURCE_NAME = "ActiveDNS";
export const ACTIVEDNS_SOURCE_URL = "https://activedns.net/";

/** Initial mid-panel TLDs from RIH-FCAST-02. */
export const MID_PANEL_TLDS = ["net", "org", "info", "biz", "app", "dev"] as const;
export type MidPanelTld = (typeof MID_PANEL_TLDS)[number];

export type CandidateMode =
  | "example-list"
  | "applications-document-v2"
  | "observed-proposed-strings";

export type ObservedStringOrigin =
  | "applied-string"
  | "replacement-string"
  | "known-excluded-primary-string";

export type ObservedCandidateRecord = {
  stringLabel: string;
  origins: ObservedStringOrigin[];
  sourceApplicationIds: string[];
  /** True/false when observed on a normalized Application; null when unknown (e.g. WDO). */
  brandDesignationObserved: boolean | null;
  /** True/false when contention overlay observed; null when unknown. */
  contestedObserved: boolean | null;
  fromNormalizedApplication: boolean;
  fromKnownExcluded: boolean;
};

export type UnmeasuredCandidate = {
  rawLabel: string;
  reason: string;
  origins: ObservedStringOrigin[];
  sourceApplicationIds: string[];
};

export type CandidateProvenance = {
  mode: CandidateMode;
  /** Absolute or operator-supplied path for document modes; null for example-list. */
  applicationsDocumentPath: string | null;
  snapshotId: string | null;
  snapshotContentHash: string | null;
  publishedAt: string | null;
  payloadMode: string | null;
  documentSha256: string | null;
  /** Forecast-unit count for applications-document-v2; observed measurable count otherwise. */
  totalForecastUnits: number;
  eligibleCandidateCount: number;
  /** applications-document-v2 only: Brand proxy exclusions from forecast eligibility. */
  brandExcludedCount: number;
  brandExcludedLabels: string[];
  note: string;
  /** Explicit census posture — never infer complete from domain-scan success. */
  applicationCensusCoverage?: {
    status: "not-applicable" | "partial-observed" | "complete-asserted";
    completeness: string | null;
    observedApplicationRecords: number | null;
    officialApplications: number | null;
    knownExcludedRecordCount: number | null;
    assertsCompleteRoundInventory: false;
  };
  observedInventory?: {
    measurableCount: number;
    unmeasuredCount: number;
    fromNormalizedApplicationCount: number;
    fromKnownExcludedCount: number;
    brandDesignationObservedTrueCount: number;
    brandDesignationUnknownCount: number;
    origins: {
      appliedString: number;
      replacementString: number;
      knownExcludedPrimaryString: number;
    };
  };
  unmeasuredCandidates?: UnmeasuredCandidate[];
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
  /** Observed contention when known; null when unknown (must not be inferred false). */
  contested: boolean | null;
  /**
   * Legacy forecast-eligibility Brand exclusion flag.
   * Always false for measured rows in observed-proposed-strings mode (Brand is not suppressed).
   */
  brandExcluded: false;
  brandDesignationObserved: boolean | null;
  measurementStatus: "measured";
  origins?: ObservedStringOrigin[];
  fromNormalizedApplication?: boolean;
  fromKnownExcluded?: boolean;
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
  schemaVersion: 3;
  /**
   * Domain-scan completion only. Must not be read as proof of a complete
   * ICANN application census — see applicationCensus / candidateProvenance.
   */
  status: "complete";
  domainScan: {
    status: "complete";
    referencePanelTlds: string[];
    filesVerified: number;
  };
  applicationCensus: {
    status: "not-applicable" | "partial-observed" | "complete-asserted";
    assertsCompleteRoundInventory: false;
    note: string;
  };
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
  unmeasuredStrings: UnmeasuredCandidate[];
  limitations: string[];
  /** Explicit: these panel counts are not full-market registration forecasts. */
  forecastConversion: {
    applied: false;
    reason: string;
  };
};

export type CounterFailure = {
  schemaVersion: 3;
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
