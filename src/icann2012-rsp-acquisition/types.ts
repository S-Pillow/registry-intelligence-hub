export interface RspPilotManifestEntry {
  applicationId: string;
  selectionReason: string;
  /** Reconciliation / QA label only — not asserted 2012 RSP fact. */
  validationLeadProviderLabel?: string;
  gtldresultAcId?: number | null;
}

export interface RspPilotManifest {
  manifestVersion: "icann2012-rsp-pilot-manifest/1.0.0";
  bundleId: string;
  pilotBatchSize: number;
  revealDayCsvSnapshotId: string;
  entries: RspPilotManifestEntry[];
}

export type ArtifactPurpose = "TEST_ONLY" | "EVIDENCE";
export type ApprovalState = "DRAFT" | "APPROVED";

/** Steward-approved mapping scopes (P0.1 audit contract). */
export type RspMappingScope =
  | "ROUND_WIDE_EXACT"
  | "PILOT_ONLY_EXACT"
  | "pilot-25"
  | (string & {});

export type MappingSourceClass =
  | "GRID_SNAPSHOT_EXTRACT"
  | "STATUS_GRID"
  | "DETAILS_PAGE_PROBE"
  | "STEWARD_APPROVED_MANUAL"
  | "PROBE_VERIFIED"
  | "SYNTHETIC_TEST"
  | "PLACEHOLDER"
  | "TEST_FIXTURE"
  | "SYNTHETIC";

export interface RspMappingEntry {
  applicationId: string;
  gtldresultAcId: number | null;
  mappingSourceClass: MappingSourceClass;
  evidenceSnapshotId?: string | null;
  sourceUrl?: string;
  evidenceContentSha256?: string;
  notes?: string;
}

export interface Registry2012RspMappingArtifact {
  mappingVersion: "registry-2012-rsp-mapping/1.0.0";
  artifactPurpose: ArtifactPurpose;
  approvalState: ApprovalState;
  bundleId: string;
  scope: RspMappingScope;
  entries: RspMappingEntry[];
}

/** @deprecated Use Registry2012RspMappingArtifact — kept for migration tests only. */
export interface GtldresultPilotMappingEntry {
  applicationId: string;
  gtldresultAcId: number | null;
  mappingSource: string;
  notes?: string;
}

/** @deprecated Use registry-2012-rsp-mapping/1.0.0 */
export interface GtldresultPilotMappingFile {
  mappingVersion: "icann2012-rsp-pilot-gtldresult-mapping/1.0.0";
  entries: GtldresultPilotMappingEntry[];
}

export interface GtldresultApplicationIndexEntry {
  applicationId: string;
  gtldresultAcId: number;
  stringLabel?: string;
  applicantQaLabel?: string;
  portionUrl: string;
  detailsUrl: string;
}

export interface GtldresultApplicationIndex {
  indexVersion: "icann2012-gtldresult-application-index/1.0.0";
  expectedApplicationCount: number;
  entries: GtldresultApplicationIndexEntry[];
}

export interface AcquisitionCheckpointEntry {
  applicationId: string;
  contentSha256: string;
  completedAt: string;
  gtldresultAcId: number;
  snapshotId?: string;
}

export interface AcquisitionCheckpoint {
  checkpointVersion: "icann2012-rsp-acquisition-checkpoint/1.0.0";
  batchId: string;
  lastCompletedApplicationId: string | null;
  completed: AcquisitionCheckpointEntry[];
  runHost?: string;
}

export type QuarantineReason =
  | "transport-exhausted"
  | "missing-public-portion"
  | "oversize-response"
  | "incomplete-portion-q23"
  | "checksum-unstable"
  | "application-id-mismatch"
  | "mapping-required";

export interface QuarantineRecord {
  applicationId: string;
  reason: QuarantineReason;
  detail: string;
  quarantinedAt: string;
}

export interface RawSnapshotRecord {
  snapshotId: string;
  sourceId: string;
  requestedUrl: string;
  resolvedUrl?: string;
  retrievedAt?: string;
  provenance?: {
    contentSha256?: string;
  };
}

export interface ViewstatusGridRow {
  gtldresultAcId: number;
  tasApplicationId: string;
  stringLabel?: string;
}

export interface DryRunFetchPlan {
  applicationId: string;
  gtldresultAcId: number | null;
  portionUrl: string | null;
  detailsUrl: string | null;
  stagingPortionPath: string;
  stagingMetadataPath: string;
  mappingRequired: boolean;
  notes: string[];
}

export interface DryRunReport {
  mode: "dry-run";
  authorized: false;
  limits: typeof import("./constants").RSP_ACQUISITION_LIMITS;
  stagingRoot: string;
  plans: DryRunFetchPlan[];
}

/**
 * SAFE_DERIVED pager hop record. Booleans only for session observations.
 * Never store cookie or token values.
 */
export interface PersistedPagerTransaction {
  serverProvidedHref: string | null;
  pagerRequestedUrl: string | null;
  pagerStatus: number | null;
  redirectLocation: string | null;
  redirectCount: number;
  finalUrl: string | null;
  sessionCookieSent: boolean;
  intermediateSetCookieObserved: boolean;
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
}

export interface ViewstatusPageDiagnostics {
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
  parsedRowCount: number;
  quarantinedBlockCount: number;
  nextPageHref: string | null;
  paginationControlDrift?: boolean;
  /** Logical pager label of the active control, when established. */
  currentPage?: number | null;
  /** Logical adjacent page (current+1) when a server href was selected. */
  nextLogicalPage?: number | null;
  /**
   * SAFE_DERIVED copy of the server-provided next href.
   * Sensitive query values are redacted. Not a manufactured pager URL.
   */
  serverProvidedHref?: string | null;
  /**
   * SAFE_DERIVED absolute URL the crawler will request for the next page.
   * Root-relative `/applicationstatus/...` hrefs are not remounted.
   * Sensitive query values are redacted.
   */
  effectiveRequestUrl?: string | null;
  /** Present when this page was fetched through a status-grid pager hop. */
  pagerTransaction?: PersistedPagerTransaction | null;
  paginationDriftDetail?: string | null;
  pageKind?: "STATUS_GRID" | "ICANN_ERROR_PAGE" | "UNKNOWN_NON_GRID";
}

export interface MappingLivePageRecord {
  pageOrdinal: number;
  snapshotId: string;
  contentSha256: string;
  resolvedUrl: string;
  diagnostics: ViewstatusPageDiagnostics;
}

export interface CanonicalReconciliationStats {
  expectedCount: number;
  mappedCount: number;
  missingApplicationIds: string[];
  extraApplicationIds: string[];
  duplicateApplicationIds: string[];
  duplicateGtldresultAcIds: Array<{ gtldresultAcId: number; applicationIds: string[] }>;
  exact: boolean;
}

export interface MappingLiveCheckpoint {
  checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0";
  runId: string;
  corpusContentHash: string;
  state: "running" | "completed" | "failed";
  stopReason?: string;
  lastCompletedPageOrdinal: number;
  pages: MappingLivePageRecord[];
  /** applicationId → gtldresultAcId accumulated so far */
  mappings: Record<string, number>;
  /** Page ordinal where each applicationId was parsed */
  applicationPageOrdinal: Record<string, number>;
}

export interface ForceNewRunDisposition {
  archivedCheckpointPath?: string;
  priorRunId?: string;
  priorCheckpointState?: string;
  preservedRunDirectories: string[];
  operatorWarnings: string[];
}

export interface MappingLiveResult {
  mode: "mapping-live";
  runId: string;
  stagingRoot: string;
  pagesFetched: number;
  reconciliation: CanonicalReconciliationStats;
  exact: boolean;
  approvalState: "DRAFT";
  artifactPurpose: "EVIDENCE";
  mappingArtifactPath: string;
  checkpointPath: string;
  stoppedEarly: boolean;
  stopReason?: string;
  forceNewRunDisposition?: ForceNewRunDisposition;
}
