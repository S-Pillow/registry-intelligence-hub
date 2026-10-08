/**
 * Honest browser projection: registry-2026-publication/2.0.0 → registry-browser-applications/2.0.0.
 * Does not fabricate 1.1 fields. Does not activate/promote. Contention is an optional overlay.
 */

import { contentHash } from "@/normalization/hashes";
import {
  resolveMetricEligibilityWithActuality,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ClaimActualityState,
  type ContentionActualityState,
} from "@/reveal-day-2026/claim-actuality";
import {
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  contentionSidecarHashInput,
  type ContentionMembershipSnapshotV1,
} from "@/reveal-day-2026/contention-membership-types";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import { evaluateContentionMembershipPromotionCandidate } from "@/reveal-day-2026/promotion-contract-2x";
import {
  FORBIDDEN_BROWSER_V2_APPLICATION_KEYS,
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
  type BrowserApplicationV2,
  type BrowserContentionOverlayDocumentV2,
  type BrowserOfficialContentionOverlayV2,
  type RegistryApplicationsDocumentV2,
  isBrowserApplicationPayloadDocumentV2,
} from "@/lib/registry-applications-document-v2";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
import { isBrowserApplicationPayloadDocument } from "@/lib/registry-application-payload-shared";

export {
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
  isBrowserApplicationPayloadDocumentV2,
  FORBIDDEN_BROWSER_V2_APPLICATION_KEYS,
  type BrowserApplicationV2,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";

const COVERAGE_DISCLOSURE_KEYS = [
  "official-aggregate-applications",
  "observed-application-records-partial",
  "not-official-round-total",
  "known-excluded-coverage-only",
  "row-derived-analysis-may-be-partial",
  "applicant-not-organization",
] as const;

function projectApplicationRecord(app: Registry2026ApplicationV2): BrowserApplicationV2 {
  const record: BrowserApplicationV2 = {
    applicationId: app.applicationId,
    applicant: app.applicant,
    country: app.country,
    region: app.region,
    applicationStatus: app.applicationStatus,
    processingStage: app.processingStage,
    applicationType: app.applicationType,
    designations: { ...app.designations },
    labels: { ...app.labels },
    appliedString: { ...app.appliedString },
  };
  if (app.priority !== undefined) record.priority = app.priority;
  if (app.replacementString) {
    record.replacementString = { ...app.replacementString };
  }
  return record;
}

function assertNoForbiddenKeys(record: BrowserApplicationV2): void {
  const raw = record as unknown as Record<string, unknown>;
  for (const key of FORBIDDEN_BROWSER_V2_APPLICATION_KEYS) {
    if (Object.hasOwn(raw, key)) {
      throw new Error(`2.x browser Application must not include fabricated/legacy field "${key}"`);
    }
  }
}

function unavailableContention(reason: string): BrowserContentionOverlayDocumentV2 {
  return {
    status: "unavailable",
    schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
    snapshotId: null,
    sidecarContentSha256: null,
    rawSha256: null,
    applicationPublicationPinHash: null,
    officialContentionSetCount: null,
    joinedMemberCount: null,
    reason,
  };
}

function buildContentionMembershipIndex(
  sidecar: ContentionMembershipSnapshotV1,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const set of sidecar.contentionSets) {
    for (const member of set.members) {
      const existing = index.get(member.applicationId) ?? [];
      existing.push(set.officialContentionSetId);
      index.set(member.applicationId, existing);
    }
  }
  return index;
}

export type BuildBrowserV2Options = {
  /** Optional independently validated contention sidecar. */
  contention?: ContentionMembershipSnapshotV1 | null;
  checkedAt?: string;
};

/**
 * Convert Publication 2.0.0 → inactive browser 2.x document.
 * Never writes claim actuality. Never fabricates 1.1 fields.
 */
export function buildBrowserApplicationPayloadFromPublicationV2(
  publication: Registry2026PublicationV2,
  options: BuildBrowserV2Options = {},
): RegistryApplicationsDocumentV2 {
  if (publication.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    throw new Error(`Expected ${PUBLICATION_SCHEMA_VERSION_V20}`);
  }

  const graphHash = contentHash(applicationGraphHashInput(publication));
  if (publication.bundleManifest.applicationGraphContentSha256 !== graphHash) {
    throw new Error("Publication application graph hash does not match content — refuse browser projection");
  }

  const applications = publication.applications.map((app) => {
    const projected = projectApplicationRecord(app);
    assertNoForbiddenKeys(projected);
    return projected;
  });

  let contentionOverlay = unavailableContention("Contention sidecar not supplied");
  if (options.contention) {
    const candidate = evaluateContentionMembershipPromotionCandidate(
      options.contention,
      graphHash,
    );
    if (candidate.status !== "PROMOTABLE") {
      contentionOverlay = unavailableContention(
        `Contention overlay disabled: ${candidate.errors[0] ?? "pin/validation failed"}`,
      );
    } else {
      const index = buildContentionMembershipIndex(options.contention);
      for (const app of applications) {
        const setIds = index.get(app.applicationId);
        const overlay: BrowserOfficialContentionOverlayV2 = setIds?.length
          ? {
              membershipPresent: true,
              officialContentionSetIds: [...setIds].sort(
                (a, b) => Number(a) - Number(b) || a.localeCompare(b),
              ),
              terminology: "official-initial-contention",
            }
          : {
              membershipPresent: false,
              officialContentionSetIds: [],
              terminology: "official-initial-contention",
            };
        app.officialContention = overlay;
      }
      contentionOverlay = {
        status: "available",
        schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
        snapshotId: options.contention.snapshotId,
        sidecarContentSha256: contentHash(contentionSidecarHashInput(options.contention)),
        rawSha256: options.contention.lineage.rawSha256,
        applicationPublicationPinHash:
          options.contention.applicationPublicationPin.applicationGraphContentSha256,
        officialContentionSetCount: options.contention.quality.officialContentionSetCount,
        joinedMemberCount: options.contention.quality.joinedMemberCount,
      };
    }
  }

  const coverage = publication.coverage.applicationRecordCoverage;
  const observed = publication.coverage.normalizedApplicationRecordsObserved;
  if (observed !== applications.length) {
    throw new Error(
      `observedApplicationRecords (${observed}) must equal projected applications.length (${applications.length})`,
    );
  }

  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "inactive-2x",
    snapshotId: publication.snapshotId,
    snapshotContentHash: graphHash,
    publicationSchemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publishedAt: publication.publishedAt,
    retrievedAt: publication.retrievedAt,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    parserVersion: publication.parserVersion,
    normalizerVersion: publication.normalizerVersion,
    source: { ...publication.source },
    limitations: [
      ...publication.limitations,
      "Inactive 2.x browser projection — not an activated product source.",
      "Official application total is the official aggregate, not observedApplicationRecords.",
      "Organization, category, returning, and confidence are not present in Publication 2.0.0.",
      "Official contention is an optional overlay — never exact-string competition.",
    ],
    disclosureKeys: COVERAGE_DISCLOSURE_KEYS,
    officialAggregates: {
      officialApplicationCount: publication.officialAggregates.officialApplicationCount,
      officialApplicantCount: publication.officialAggregates.officialApplicantCount,
      provenance: { ...publication.officialAggregates.provenance },
    },
    applicationRecordCoverage: {
      observed: coverage.observed,
      official: coverage.official,
      completeness: coverage.completeness,
      knownExcludedRecords: coverage.knownExcludedRecords.map((r) => ({ ...r })),
    },
    officialApplications: publication.officialAggregates.officialApplicationCount,
    observedApplicationRecords: observed,
    officialApplicants: publication.officialAggregates.officialApplicantCount,
    knownExcludedRecords: coverage.knownExcludedRecords.map((r) => ({ ...r })),
    bundleManifest: { ...publication.bundleManifest },
    rawSha256: publication.lineage.rawSha256,
    contentionOverlay,
    applications,
  };
}

/** Explicit dispatch: never down-convert 2.0 into fake 1.1. */
export function buildBrowserApplicationPayloadByPublicationSchema(
  publication: Registry2026PublicationV2,
  options?: BuildBrowserV2Options,
): RegistryApplicationsDocumentV2 {
  return buildBrowserApplicationPayloadFromPublicationV2(publication, options);
}

// --- Search / Explore (2.x) -------------------------------------------------

export type ExploreFilterStateV2 = {
  q: string;
  region: string;
  /** APS application status — not returning/new. */
  applicationStatus: string;
  applicationType: string;
  idn: string;
  brand: string;
  community: string;
  geographic: string;
  ids: string;
};

export const DEFAULT_EXPLORE_FILTERS_V2: ExploreFilterStateV2 = {
  q: "",
  region: "all",
  applicationStatus: "all",
  applicationType: "all",
  idn: "all",
  brand: "all",
  community: "all",
  geographic: "all",
  ids: "",
};

/** Facets that must not appear for 2.x Search/Explore. */
export const UNSUPPORTED_EXPLORE_FACETS_V2 = [
  "organization",
  "category",
  "returning",
  "confidence",
  "sector",
] as const;

function searchableText(app: BrowserApplicationV2): string[] {
  return [
    app.applicationId,
    app.appliedString.label,
    app.appliedString.unicodeLabel ?? "",
    app.applicant,
    app.country,
    app.region,
    app.applicationStatus,
    app.processingStage,
    app.applicationType,
    app.replacementString?.label ?? "",
  ];
}

export function filterBrowserApplicationsV2(
  applications: readonly BrowserApplicationV2[],
  filters: ExploreFilterStateV2,
): BrowserApplicationV2[] {
  const q = filters.q.trim().toLowerCase();
  const selectedIds = new Set(filters.ids.split(",").filter(Boolean));
  return applications.filter((app) => {
    const matchesQuery =
      !q
      || searchableText(app).some((value) => value.toLowerCase().includes(q));
    return (
      matchesQuery
      && (!selectedIds.size || selectedIds.has(app.applicationId))
      && (filters.region === "all" || app.region === filters.region)
      && (filters.applicationStatus === "all" || app.applicationStatus === filters.applicationStatus)
      && (filters.applicationType === "all" || app.applicationType === filters.applicationType)
      && (filters.idn === "all" || (filters.idn === "idn" ? app.designations.idn : !app.designations.idn))
      && (filters.brand === "all" || (filters.brand === "brand" ? app.designations.brand : !app.designations.brand))
      && (
        filters.community === "all"
        || (filters.community === "community" ? app.designations.community : !app.designations.community)
      )
      && (
        filters.geographic === "all"
        || (
          filters.geographic === "geographic"
            ? app.designations.geoSelfDesignated
            : !app.designations.geoSelfDesignated
        )
      )
    );
  });
}

/**
 * Local Search/Explore result count semantics:
 * matching RIH observed records — never the official Application aggregate.
 */
export function localResultCountV2(matches: readonly BrowserApplicationV2[]): {
  matchingObservedRecords: number;
  countSemantics: "rih-observed-records";
  notOfficialRoundTotal: true;
} {
  return {
    matchingObservedRecords: matches.length,
    countSemantics: "rih-observed-records",
    notOfficialRoundTotal: true,
  };
}

export function coverageDisclosureForDocumentV2(document: RegistryApplicationsDocumentV2): {
  officialApplications: number;
  observedApplicationRecords: number;
  officialApplicants: number;
  completeness: "partial" | "complete";
  knownExcludedApplicationIds: string[];
  disclosureKeys: readonly string[];
  userMustNotReadObservedAsOfficialTotal: true;
} {
  return {
    officialApplications: document.officialApplications,
    observedApplicationRecords: document.observedApplicationRecords,
    officialApplicants: document.officialApplicants,
    completeness: document.applicationRecordCoverage.completeness,
    knownExcludedApplicationIds: document.knownExcludedRecords.map((r) => r.applicationId),
    disclosureKeys: document.disclosureKeys,
    userMustNotReadObservedAsOfficialTotal: true,
  };
}

// --- Gates for surfaces that still require 1.1 fields ------------------------

export function assertDocumentCompatibleWithBriefingsOrSaved(
  document: unknown,
): asserts document is RegistryApplicationsDocument {
  if (isBrowserApplicationPayloadDocumentV2(document)) {
    throw new Error(
      "registry-browser-applications/2.0.0 is not compatible with Saved/Briefings (requires 1.1-shaped Application fields). Gate explicitly — do not fabricate organization/category/returning.",
    );
  }
  if (!isBrowserApplicationPayloadDocument(document)) {
    throw new Error("Unsupported registry applications document for Saved/Briefings");
  }
}

export function documentSupportsCommandCenterOrientation(document: unknown): document is RegistryApplicationsDocument {
  return isBrowserApplicationPayloadDocument(document) && !isBrowserApplicationPayloadDocumentV2(document);
}

// --- Metric probes against eligibility (no invented values) ------------------

export function metricEligibilityProbeForBrowserV2(
  document: RegistryApplicationsDocumentV2,
  claimActuality: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
  contentionActuality: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
) {
  const ids = [
    "application-count",
    "observed-application-records",
    "applicant-count",
    "unique-applied-strings",
    "idn-applications",
    "organization-round-count",
    "returning-participant-identity",
    "category-mix",
    "exact-applied-string-competition",
    "initial-contention-sets",
    "initial-contention-memberships",
  ] as const;

  return Object.fromEntries(
    ids.map((metricId) => {
      const resolved = resolveMetricEligibilityWithActuality(metricId, claimActuality, contentionActuality);
      return [
        metricId,
        {
          claimReadiness2026: resolved?.claimReadiness.round2026 ?? "NOT_PUBLISHED",
          methodReadiness: resolved?.methodReadiness,
          sourceChannel: resolved?.sourceChannel,
          comparisonAllowed: resolved?.comparisonAllowed ?? false,
          documentOfficialApplications: document.officialApplications,
          documentObservedRecords: document.observedApplicationRecords,
          documentOfficialApplicants: document.officialApplicants,
        },
      ];
    }),
  );
}

/** Data Health metadata slice for an inactive 2.x document (not primary business surface). */
export function dataHealthMetadataFromBrowserV2(document: RegistryApplicationsDocumentV2) {
  return {
    payloadVersion: document.payloadVersion,
    publicationSchemaVersion: document.publicationSchemaVersion,
    snapshotId: document.snapshotId,
    snapshotContentHash: document.snapshotContentHash,
    officialApplications: document.officialApplications,
    observedApplicationRecords: document.observedApplicationRecords,
    officialApplicants: document.officialApplicants,
    coverageCompleteness: document.applicationRecordCoverage.completeness,
    knownExcludedApplicationIds: document.knownExcludedRecords.map((r) => r.applicationId),
    officialAggregatesContentSha256: document.bundleManifest.officialAggregatesContentSha256,
    coverageDescriptorSha256: document.bundleManifest.coverageDescriptorSha256,
    applicationGraphContentSha256: document.bundleManifest.applicationGraphContentSha256,
    rawSha256: document.rawSha256,
    contentionOverlayStatus: document.contentionOverlay.status,
    contentionSidecarContentSha256: document.contentionOverlay.sidecarContentSha256,
    contentionReason: document.contentionOverlay.reason ?? null,
    payloadMode: document.payloadMode,
  };
}
