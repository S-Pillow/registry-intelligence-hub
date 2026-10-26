export const MRR_TRANSACTIONS_SCHEMA_VERSION = "market-baseline-mrr-transactions/1.0.0";
export const MRR_PARSER_VERSION = "market-baseline-mrr-transactions-parser/1.0.0";
export const MRR_INDEX_URL = "https://www.icann.org/resources/pages/registry-reports";
export const MRR_USER_AGENT = "RIH-market-baseline-mrr/1.0 (+research; read-only)";

export type ReportingPeriod = string; // YYYY-MM

export type AcquisitionOutcome =
  | "SUCCESS"
  | "MISSING_REPORT"
  | "DOWNLOAD_FAILED"
  | "UNSUPPORTED_SCHEMA"
  | "PARSE_FAILED"
  | "VALIDATION_FAILED"
  | "NORMALIZATION_FAILED";

export type RegistrarClassification =
  | "TOTALS"
  | "ACCREDITED_OR_STANDARD"
  | "SPECIAL_REGISTRY_OR_SYSTEM"
  | "UNKNOWN_OR_UNCLASSIFIED";

export type SchemaProfileId = "spec3-core-39" | "com-extended-41";

export type TermCounts = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  "6": number;
  "7": number;
  "8": number;
  "9": number;
  "10": number;
};

export type NormalizedRegistrarRow = {
  ianaRegistrarId: string;
  registrarName: string;
  classification: RegistrarClassification;
  totalDomains: number;
  totalNameservers: number;
  netAddsByTerm: TermCounts;
  netRenewsByTerm: TermCounts;
  transferGainingSuccessful: number;
  transferGainingNacked: number;
  transferLosingSuccessful: number;
  transferLosingNacked: number;
  transferDisputedWon: number;
  transferDisputedLost: number;
  transferDisputedNodecision: number;
  deletedDomainsGrace: number;
  deletedDomainsNograce: number;
  restoredDomains: number;
  restoredNoreport: number;
  agpExemptionRequests: number;
  agpExemptionsGranted: number;
  agpExemptedDomains: number;
  attemptedAdds: number;
  consolidateTransactionDays?: number;
  consolidateTransactions?: number;
};

export type NormalizedTotals = {
  totalDomains: number;
  totalNameservers: number;
  netAddsByTerm: TermCounts;
  netRenewsByTerm: TermCounts;
  transferGainingSuccessful: number;
  transferGainingNacked: number;
  transferLosingSuccessful: number;
  transferLosingNacked: number;
  transferDisputedWon: number;
  transferDisputedLost: number;
  transferDisputedNodecision: number;
  deletedDomainsGrace: number;
  deletedDomainsNograce: number;
  restoredDomains: number;
  restoredNoreport: number;
  agpExemptionRequests: number;
  agpExemptionsGranted: number;
  agpExemptedDomains: number;
  attemptedAdds: number;
  consolidateTransactionDays?: number;
  consolidateTransactions?: number;
};

export type UnavailableMetric = { available: false; reason: string };
export type AvailableNumber = { available: true; value: number };

export type OptionalMetric = AvailableNumber | UnavailableMetric;

export type TldMonthMetrics = {
  totalDomains: number;
  netAddsCount: number;
  netRenewCount: number;
  deleteCount: number;
  transferGainingCount: number;
  transferLosingCount: number;
  registrarBreadth: number;
  topRegistrarShare: OptionalMetric;
  top5RegistrarShare: OptionalMetric;
  accreditedRegistrarDomains: number;
  specialOrSystemDomains: number;
  netDomainBaseChange: OptionalMetric;
  monthOverMonthGrowth: OptionalMetric;
  yearOverYearGrowth: OptionalMetric;
};

export type NormalizedTransactionsSnapshot = {
  schemaVersion: typeof MRR_TRANSACTIONS_SCHEMA_VERSION;
  snapshotId: string;
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  sourceUrl: string;
  resourcePageUrl: string;
  rawSha256: string;
  normalizedContentSha256: string;
  parserVersion: typeof MRR_PARSER_VERSION;
  schemaProfileVersion: SchemaProfileId;
  revisionOfRawSha256: string | null;
  totals: NormalizedTotals;
  registrars: NormalizedRegistrarRow[];
  metrics: TldMonthMetrics;
  warnings: string[];
};

/** Full on-disk envelope; retrievedAt is outside content hash. */
export type NormalizedTransactionsEnvelope = {
  snapshot: NormalizedTransactionsSnapshot;
  retrievedAt: string;
  asOfDate?: string;
  probeReportingPeriod?: ReportingPeriod;
};

export type DiscoveredTldPage = {
  tldAsciiLabel: string;
  resourcePageUrl: string;
  transactionsPeriods: ReportingPeriod[];
  activityPeriods: ReportingPeriod[];
  transactionsByPeriod: Record<ReportingPeriod, string>;
  activityByPeriod: Record<ReportingPeriod, string>;
};

export type ProbeTldResult = {
  tldAsciiLabel: string;
  resourcePageUrl: string;
  reportingPeriod: ReportingPeriod;
  outcome: AcquisitionOutcome;
  sourceUrl?: string;
  rawSha256?: string;
  normalizedContentSha256?: string;
  totalDomains?: number;
  error?: string;
};

export type SelectionReason =
  | "TOP_100"
  | "CONTROL_SET"
  | "RIH_DELEGATED_APPLICATION_OVERLAP";

export type UniverseMember = {
  tldAsciiLabel: string;
  reasons: SelectionReason[];
};

export type AcquisitionRunManifest = {
  schemaVersion: "market-baseline-mrr-run-manifest/1.0.0";
  runId: string;
  startedAt: string;
  completedAt: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  discoveredTldCount: number;
  probe: {
    success: number;
    missing: number;
    downloadFailed: number;
    unsupportedSchema: number;
    parseFailed: number;
    validationFailed: number;
    normalizationFailed: number;
  };
  top100: string[];
  controlSet: string[];
  delegatedOverlaps: string[];
  historyUniverse: UniverseMember[];
  historyPeriodCount: number;
  filesRequested: number;
  filesDownloaded: number;
  filesReusedFromCache: number;
  missingReports: number;
  schemaFailures: number;
  validationFailures: number;
  normalizationFailures: number;
  bytesDownloaded: number;
  rawHashes: string[];
  normalizedHashes: string[];
  sourceRevisionsDetected: number;
  resultStatus: "SUCCESS" | "PARTIAL" | "STOPPED_THROTTLED" | "FAILED";
  throttlingObserved: boolean;
  durationMs: number;
  notes: string[];
};
