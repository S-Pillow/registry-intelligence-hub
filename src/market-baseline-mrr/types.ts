export const MRR_TRANSACTIONS_SCHEMA_VERSION = "market-baseline-mrr-transactions/1.0.0";
export const MRR_PARSER_VERSION = "market-baseline-mrr-transactions-parser/1.0.0";
export const MRR_INDEX_URL = "https://www.icann.org/resources/pages/registry-reports";
export const MRR_USER_AGENT = "RIH-market-baseline-mrr/1.0 (+research; read-only)";
export const MRR_OUTCOMES_SCHEMA_VERSION = "market-baseline-mrr-request-outcomes/1.0.0";
/** Legacy durable receipt without explicit runScope. */
export const MRR_RUN_MANIFEST_SCHEMA_VERSION_V1_0 =
  "market-baseline-mrr-run-manifest/1.0.0" as const;
/** Current durable receipt including authoritative acquisition runScope. */
export const MRR_RUN_MANIFEST_SCHEMA_VERSION =
  "market-baseline-mrr-run-manifest/1.1.0" as const;
export const MRR_DISCOVERY_CACHE_SCHEMA_VERSION =
  "market-baseline-mrr-discovery-cache/1.0.0" as const;
/** Stage-D history contract: probe period + 23 prior calendar months. */
export const STAGE_D_HISTORY_PERIOD_COUNT = 24;

export type AcquisitionRunScopeMode = "FULL_STAGE_D" | "BOUNDED";

export type AcquisitionDiscoverySource =
  | "ICANN_FULL_DISCOVERY"
  | "QUALIFIED_DISCOVERY_CACHE"
  | "LEGACY_UNQUALIFIED_CACHE"
  | "CALLER_SUPPLIED";

export type AcquisitionHistoryMode = "FULL_24_MONTH" | "SKIPPED_OR_BOUNDED";

export type AcquisitionIntendedProbeUniverse = "ALL_DISCOVERED_TLDS" | "BOUNDED";

/**
 * Authoritative acquisition scope recorded at orchestration time.
 * Internal completeness against discoveredTldCount does not imply FULL_STAGE_D.
 */
export type AcquisitionRunScope = {
  mode: AcquisitionRunScopeMode;
  discoverySource: AcquisitionDiscoverySource;
  probeLimit: number | null;
  historyMode: AcquisitionHistoryMode;
  intendedProbeUniverse: AcquisitionIntendedProbeUniverse;
  discoveredTldCount: number;
  probedTldCount: number;
};

export type DiscoveryCacheProvenance = {
  schemaVersion: typeof MRR_DISCOVERY_CACHE_SCHEMA_VERSION;
  source: "ICANN_FULL_DISCOVERY";
  qualifiedForFullStageD: true;
};

export type ReportingPeriod = string; // YYYY-MM

export type AcquisitionOutcome =
  | "SUCCESS"
  | "MISSING_REPORT"
  | "DOWNLOAD_FAILED"
  | "UNSUPPORTED_SCHEMA"
  | "PARSE_FAILED"
  | "VALIDATION_FAILED"
  | "NORMALIZATION_FAILED";

export type AcquisitionPhase = "PROBE" | "HISTORY";

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

/** Intrinsic TLD-month metrics — pure over a single Transactions report. */
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
};

/** Cross-snapshot temporal measures — never part of normalized content hash. */
export type TldMarketSeriesTemporal = {
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  totalDomains: number;
  previousPeriod: ReportingPeriod;
  yearAgoPeriod: ReportingPeriod;
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

/** Explicit current revision pointer for a TLD×period (not lexical hash order). */
export type PeriodCurrentRevision = {
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  sourceUrl: string;
  currentRawSha256: string;
  currentNormalizedSha256: string;
  previousRawSha256: string | null;
  retrievedAt: string;
  etag?: string;
  lastModified?: string;
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

export type AcquisitionRequestOutcome = {
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  phase: AcquisitionPhase;
  outcome: AcquisitionOutcome;
  resourcePageUrl: string;
  sourceUrl?: string;
  rawSha256?: string;
  normalizedContentSha256?: string;
  totalDomains?: number;
  reusedFromCache: boolean;
  revalidated: boolean;
  revisionDetected: boolean;
  bytesDownloaded: number;
  error?: string;
};

export type AcquisitionOutcomesArtifact = {
  schemaVersion: typeof MRR_OUTCOMES_SCHEMA_VERSION;
  runId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  requests: AcquisitionRequestOutcome[];
};

export type SelectionReason =
  | "TOP_100"
  | "CONTROL_SET"
  | "RIH_DELEGATED_APPLICATION_OVERLAP";

export type UniverseMember = {
  tldAsciiLabel: string;
  reasons: SelectionReason[];
};

export type OutcomeCountBucket = {
  success: number;
  missing: number;
  downloadFailed: number;
  unsupportedSchema: number;
  parseFailed: number;
  validationFailed: number;
  normalizationFailed: number;
};

export type AcquisitionRunManifest = {
  schemaVersion:
    | typeof MRR_RUN_MANIFEST_SCHEMA_VERSION
    | typeof MRR_RUN_MANIFEST_SCHEMA_VERSION_V1_0;
  runId: string;
  startedAt: string;
  completedAt: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  discoveredTldCount: number;
  probe: OutcomeCountBucket;
  history: OutcomeCountBucket;
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
  outcomesArtifactPath: string;
  outcomesArtifactSha256: string;
  resultStatus: "SUCCESS" | "PARTIAL" | "STOPPED_THROTTLED" | "FAILED";
  throttlingObserved: boolean;
  durationMs: number;
  notes: string[];
  /**
   * Required for schema 1.1.0+. Absent on legacy 1.0.0 manifests
   * (treated as LEGACY_UNKNOWN for publication auto-selection).
   */
  runScope?: AcquisitionRunScope;
};
