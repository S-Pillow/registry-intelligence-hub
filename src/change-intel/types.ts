/** Change Intelligence (CHANGE-INTEL-1) — typed runtime models. */

export const CHANGE_INTEL_STATE_VERSION = "change-intel-state/1.0.0" as const;
export const CHANGE_INTEL_OBSERVATION_VERSION = "change-intel-observation/1.0.0" as const;
export const CHANGE_INTEL_DIFF_VERSION = "change-intel-diff/1.0.0" as const;
export const CHANGE_INTEL_FEED_VERSION = "change-intel-feed/1.0.0" as const;

export type ChangeSourceType = "application" | "contention";

export type ApplicationChangeType =
  | "APPLICATION_NOW_PRESENT"
  | "APPLICATION_NO_LONGER_PRESENT"
  | "APPLICATION_FIELD_CHANGED";

export type ContentionChangeType =
  | "CONTENTION_MEMBERSHIP_ADDED"
  | "CONTENTION_MEMBERSHIP_REMOVED";

export type ChangeType = ApplicationChangeType | ContentionChangeType;

export type PrimaryImpact =
  | "GODADDY_DIRECT"
  | "GODADDY_CONTENTION"
  | "RSP_RESEARCH_RELEVANT"
  | "MARKET_CHANGE";

export type RspPublicPostureLabel =
  | "Public Main-RSP capability found"
  | "Main-RSP capability via confirmed organization"
  | "No public Main-RSP capability found"
  | "Identity review needed"
  | "GoDaddy own Applicant portfolio"
  | null;

/** Explicit tracked Application fields — business-relevant only. */
export type TrackedApplicationFields = {
  applicationId: string;
  applicantLegalName: string;
  appliedForString: string;
  applicationStatus: string;
  processingStage: string;
  applicationType: string;
  country: string;
  region: string;
  idn: boolean;
  community: boolean;
  brand: boolean;
  geoSelfDesignated: boolean;
};

export type FieldChange = {
  field: keyof Omit<TrackedApplicationFields, "applicationId">;
  before: string | boolean | null;
  after: string | boolean | null;
};

export type ContentionMembershipKey = {
  contentionSetId: string;
  applicationId: string;
};

export type SourceArtifactMeta = {
  sourceUrl: string;
  contentSha256: string;
  retrievedAt: string;
  recordCount: number;
  /** Optional semantic pin (graph / sidecar hash) when available. */
  semanticHash: string;
};

export type ChangeIntelObservation = {
  version: typeof CHANGE_INTEL_OBSERVATION_VERSION;
  observationId: string;
  observedAt: string;
  previousObservationId: string | null;
  bootstrap: boolean;
  applicationSource: SourceArtifactMeta;
  contentionSource: SourceArtifactMeta;
  officialApplications: number | null;
  officialApplicants: number | null;
  observedApplicationRecords: number;
  officialContentionSets: number;
  officialContentionMemberships: number;
  applications: TrackedApplicationFields[];
  contentionMemberships: ContentionMembershipKey[];
  /** Deterministic hash over sorted tracked applications. */
  applicationsSemanticHash: string;
  /** Deterministic hash over sorted contention memberships. */
  contentionSemanticHash: string;
};

export type ChangeRecord = {
  changeId: string;
  observedAt: string;
  sourceType: ChangeSourceType;
  changeType: ChangeType;
  applicationId: string | null;
  appliedForString: string | null;
  applicantLegalName: string | null;
  fieldChanges: FieldChange[];
  contentionSetId: string | null;
  before: Partial<TrackedApplicationFields> | ContentionMembershipKey | null;
  after: Partial<TrackedApplicationFields> | ContentionMembershipKey | null;
  primaryImpact: PrimaryImpact;
  impactReasons: string[];
  applicantApplicationCount: number | null;
  applicantContentionCount: number | null;
  rspPublicPosture: RspPublicPostureLabel;
  exploreHref: string | null;
  competitiveLandscapeHref: string | null;
};

export type ChangeIntelDiff = {
  version: typeof CHANGE_INTEL_DIFF_VERSION;
  diffId: string;
  observationId: string;
  previousObservationId: string | null;
  observedAt: string;
  previousObservedAt: string | null;
  semanticUnchanged: boolean;
  summary: {
    applicationChanges: number;
    contentionChanges: number;
    godaddyDirect: number;
    godaddyContention: number;
    rspResearchRelevant: number;
    marketChange: number;
  };
  changes: ChangeRecord[];
};

export type ChangeIntelIndex = {
  version: typeof CHANGE_INTEL_STATE_VERSION;
  initializedAt: string;
  lastCheckedAt: string | null;
  lastMeaningfulChangeAt: string | null;
  currentObservationId: string | null;
  previousObservationId: string | null;
  latestDiffId: string | null;
  latestMeaningfulDiffId: string | null;
  observationIds: string[];
  diffIds: string[];
};

export type ChangeIntelFeed = {
  version: typeof CHANGE_INTEL_FEED_VERSION;
  initialized: true;
  lastCheckedAt: string | null;
  lastMeaningfulChangeAt: string | null;
  currentObservationId: string | null;
  previousObservationId: string | null;
  comparedWithObservedAt: string | null;
  latestDiff: ChangeIntelDiff | null;
  /** Bounded recent meaningful diffs (newest first), excluding pure zero-change diffs. */
  recentMeaningfulDiffs: ChangeIntelDiff[];
  applicationSource: SourceArtifactMeta | null;
  contentionSource: SourceArtifactMeta | null;
};

export type ChangeIntelFeedState =
  | { initialized: false }
  | ChangeIntelFeed;

/** Derived materiality — never persisted into ChangeRecord storage. */
export type ChangeMateriality = "MATERIAL" | "CONTEXTUAL";

/**
 * Read-time / view-model Organization context for a ChangeRecord.
 * Layer C (current RIH intelligence) — must not be merged into immutable
 * observation or ChangeRecord storage.
 */
export type DerivedChangeOrganizationContext = {
  /** Organization-resolution snapshot semanticContentSha256 used for this derivation. */
  organizationSnapshotHash: string;
  /** Stable snapshot provenance when present on the Organization snapshot. */
  organizationSnapshotGeneratedAt: string | null;
  organizationResolutionState:
    | "CONFIRMED"
    | "CANDIDATE"
    | "AMBIGUOUS"
    | "UNRESOLVED"
    | "MISSING";
  confirmedOrganizationId: string | null;
  confirmedOrganizationKey: string | null;
  confirmedOrganizationName: string | null;
  organizationHref: string | null;
};

export type DerivedChangeInvestigationLinks = {
  exploreHref: string | null;
  competitiveLandscapeHref: string | null;
  applicantHref: string | null;
  organizationHref: string | null;
  contentionSets: Array<{ contentionSetId: string; href: string }>;
  /** Omitted unless a valid same-grain multi-subject Compare URL exists. */
  compareHref: string | null;
};

/** Presentation overlay for one immutable ChangeRecord (CHANGE-INTEL-2A). */
export type DerivedChangeContext = {
  materiality: ChangeMateriality;
  organization: DerivedChangeOrganizationContext;
  /** Contention set IDs from the temporally appropriate observation, not live publications. */
  contentionSetIds: string[];
  links: DerivedChangeInvestigationLinks;
  displayImpactLabel: string;
  /** Full deterministic reasons, sanitized for user-facing safety, deduped, stable order. */
  displayImpactReasons: string[];
  displayRspPosture: string | null;
};

export type ChangeInvestigationView = {
  change: ChangeRecord;
  derived: DerivedChangeContext;
};

/**
 * UI feed: immutable ChangeIntelFeed plus read-time derived context.
 * Does not alter on-disk observations/diffs/feed JSON.
 */
export type ChangeIntelPresentationFeed = ChangeIntelFeed & {
  organizationSnapshotHash: string;
  organizationSnapshotGeneratedAt: string | null;
  /** Derived context keyed by changeId (latest + recent meaningful). */
  derivedByChangeId: Record<string, DerivedChangeContext>;
};

export type ChangeIntelPresentationFeedState =
  | { initialized: false }
  | ChangeIntelPresentationFeed;
