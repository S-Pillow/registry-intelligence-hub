import { contentHash } from "@/normalization/hashes";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026PublicationV2,
} from "@/reveal-day-2026/publication-v2-types";
import {
  OBSERVED_APPLICANT_LEGAL_NAME_COUNT,
  OBSERVED_APPLICATION_COUNT,
  OFFICIAL_APPLICANT_COUNT,
  OFFICIAL_APPLICATION_COUNT,
  ORGANIZATION_RESOLUTION_METHOD_VERSION,
  ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
  ORGANIZATION_RESOLUTION_SCHEMA_VERSION,
  PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
  PINNED_APPLICATION_SNAPSHOT_ID,
  RESOLVED_2026_ORG_ENTITY_PREFIX,
} from "./constants";
import {
  candidateClusterIdFromNormalizedKey,
  normalizeApplicantNameForCandidateDiscovery,
} from "./normalize-applicant-name";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";
import type { Confirmed2012ApplicantAlias } from "./load-2012-confirmed-aliases";
import { validateOrganizationResolutionRegistry } from "./validate-registry";
import type {
  ApplicantIdentityMapping,
  CandidateNameCluster,
  OrganizationEvidenceRef,
  OrganizationResolutionQuality,
  OrganizationResolutionRegistry,
  OrganizationResolutionSnapshot,
  ResolvedOrganization2026,
} from "./types";

export const DEFAULT_RESOLUTION_LIMITATIONS = [
  "Applicant legal name ≠ resolved Organization — string identity alone never confirms.",
  "Contention CSV Org Name is published source text only — never RIH Organization.",
  "RSP / backend-provider relationships do not imply Organization identity.",
  "CONFIRMED requires steward-approved A/B evidence; first-pass may have zero confirmed Organizations.",
  "possible2012OrganizationKey is a steward-review hint only — not CROSS-ROUND-ID returning/new.",
  "Organization metrics remain product-blocked until confirmed mappings exist and eligibility advances.",
  "No category/sector inference. No Application or contention publication mutation.",
] as const;

export type BuildOrganizationResolutionInput = {
  publication: Registry2026PublicationV2;
  registry: OrganizationResolutionRegistry;
  confirmed2012Aliases: Map<string, Confirmed2012ApplicantAlias>;
  /** When set, pin must equal this hash (defaults to Reveal Day pin). */
  expectApplicationGraphHash?: string;
  generatedAt?: string;
};

function organizationEntityId(organizationKey: string): string {
  return `${RESOLVED_2026_ORG_ENTITY_PREFIX}${organizationKey}`;
}

function slugOrganizationKey(legalName: string): string {
  return normalizeApplicantNameForCandidateDiscovery(legalName).replace(/\s+/g, "-").slice(0, 80) || "unnamed";
}

export function assertApplicationPublicationPin(
  publication: Registry2026PublicationV2,
  expectHash: string = PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
): string {
  if (publication.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    throw new Error(
      `Organization resolution requires ${PUBLICATION_SCHEMA_VERSION_V20}, got ${publication.schemaVersion}`,
    );
  }
  const computed = contentHash(applicationGraphHashInput(publication));
  if (computed !== expectHash) {
    throw new Error(
      `Application publication pin mismatch: expected ${expectHash}, got ${computed} — fail closed`,
    );
  }
  const declared = publication.bundleManifest?.applicationGraphContentSha256;
  if (declared && declared !== computed) {
    throw new Error(
      `Publication bundleManifest.applicationGraphContentSha256 (${declared}) does not match recomputed graph hash (${computed})`,
    );
  }
  return computed;
}

export function buildOrganizationResolutionSnapshot(
  input: BuildOrganizationResolutionInput,
): OrganizationResolutionSnapshot {
  validateOrganizationResolutionRegistry(input.registry);
  const expectHash = input.expectApplicationGraphHash ?? PINNED_APPLICATION_GRAPH_CONTENT_SHA256;
  const pinHash = assertApplicationPublicationPin(input.publication, expectHash);

  const appsByLegalName = new Map<string, string[]>();
  for (const app of input.publication.applications) {
    const list = appsByLegalName.get(app.applicant) ?? [];
    list.push(app.applicationId);
    appsByLegalName.set(app.applicant, list);
  }
  for (const ids of appsByLegalName.values()) {
    ids.sort();
  }

  const legalNames = [...appsByLegalName.keys()].sort((a, b) => a.localeCompare(b));
  const normalizedToNames = new Map<string, string[]>();
  for (const name of legalNames) {
    const key = normalizeApplicantNameForCandidateDiscovery(name);
    const list = normalizedToNames.get(key) ?? [];
    list.push(name);
    normalizedToNames.set(key, list);
  }

  const candidateClusters: CandidateNameCluster[] = [];
  const nameToClusterId = new Map<string, string>();
  for (const [normalizedKey, names] of [...normalizedToNames.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (names.length < 2) continue;
    const clusterId = candidateClusterIdFromNormalizedKey(normalizedKey);
    const applicationIds = names.flatMap((n) => appsByLegalName.get(n) ?? []).sort();
    candidateClusters.push({
      clusterId,
      normalizedKey,
      applicantLegalNames: [...names].sort((a, b) => a.localeCompare(b)),
      applicationIds,
      discoveryOnly: true,
    });
    for (const n of names) nameToClusterId.set(n, clusterId);
  }

  const evidenceById = new Map<string, OrganizationEvidenceRef>(
    input.registry.evidence.map((e) => [e.evidenceId, e]),
  );
  const usedEvidence = new Map<string, OrganizationEvidenceRef>();

  const organizations: ResolvedOrganization2026[] = [];
  const mappings = new Map<string, ApplicantIdentityMapping>();

  // Default: every exact legal name is UNRESOLVED (Applicant group ≠ Organization).
  for (const legalName of legalNames) {
    const applicationIds = appsByLegalName.get(legalName)!;
    const alias = input.confirmed2012Aliases.get(legalName) ?? null;
    const clusterId = nameToClusterId.get(legalName) ?? null;
    mappings.set(legalName, {
      applicantLegalName: legalName,
      applicationIds: [...applicationIds],
      resolutionState: "UNRESOLVED",
      organizationId: null,
      evidenceRefIds: [],
      normalizedKey: normalizeApplicantNameForCandidateDiscovery(legalName),
      candidateClusterId: clusterId,
      possible2012OrganizationKey: alias?.organizationKey ?? null,
      reason:
        applicationIds.length > 1
          ? "Exact Applicant legal name spans multiple Applications — Applicant group only; not resolved Organization"
          : "No steward organization-resolution operation",
    });
  }

  // Normalized multi-spelling clusters → CANDIDATE discovery orgs (never CONFIRMED).
  for (const cluster of candidateClusters) {
    const organizationKey = `norm-cluster-${cluster.normalizedKey.replace(/\s+/g, "-").slice(0, 64)}`;
    const organizationId = organizationEntityId(organizationKey);
    const evidenceId = `ev-norm-cluster-${organizationKey}`;
    const evidence: OrganizationEvidenceRef = {
      evidenceId,
      strength: "D",
      sourceType: "aps-publication",
      sourceIdentifier: pinHash,
      asOf: input.publication.publishedAt.slice(0, 10),
      summary: "Normalized Applicant Name spelling cluster for steward review only",
      supportsClaim: `Candidate-equivalent spellings: ${cluster.applicantLegalNames.join(" | ")}`,
    };
    usedEvidence.set(evidenceId, evidence);
    organizations.push({
      organizationId,
      organizationKey,
      canonicalName: cluster.applicantLegalNames[0],
      status: "CANDIDATE",
      applicantLegalNames: [...cluster.applicantLegalNames],
      memberApplicationIds: [...cluster.applicationIds],
      evidenceRefIds: [evidenceId],
      resolutionMethod: ORGANIZATION_RESOLUTION_METHOD_VERSION,
      confidence: "low",
      reviewState: "pending-steward",
      notes: "Normalization-only candidate cluster — D evidence; not product-eligible",
    });
    for (const legalName of cluster.applicantLegalNames) {
      const mapping = mappings.get(legalName)!;
      mapping.resolutionState = "CANDIDATE";
      mapping.organizationId = organizationId;
      mapping.evidenceRefIds = [evidenceId];
      mapping.reason = "Normalized-name candidate cluster (discovery only; not confirmation)";
    }
  }

  // Exact match to 2012 CONFIRMED applicant legal name → CANDIDATE historical hint (not returning).
  for (const legalName of legalNames) {
    const alias = input.confirmed2012Aliases.get(legalName);
    if (!alias) continue;
    const mapping = mappings.get(legalName)!;
    // Steward ops may already have claimed this name; skip auto-candidate if later overridden by registry.
    if (mapping.resolutionState === "CONFIRMED" || mapping.resolutionState === "AMBIGUOUS") continue;

    const organizationKey = `hist-2012-${alias.organizationKey}`;
    const organizationId = organizationEntityId(organizationKey);
    const evidenceId = `ev-2012-alias-${alias.organizationKey}-${slugOrganizationKey(legalName)}`;
    const evidence: OrganizationEvidenceRef = {
      evidenceId,
      strength: "C",
      sourceType: "2012-promotion-alias",
      sourceIdentifier: `organization-promotion/1.0.0#${alias.organizationKey}`,
      asOf: "2012-06-13",
      summary: `Exact Applicant legal name matched 2012 CONFIRMED promotion alias for ${alias.canonicalOrganizationName}`,
      supportsClaim:
        "Candidate historical match for steward review only — does not create cross-round identity or returning/new",
    };
    usedEvidence.set(evidenceId, evidence);

    const existingOrg = organizations.find((o) => o.organizationId === organizationId);
    const applicationIds = appsByLegalName.get(legalName)!;
    if (existingOrg) {
      existingOrg.applicantLegalNames = [
        ...new Set([...existingOrg.applicantLegalNames, legalName]),
      ].sort((a, b) => a.localeCompare(b));
      existingOrg.memberApplicationIds = [
        ...new Set([...existingOrg.memberApplicationIds, ...applicationIds]),
      ].sort();
      existingOrg.evidenceRefIds = [...new Set([...existingOrg.evidenceRefIds, evidenceId])].sort();
    } else {
      organizations.push({
        organizationId,
        organizationKey,
        canonicalName: legalName,
        status: "CANDIDATE",
        applicantLegalNames: [legalName],
        memberApplicationIds: [...applicationIds],
        evidenceRefIds: [evidenceId],
        resolutionMethod: ORGANIZATION_RESOLUTION_METHOD_VERSION,
        confidence: "medium",
        reviewState: "pending-steward",
        possible2012OrganizationKey: alias.organizationKey,
        notes: "2012 CONFIRMED alias exact-name match — candidate only; CROSS-ROUND-ID deferred",
      });
    }

    mapping.resolutionState = "CANDIDATE";
    mapping.organizationId = organizationId;
    mapping.evidenceRefIds = [...new Set([...mapping.evidenceRefIds, evidenceId])].sort();
    mapping.possible2012OrganizationKey = alias.organizationKey;
    mapping.reason =
      "Exact Applicant legal name matches 2012 CONFIRMED promotion alias — candidate historical match only";
  }

  // Explicit steward registry ops (may CONFIRMED / CANDIDATE / AMBIGUOUS).
  for (const op of input.registry.operations) {
    for (const evidenceId of op.evidenceRefIds) {
      usedEvidence.set(evidenceId, evidenceById.get(evidenceId)!);
    }
    const applicationIds = (
      op.applicationIds ??
      op.applicantLegalNames.flatMap((n) => {
        const ids = appsByLegalName.get(n);
        if (!ids) {
          throw new Error(`Resolution op ${op.opId} references unknown applicant legal name "${n}"`);
        }
        return ids;
      })
    ).sort();

    for (const id of applicationIds) {
      const app = input.publication.applications.find((a) => a.applicationId === id);
      if (!app) {
        throw new Error(`Resolution op ${op.opId} references unknown applicationId ${id}`);
      }
      if (!op.applicantLegalNames.includes(app.applicant)) {
        throw new Error(
          `Resolution op ${op.opId} application ${id} applicant "${app.applicant}" not in op.applicantLegalNames`,
        );
      }
    }

    const organizationId = organizationEntityId(op.organizationKey);
    // Remove auto-generated candidates for these names if steward op supersedes.
    const supersededOrgIds = new Set<string>();
    for (const legalName of op.applicantLegalNames) {
      const prior = mappings.get(legalName);
      if (prior?.organizationId && prior.organizationId !== organizationId) {
        supersededOrgIds.add(prior.organizationId);
      }
    }
    if (supersededOrgIds.size > 0) {
      for (let i = organizations.length - 1; i >= 0; i--) {
        if (supersededOrgIds.has(organizations[i].organizationId)) {
          organizations.splice(i, 1);
        }
      }
    }

    const existing = organizations.find((o) => o.organizationId === organizationId);
    if (existing) {
      if (existing.status !== op.resolutionState) {
        existing.status = op.resolutionState;
      }
      existing.canonicalName = op.canonicalOrganizationName;
      existing.applicantLegalNames = [
        ...new Set([...existing.applicantLegalNames, ...op.applicantLegalNames]),
      ].sort((a, b) => a.localeCompare(b));
      existing.memberApplicationIds = [...new Set([...existing.memberApplicationIds, ...applicationIds])].sort();
      existing.evidenceRefIds = [...new Set([...existing.evidenceRefIds, ...op.evidenceRefIds])].sort();
      existing.confidence = op.confidence;
      existing.reviewState = op.reviewState;
      existing.stewardDecision = op.stewardDecision;
      existing.notes = op.notes ?? existing.notes;
      existing.possible2012OrganizationKey =
        op.possible2012OrganizationKey ?? existing.possible2012OrganizationKey;
    } else {
      organizations.push({
        organizationId,
        organizationKey: op.organizationKey,
        canonicalName: op.canonicalOrganizationName,
        status: op.resolutionState,
        applicantLegalNames: [...op.applicantLegalNames].sort((a, b) => a.localeCompare(b)),
        memberApplicationIds: applicationIds,
        evidenceRefIds: [...op.evidenceRefIds].sort(),
        resolutionMethod: ORGANIZATION_RESOLUTION_METHOD_VERSION,
        confidence: op.confidence,
        reviewState: op.reviewState,
        stewardDecision: op.stewardDecision,
        notes: op.notes,
        possible2012OrganizationKey: op.possible2012OrganizationKey,
      });
    }

    for (const legalName of op.applicantLegalNames) {
      const mapping = mappings.get(legalName);
      if (!mapping) {
        throw new Error(`Resolution op ${op.opId} references unknown applicant legal name "${legalName}"`);
      }
      mapping.resolutionState = op.resolutionState;
      mapping.organizationId = organizationId;
      mapping.evidenceRefIds = [...op.evidenceRefIds].sort();
      mapping.possible2012OrganizationKey =
        op.possible2012OrganizationKey ?? mapping.possible2012OrganizationKey;
      mapping.reason = op.reason;
      mapping.ambiguityNotes = op.resolutionState === "AMBIGUOUS" ? op.notes : mapping.ambiguityNotes;
    }
  }

  organizations.sort((a, b) => a.organizationId.localeCompare(b.organizationId));

  const draft: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: ORGANIZATION_RESOLUTION_SCHEMA_VERSION,
    methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
    registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
    applicationPublicationPin: {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
      snapshotId: input.publication.snapshotId,
      applicationGraphContentSha256: pinHash,
      normalizedApplicationRecordsObserved: input.publication.applications.length,
      applicationRecordCoverageCompleteness:
        input.publication.coverage.applicationRecordCoverage.completeness,
    },
    organizations,
    applicantIdentityMappings: [...mappings.values()].sort((a, b) =>
      a.applicantLegalName.localeCompare(b.applicantLegalName),
    ),
    candidateClusters,
    evidence: [...usedEvidence.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)),
    quality: buildQuality({
      observedApplications: input.publication.applications.length,
      legalNameCount: legalNames.length,
      multiAppLegalNames: legalNames.filter((n) => (appsByLegalName.get(n)?.length ?? 0) > 1).length,
      mappings: [...mappings.values()],
      organizations,
      candidateClusters,
    }),
    limitations: [...DEFAULT_RESOLUTION_LIMITATIONS],
  };

  const semanticContentSha256 = hashOrganizationResolutionSnapshot(draft);
  return {
    ...draft,
    semanticContentSha256,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

function buildQuality(input: {
  observedApplications: number;
  legalNameCount: number;
  multiAppLegalNames: number;
  mappings: ApplicantIdentityMapping[];
  organizations: ResolvedOrganization2026[];
  candidateClusters: CandidateNameCluster[];
}): OrganizationResolutionQuality {
  const confirmedMappings = input.mappings.filter((m) => m.resolutionState === "CONFIRMED");
  const candidateMappings = input.mappings.filter((m) => m.resolutionState === "CANDIDATE");
  const ambiguousMappings = input.mappings.filter((m) => m.resolutionState === "AMBIGUOUS");
  const unresolved = input.mappings.filter((m) => m.resolutionState === "UNRESOLVED");
  const confirmedApps = new Set(confirmedMappings.flatMap((m) => m.applicationIds));
  const confirmedOrgs = input.organizations.filter((o) => o.status === "CONFIRMED");

  return {
    observedApplications: input.observedApplications,
    officialApplications: OFFICIAL_APPLICATION_COUNT,
    applicationCoverage: "PARTIAL",
    observedApplicantLegalNames: input.legalNameCount,
    officialApplicants: OFFICIAL_APPLICANT_COUNT,
    applicantLegalNamesWithMultipleApplications: input.multiAppLegalNames,
    repeatedExactLegalNameCount: input.multiAppLegalNames,
    candidateOrganizationMappings: candidateMappings.length,
    confirmedOrganizationMappings: confirmedMappings.length,
    ambiguousMappings: ambiguousMappings.length,
    unresolvedApplicantLegalNames: unresolved.length,
    applicationsCoveredByConfirmedOrganizations: confirmedApps.size,
    confirmedApplicationCoverageRatio:
      input.observedApplications === 0 ? 0 : confirmedApps.size / input.observedApplications,
    confirmedOrganizationCount: confirmedOrgs.length,
    candidateOrganizationCount: input.organizations.filter((o) => o.status === "CANDIDATE").length,
    ambiguousOrganizationCount: input.organizations.filter((o) => o.status === "AMBIGUOUS").length,
    candidateClusterCount: input.candidateClusters.length,
    productEligibleOrganizationCount: confirmedOrgs.length,
    returningNewClassificationsCreated: 0,
    crossRoundIdentitiesCreated: 0,
    categoryInferencesCreated: 0,
  };
}

/** Empty first-pass registry — no CONFIRMED without steward A/B evidence. */
export function emptyOrganizationResolutionRegistry(): OrganizationResolutionRegistry {
  return {
    registryVersion: ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
    methodVersion: ORGANIZATION_RESOLUTION_METHOD_VERSION,
    evidence: [],
    operations: [],
  };
}

export function expectedRevealDayPin(): {
  snapshotId: string;
  applicationGraphContentSha256: string;
  observedApplications: number;
  observedApplicantLegalNames: number;
} {
  return {
    snapshotId: PINNED_APPLICATION_SNAPSHOT_ID,
    applicationGraphContentSha256: PINNED_APPLICATION_GRAPH_CONTENT_SHA256,
    observedApplications: OBSERVED_APPLICATION_COUNT,
    observedApplicantLegalNames: OBSERVED_APPLICANT_LEGAL_NAME_COUNT,
  };
}
