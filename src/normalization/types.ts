/**
 * Round-neutral normalization types — lineage, entities, reconciliation, and value semantics.
 *
 * Human-readable design: Project Agent Store docs/domain-model-and-normalization.md
 */

export const PARSER_VERSION = "icann2012-fixture-parser/1.0.0";
export const NORMALIZER_VERSION = "icann2012-normalizer/1.0.0";
export const OVERRIDE_REGISTRY_VERSION = "override-registry/1.0.0";
export const BUILD_MANIFEST_VERSION = "normalization-build/1.0.0";

/** How a field value should be interpreted when absent or partial. */
export type ValueSemantics =
  | "known"
  | "unknown" // source did not publish
  | "unavailable" // not reachable in this build (rights, fetch gap)
  | "not-applicable" // does not apply to this record type
  | "unresolved"; // present but could not be normalized deterministically

export type ReconciliationState =
  | "NORMALIZED"
  | "MATCHED"
  | "CONFLICT"
  | "MISSING_REFERENCE"
  | "AMBIGUOUS_ENTITY"
  | "SOURCE_ONLY"
  | "REQUIRES_REVIEW";

export interface RedirectHop {
  fromUrl: string;
  toUrl: string;
  httpStatus: number;
  observedAt: string;
}

export interface RawSnapshotRef {
  snapshotId: string;
  sourceId: string;
  sourceVersion: number;
  sha256: string;
  byteCount: number;
  retrievedAt: string;
  effectiveAt: string | null;
  redirectChain: RedirectHop[];
}

export interface RecordLocator {
  bundleId: string;
  sourceFile: string;
  lineNumber: number | null;
  recordKey: string;
}

export interface ParsedRecord {
  parserVersion: string;
  locator: RecordLocator;
  recordType: string;
  contentHash: string;
  rawSnapshotRef: RawSnapshotRef;
  parsedAt: string;
  payload: Record<string, unknown>;
}

export interface ObservationProvenance {
  parsedRecordHash: string;
  fieldPath: string;
  observedAt: string;
  effectiveAt: string | null;
}

export interface FieldValue<T = unknown> {
  value: T | null;
  semantics: ValueSemantics;
  provenance: ObservationProvenance[];
}

export interface Observation {
  observationId: string;
  entityKind: EntityKind;
  naturalKey: string;
  facts: Record<string, FieldValue>;
  parsedRecordHash: string;
  parserVersion: string;
}

export type EntityKind =
  | "round"
  | "application"
  | "applied-string"
  | "tld"
  | "applicant"
  | "organization"
  | "registry-operator"
  | "contention-set";

export interface LineageLink {
  rawSnapshotSha256: string;
  parsedRecordHash: string;
  observationIds: string[];
  overrideOpIds: string[];
}

export interface NormalizedEntityBase {
  entityKind: EntityKind;
  entityId: string;
  reconciliationState: ReconciliationState;
  reconciliationNotes: string[];
  lineage: LineageLink;
  normalizerVersion: string;
  normalizedAt: string;
}

export interface RoundEntity extends NormalizedEntityBase {
  entityKind: "round";
  label: string;
  programYear: number;
}

export interface ApplicationEntity extends NormalizedEntityBase {
  entityKind: "application";
  applicationId: FieldValue<string>;
  roundId: string;
  appliedStringId: FieldValue<string>;
  applicantId: FieldValue<string>;
  contentionSetId: FieldValue<string | null>;
  priorityNumber: FieldValue<number | null>;
}

export interface AppliedStringEntity extends NormalizedEntityBase {
  entityKind: "applied-string";
  uLabel: FieldValue<string>;
  aLabel: FieldValue<string | null>;
  isIdn: FieldValue<boolean>;
}

export interface TldEntity extends NormalizedEntityBase {
  entityKind: "tld";
  label: FieldValue<string>;
}

export interface ApplicantEntity extends NormalizedEntityBase {
  entityKind: "applicant";
  legalName: FieldValue<string>;
  jurisdiction: FieldValue<string | null>;
}

export interface OrganizationCandidate {
  candidateId: string;
  displayName: string;
  confidence: "low" | "medium";
  rationale: string;
  sourceObservationIds: string[];
}

export interface OrganizationEntity extends NormalizedEntityBase {
  entityKind: "organization";
  /** Conservative resolution: candidates only, never a single forced match. */
  candidates: OrganizationCandidate[];
}

export interface RegistryOperatorEntity extends NormalizedEntityBase {
  entityKind: "registry-operator";
  operatorName: FieldValue<string>;
  relatedTldIds: FieldValue<string[]>;
}

export interface ContentionSetEntity extends NormalizedEntityBase {
  entityKind: "contention-set";
  setId: FieldValue<string>;
  applicationIds: FieldValue<string[]>;
  matchKind: FieldValue<"exact" | "similarity" | "unknown">;
}

export type NormalizedEntity =
  | RoundEntity
  | ApplicationEntity
  | AppliedStringEntity
  | TldEntity
  | ApplicantEntity
  | OrganizationEntity
  | RegistryOperatorEntity
  | ContentionSetEntity;

export type OverrideOperation =
  | {
      opId: string;
      opVersion: 1;
      kind: "set-field";
      entityKind: EntityKind;
      entityId: string;
      fieldPath: string;
      value: unknown;
      reason: string;
      author: string;
      createdAt: string;
    }
  | {
      opId: string;
      opVersion: 1;
      kind: "annotate-reconciliation";
      entityKind: EntityKind;
      entityId: string;
      reconciliationState: ReconciliationState;
      note: string;
      author: string;
      createdAt: string;
    };

export interface FixtureBundleDefinition {
  id: string;
  version: number;
  label: string;
  /** Truthful scope — not a full 2012 round export. */
  coverageNote: string;
  roundProgramYear: number;
  fixtureRoot: string;
  sourceFiles: string[];
}

export interface ReconciliationRow {
  entityKind: EntityKind;
  entityId: string;
  reconciliationState: ReconciliationState;
  fieldPath: string | null;
  detail: string;
  sourceObservationCount: number;
}

export interface NormalizationQualityReport {
  reportVersion: "1.0.0";
  generatedAt: string;
  bundleId: string;
  bundleVersion: number;
  parserVersion: string;
  normalizerVersion: string;
  overrideRegistryVersion: string;
  inputContentHash: string;
  buildId: string;
  entityCounts: Record<EntityKind, number>;
  reconciliationSummary: Record<ReconciliationState, number>;
  rows: ReconciliationRow[];
  limitations: string[];
}

export interface BuildManifest {
  manifestVersion: typeof BUILD_MANIFEST_VERSION;
  buildId: string;
  bundleId: string;
  bundleVersion: number;
  parserVersion: string;
  normalizerVersion: string;
  overrideRegistryVersion: string;
  inputContentHash: string;
  outputContentHash: string;
  builtAt: string;
  entityCount: number;
  observationCount: number;
  parsedRecordCount: number;
}

export interface NormalizationArtifacts {
  manifest: BuildManifest;
  parsedRecords: ParsedRecord[];
  observations: Observation[];
  entities: NormalizedEntity[];
  report: NormalizationQualityReport;
}
