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

export type MappingSourceClass =
  | "GRID_SNAPSHOT_EXTRACT"
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
  scope: string;
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
